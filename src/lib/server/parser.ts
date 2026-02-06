import { parse as parseHtml5, serialize as serializeHtml5, type DefaultTreeAdapterTypes } from 'parse5';
import { cleanText, extractLessonType, germanOnlyLabel, leftSideCode, normalizeCodeKey, russianOnlyLabel, stripParenSuffix } from './text';
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

function normalizeHtml(input: string): string {
	return serializeHtml5(parseHtml5(input));
}

type ParseParentNode = Pick<DefaultTreeAdapterTypes.ParentNode, 'childNodes'>;
type ParseElement = DefaultTreeAdapterTypes.Element;
type ParseNode = DefaultTreeAdapterTypes.Node;

function isElement(node: ParseNode | undefined): node is ParseElement {
	return Boolean(node && typeof node === 'object' && 'tagName' in node);
}

function isTextNode(node: ParseNode): node is DefaultTreeAdapterTypes.TextNode {
	return node.nodeName === '#text';
}

function attrValue(node: ParseElement, key: string): string | null {
	return node.attrs.find((attr) => attr.name.toLowerCase() === key.toLowerCase())?.value ?? null;
}

function nodeText(node: ParseNode): string {
	if (isTextNode(node)) return node.value;
	if (!('childNodes' in node) || !Array.isArray(node.childNodes)) return '';
	return node.childNodes.map((child) => nodeText(child)).join('');
}

function findFirstByTag(parent: ParseParentNode, tag: string): ParseElement | null {
	const needle = tag.toLowerCase();
	const stack: ParseNode[] = [...parent.childNodes];
	while (stack.length > 0) {
		const current = stack.shift();
		if (!current) continue;
		if (isElement(current) && current.tagName.toLowerCase() === needle) return current;
		if ('childNodes' in current && Array.isArray(current.childNodes)) {
			stack.unshift(...current.childNodes);
		}
	}
	return null;
}

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
	const normalized = normalizeHtml(html);
	const weekSelectMatch = normalized.match(/<select\s+name="week"[\s\S]*?<\/select>/i);
	if (!weekSelectMatch) throw new Error('Week select not found in navbar');

	const weekOptions: WeekOption[] = [];
	for (const match of weekSelectMatch[0].matchAll(/<option\s+value="(\d+)">([^<]+)<\/option>/gi)) {
		const value = match[1]!.padStart(2, '0');
		const label = cleanText(match[2]!);
		weekOptions.push({ value, label, startDateIso: parseWeekLabelDate(label) });
	}

	const classesMatch = normalized.match(/var\s+classes\s*=\s*\[([\s\S]*?)\];/i);
	if (!classesMatch) throw new Error('Classes array not found in navbar');

	const groups: GroupOption[] = parseJsStringArray(classesMatch[1]!).map((codeRaw, idx) => ({
		id: idx + 1,
		codeRaw: cleanText(codeRaw),
		codeRu: sanitizeLabel(stripParenSuffix(russianOnlyLabel(codeRaw))),
		codeDe: sanitizeLabel(stripParenSuffix(germanOnlyLabel(codeRaw)))
	}));

	return { weeks: weekOptions, groups };
}

function directChildrenByTag(parent: ParseParentNode, tag: string): ParseElement[] {
	const needle = tag.toLowerCase();
	return parent.childNodes.filter((node) => isElement(node) && node.tagName.toLowerCase() === needle) as ParseElement[];
}

function parseLegendEntries(html: string, heading: string): Array<{ code: string; value: string }> {
	const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const pattern = new RegExp(`<B>${escaped}<\\/B>[\\s\\S]*?<TABLE[^>]*>([\\s\\S]*?)<\\/TABLE>`, 'i');
	const tableMatch = html.match(pattern);
	if (!tableMatch) return [];

	const cells = Array.from(tableMatch[1]!.matchAll(/<TD[^>]*>([\s\S]*?)<\/TD>/gi)).map((entry) =>
		cleanText(entry[1]!)
	);

	const output: Array<{ code: string; value: string }> = [];
	for (let i = 0; i + 1 < cells.length; i += 2) {
		const code = cells[i];
		const value = cells[i + 1];
		if (!code || !value) continue;
		if (code === 'Имя' || value === 'Полное назв/имя') continue;
		if (code === '&nbsp;' || value === '&nbsp;') continue;
		output.push({ code, value });
	}
	return output;
}

function makeLegendResolver(entries: Array<{ code: string; value: string }>): (code: string) => string {
	const byFull = new Map<string, string>();
	const byLeft = new Map<string, string>();

	for (const entry of entries) {
		const full = normalizeCodeKey(entry.code);
		const left = leftSideCode(entry.code);
		byFull.set(full, entry.value);
		byLeft.set(left, entry.value);
	}

	return (code: string): string => {
		const full = normalizeCodeKey(code);
		const left = leftSideCode(code);
		return byFull.get(full) ?? byLeft.get(left) ?? '';
	};
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

function extractCellLines(td: ParseElement): string[] {
	const nestedTable = findFirstByTag(td, 'table');
	if (!nestedTable) {
		const fallback = cleanText(nodeText(td));
		return fallback ? [fallback] : [];
	}

	const tbody = directChildrenByTag(nestedTable, 'tbody')[0] ?? nestedTable;
	const rows = directChildrenByTag(tbody, 'tr');
	const lines: string[] = [];
	for (const row of rows) {
		const cells = directChildrenByTag(row, 'td');
		if (cells.length === 0) continue;
		const value = cleanText(nodeText(cells[0]!));
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
	const normalized = cleanText(subjectCodeRaw).replace(/^\.+/, '');
	for (const rule of cohortCodeRules) {
		const m = rule.codePattern.exec(normalized);
		if (m) {
			const code = m[1] ? rule.code.replace('$1', String(Number(m[1]))) : rule.code;
			return { code, track: rule.track };
		}
	}
	return null;
}

/** Strip trailing slashes, leading dashes and other source data artifacts */
function sanitizeLabel(value: string): string {
	return value.replace(/\/$/, '').replace(/^-+/, '').trim();
}

const CYRILLIC_START_AFTER_SLASH = /^[А-Яа-яЁёҚқӘәҒғҢңӨөҰұҮүІіҺһ]/;

/** Detect bilingual names where the part after "/" is Kazakh, not German */
function isMissingGermanName(subjectFullRaw: string): boolean {
	const slashIdx = subjectFullRaw.indexOf('/');
	if (slashIdx === -1) return false;
	const afterSlash = subjectFullRaw.slice(slashIdx + 1).trim();
	return CYRILLIC_START_AFTER_SLASH.test(afterSlash);
}

function stableEventId(input: string): string {
	let hash = 2166136261;
	for (let i = 0; i < input.length; i += 1) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return `e${(hash >>> 0).toString(16)}`;
}

export function parseTimetablePage(
	html: string,
	group: GroupOption,
	week: WeekOption
): Pick<GroupWeekSchedule, 'events' | 'cohorts'> {
	const normalized = normalizeHtml(html);
	const document = parseHtml5(normalized);
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
	const dayDates = parseDayDates(normalized, week.startDateIso);

	const subjectResolver = makeLegendResolver(parseLegendEntries(normalized, 'Дисциплины'));

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
				const periodRange = parseTimeRange(cleanText(nodeText(cell)));
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
						const endRange = rowTimes[Math.min(rows.length - 1, rowIndex + rowSpan - 1)] ?? startRange;
						if (startRange && endRange) {
							const subjectFullRaw = subjectResolver(subjectRaw);
							const noGerman = isMissingGermanName(subjectFullRaw);
							const lessonType = noGerman ? '' : extractLessonType(subjectFullRaw);
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
								subjectShortRu: sanitizeLabel(russianOnlyLabel(subjectRaw)),
								subjectShortDe: noGerman ? sanitizeLabel(russianOnlyLabel(subjectRaw)) : sanitizeLabel(germanOnlyLabel(subjectRaw)),
								subjectFullRaw,
								subjectFullRu: sanitizeLabel(russianOnlyLabel(subjectFullRaw)),
								subjectFullDe: noGerman ? sanitizeLabel(russianOnlyLabel(subjectFullRaw)) : sanitizeLabel(germanOnlyLabel(subjectFullRaw)),
								lessonType: sanitizeLabel(lessonType),
								room: cleanText(roomRaw),
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

	events.sort((a, b) =>
		a.dateIso.localeCompare(b.dateIso) || a.startTime.localeCompare(b.startTime) || a.subjectShortRaw.localeCompare(b.subjectShortRaw)
	);

	return { events, cohorts: Array.from(cohortMap.values()) };
}
