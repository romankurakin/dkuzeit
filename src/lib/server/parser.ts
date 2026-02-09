import { parse as parseHtml5 } from 'parse5';
import { cleanText, germanOnlyLabel, russianOnlyLabel, stripParenSuffix } from './text';
import type {
	GroupOption,
	GroupWeekSchedule,
	Cohort,
	CohortTrack,
	LessonEvent,
	MetaPayload,
	WeekOption
} from './types';
import { trackRules, cohortCodeRules, genericCodes } from './cohort-config';
import { fnv1aHex } from './hash';
import {
	attrValue,
	collapseSpaces,
	directChildrenByTag,
	findFirstByTag,
	nodeText
} from './html-utils';
import { makeLegendResolver, parseLegendEntries } from './legend';
import { isMissingGermanName, sanitizeLabel, splitBilingualLabel } from './bilingual';

function parseWeekLabelDate(label: string): string {
	const match = label.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
	if (!match) return new Date().toISOString().slice(0, 10);
	const [, d, m, y] = match;
	return `${y!}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
}

function parseJsStringArray(body: string): string[] {
	const result: string[] = [];
	const regex = /"((?:\\.|[^"\\])*)"/g;
	for (const match of body.matchAll(regex)) {
		result.push(match[1]!.replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
	}
	return result;
}

export function parseNavHtml(html: string): MetaPayload {
	const weekSelectMatch = html.match(/<select\s+name="week"[\s\S]*?<\/select>/i);
	if (!weekSelectMatch) throw new Error('Week select not found in navbar');

	const weekOptions: WeekOption[] = [];
	for (const match of weekSelectMatch[0].matchAll(/<option\s+value="(\d+)">([^<]+)<\/option>/gi)) {
		const value = match[1]!.padStart(2, '0');
		const label = cleanText(match[2]!);
		weekOptions.push({ value, label, startDateIso: parseWeekLabelDate(label) });
	}

	const classesMatch = html.match(/var\s+classes\s*=\s*\[([\s\S]*?)\];/i);
	if (!classesMatch) throw new Error('Classes array not found in navbar');

	const groups: GroupOption[] = parseJsStringArray(classesMatch[1]!).map((codeRaw, idx) => ({
		id: idx + 1,
		codeRaw: cleanText(codeRaw),
		codeRu: sanitizeLabel(stripParenSuffix(russianOnlyLabel(codeRaw))),
		codeDe: sanitizeLabel(stripParenSuffix(germanOnlyLabel(codeRaw)))
	}));

	return { weeks: weekOptions, groups };
}

function parseFooterYear(html: string, fallbackYear: number): number {
	const match = html.match(/ЛС\/SS\s+\d{1,2}\.\d{1,2}\.(\d{4})/i);
	if (!match) return fallbackYear;
	return Number(match[1]);
}

function parseDayDates(html: string, weekStartDateIso: string): string[] {
	const match = [...html.matchAll(/<B>\s*[А-Яа-яA-Za-z]+\s+(\d{1,2})\.(\d{1,2})\.?\s*<\/B>/gi)];
	const weekStart = new Date(`${weekStartDateIso}T00:00:00+05:00`);
	const fallback = Array.from({ length: 6 }, (_, i) => {
		const date = new Date(weekStart);
		date.setUTCDate(date.getUTCDate() + i);
		return date.toISOString().slice(0, 10);
	});

	if (match.length < 6) return fallback;

	const year = parseFooterYear(html, weekStart.getUTCFullYear());
	return match.slice(0, 6).map((entry) => {
		const day = Number(entry[1]);
		const month = Number(entry[2]);
		return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
	});
}

function padTime(time: string): string {
	const [h, m] = time.split(':');
	return `${h!.padStart(2, '0')}:${m}`;
}

function parseTimeRange(text: string): { start: string; end: string } | null {
	const times = text.match(/\b\d{1,2}:\d{2}\b/g);
	if (!times || times.length < 2) return null;
	return { start: padTime(times[0]!), end: padTime(times[times.length - 1]!) };
}

function extractCellLines(td: import('./html-utils').ParseElement): string[] {
	const nestedTable = directChildrenByTag(td, 'table')[0] ?? findFirstByTag(td, 'table');
	if (!nestedTable) {
		const fallback = collapseSpaces(nodeText(td));
		return fallback ? [fallback] : [];
	}

	const tbody = directChildrenByTag(nestedTable, 'tbody')[0] ?? nestedTable;
	const rows = directChildrenByTag(tbody, 'tr');
	const lines: string[] = [];
	for (const row of rows) {
		const cells = directChildrenByTag(row, 'td');
		if (cells.length === 0) continue;
		const value = collapseSpaces(nodeText(cells[0]!));
		if (value) lines.push(value);
	}
	return lines;
}

function detectTrack(subjectFullRaw: string): CohortTrack {
	for (const rule of trackRules) {
		if (rule.namePattern.test(subjectFullRaw)) return rule.track;
	}
	return 'none';
}

function extractCohortCode(subjectCodeRaw: string): { code: string; track: CohortTrack } | null {
	const normalized = subjectCodeRaw.replace(/^\.+/, '');
	for (const rule of cohortCodeRules) {
		const m = rule.codePattern.exec(normalized);
		if (m) {
			const code = m[1] ? rule.code.replace('$1', String(Number(m[1]))) : rule.code;
			return { code, track: rule.track };
		}
	}
	return null;
}

function stableEventId(input: string): string {
	return `e${fnv1aHex(input)}`;
}

/** Fast regex-only check: does this timetable page contain any events? */
export function hasEvents(html: string): boolean {
	return parseLegendEntries(html, 'Дисциплины').length > 0;
}

export function parseTimetablePage(
	html: string,
	group: GroupOption,
	week: WeekOption
): Pick<GroupWeekSchedule, 'events' | 'cohorts'> {
	const document = parseHtml5(html);
	const center = findFirstByTag(document, 'center');
	if (!center) throw new Error('Timetable center container not found');

	const topLevelTables = directChildrenByTag(center, 'table');
	const mainTable = topLevelTables[0];
	if (!mainTable) throw new Error('Main timetable table not found');

	const rowContainer = directChildrenByTag(mainTable, 'tbody')[0] ?? mainTable;
	const rows = directChildrenByTag(rowContainer, 'tr');
	if (rows.length === 0) throw new Error('No rows in timetable table');

	const firstRowCells = directChildrenByTag(rows[0]!, 'td');
	const colCount = firstRowCells.reduce((acc, cell) => {
		const colSpan = Number(attrValue(cell, 'colspan') ?? '1') || 1;
		return acc + colSpan;
	}, 0);

	const occupancy = new Array<number>(Math.max(colCount, 1)).fill(0);
	const rowTimes: Array<{ start: string; end: string } | null> = new Array(rows.length).fill(null);
	const dayDates = parseDayDates(html, week.startDateIso);

	const subjectResolver = makeLegendResolver(parseLegendEntries(html, 'Дисциплины'));

	const events: LessonEvent[] = [];

	for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
		const row = rows[rowIndex]!;
		const cells = directChildrenByTag(row, 'td');
		let col = 0;

		for (const cell of cells) {
			while (col < occupancy.length && occupancy[col]! > 0) col += 1;

			const colSpan = Number(attrValue(cell, 'colspan') ?? '1') || 1;
			const rowSpan = Number(attrValue(cell, 'rowspan') ?? '1') || 1;

			if (col === 0) {
				const periodRange = parseTimeRange(collapseSpaces(nodeText(cell)));
				if (periodRange) {
					for (let r = rowIndex; r < Math.min(rows.length, rowIndex + rowSpan); r += 1) {
						rowTimes[r] = periodRange;
					}
				}
			} else {
				const lines = extractCellLines(cell);
				const subjectRaw = lines[0] ?? '';
				const roomRaw = lines[2] ?? '';

				if (subjectRaw && !subjectRaw.includes('________________')) {
					const dayIndex = Math.floor((col - 1) / 12);
					if (dayIndex >= 0 && dayIndex < dayDates.length) {
						const startRange = rowTimes[rowIndex];
						const endRange =
							rowTimes[Math.min(rows.length - 1, rowIndex + rowSpan - 1)] ?? startRange;
						if (startRange && endRange) {
							const subjectFullRaw = subjectResolver(subjectRaw);
							const noGerman = isMissingGermanName(subjectFullRaw);
							const shortLabels = splitBilingualLabel(subjectRaw, noGerman);
							const fullLabels = splitBilingualLabel(subjectFullRaw, noGerman);
							const lessonType = noGerman ? '' : fullLabels.lessonType;
							const cohort = extractCohortCode(subjectRaw);
							const nameTrack = detectTrack(subjectFullRaw);
							const track = nameTrack !== 'none' ? nameTrack : (cohort?.track ?? 'none');
							const cohortCode = cohort && !genericCodes.has(cohort.code) ? cohort.code : null;
							const scope = cohortCode ? 'cohort_shared' : 'core_fixed';
							const dateIso = dayDates[dayIndex]!;
							const id = stableEventId(
								`${group.codeRaw}|${dateIso}|${startRange.start}|${endRange.end}|${subjectRaw}|${roomRaw}|${cohortCode ?? ''}`
							);

							events.push({
								id,
								dateIso,
								dayIndex,
								startTime: startRange.start,
								endTime: endRange.end,
								subjectShortRaw: subjectRaw,
								subjectShortRu: sanitizeLabel(shortLabels.ru),
								subjectShortDe: sanitizeLabel(shortLabels.de),
								subjectFullRaw,
								subjectFullRu: sanitizeLabel(fullLabels.ru),
								subjectFullDe: sanitizeLabel(fullLabels.de),
								lessonType: sanitizeLabel(lessonType),
								room: roomRaw,
								groupCode: group.codeRaw,
								originGroupCode: group.codeRaw,
								track,
								cohortCode,
								scope
							});
						}
					}
				}
			}

			for (let c = col; c < Math.min(occupancy.length, col + colSpan); c += 1) {
				occupancy[c] = Math.max(occupancy[c]!, rowSpan);
			}
			col += colSpan;
		}

		for (let c = 0; c < occupancy.length; c += 1) {
			if (occupancy[c]! > 0) occupancy[c]! -= 1;
		}
	}

	const cohortMap = new Map<string, Cohort>();
	for (const event of events) {
		if (!event.cohortCode || event.track === 'none') {
			continue;
		}
		const current = cohortMap.get(event.cohortCode);
		if (!current) {
			cohortMap.set(event.cohortCode, {
				code: event.cohortCode,
				track: event.track,
				label: event.subjectFullRu || event.subjectShortRu,
				sourceGroups: [group.codeRaw]
			});
		} else if (!current.sourceGroups.includes(group.codeRaw)) {
			current.sourceGroups.push(group.codeRaw);
		}
	}

	events.sort(
		(a, b) =>
			a.dateIso.localeCompare(b.dateIso) ||
			a.startTime.localeCompare(b.startTime) ||
			a.subjectShortRaw.localeCompare(b.subjectShortRaw)
	);

	return { events, cohorts: Array.from(cohortMap.values()) };
}
