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
import { makeLegendResolver, parseLegendEntries } from './legend';
import { isMissingGermanName, sanitizeLabel, splitBilingualLabel } from './bilingual';
import { runHtmlRewriter } from './html-rewriter-runtime';

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

function collapseSpaces(input: string): string {
	return input.replace(/[\s\u00a0]+/g, ' ').trim();
}

interface ParsedCell {
	colSpan: number;
	rowSpan: number;
	fallbackText: string;
	nestedLines: string[];
}

interface ParsedRow {
	cells: ParsedCell[];
}

interface OpenNestedRow {
	capture: boolean;
	cellIndex: number;
	firstCellBuffer: string | null;
}

interface OpenMainCell {
	cell: ParsedCell;
	nestedTableDepth: number;
	targetNestedTableDepth: number | null;
	nestedRows: OpenNestedRow[];
}

function extractCellLines(cell: ParsedCell): string[] {
	if (cell.nestedLines.length > 0) return cell.nestedLines;
	const fallback = collapseSpaces(cell.fallbackText);
	return fallback ? [fallback] : [];
}

async function collectMainTableRows(
	html: string
): Promise<{ rows: ParsedRow[]; foundMainTable: boolean }> {
	const rows: ParsedRow[] = [];
	let centerTableCount = 0;
	let insideMainTable = false;
	let foundMainTable = false;
	let activeMainRow: ParsedRow | null = null;
	let activeMainCell: OpenMainCell | null = null;

	await runHtmlRewriter(html, (rewriter) => {
		rewriter.on('center > table', {
			element(element) {
				centerTableCount += 1;
				const isMainTable = centerTableCount === 1;
				if (isMainTable) {
					foundMainTable = true;
					insideMainTable = true;
				}

				element.onEndTag(() => {
					if (isMainTable) insideMainTable = false;
				});
			}
		});

		rewriter.on('center > table > tbody > tr, center > table > tr', {
			element(element) {
				if (!insideMainTable) return;
				const row: ParsedRow = { cells: [] };
				activeMainRow = row;

				element.onEndTag(() => {
					rows.push(row);
					if (activeMainRow === row) activeMainRow = null;
				});
			}
		});

		rewriter.on('center > table > tbody > tr > td, center > table > tr > td', {
			element(element) {
				if (!insideMainTable || !activeMainRow) return;

				const colSpanRaw = Number(element.getAttribute('colspan') ?? '1');
				const rowSpanRaw = Number(element.getAttribute('rowspan') ?? '1');
				const parsedCell: ParsedCell = {
					colSpan: Number.isFinite(colSpanRaw) && colSpanRaw > 0 ? colSpanRaw : 1,
					rowSpan: Number.isFinite(rowSpanRaw) && rowSpanRaw > 0 ? rowSpanRaw : 1,
					fallbackText: '',
					nestedLines: []
				};
				activeMainRow.cells.push(parsedCell);

				const openCell: OpenMainCell = {
					cell: parsedCell,
					nestedTableDepth: 0,
					targetNestedTableDepth: null,
					nestedRows: []
				};
				activeMainCell = openCell;

				element.onEndTag(() => {
					if (activeMainCell === openCell) activeMainCell = null;
				});
			},
			text(text) {
				if (!insideMainTable || !activeMainCell) return;
				activeMainCell.cell.fallbackText += text.text;
			}
		});

		rewriter.on('center > table > tbody > tr > td table, center > table > tr > td table', {
			element(element) {
				const openCell = activeMainCell;
				if (!insideMainTable || !openCell) return;

				openCell.nestedTableDepth += 1;
				const depthAtEntry = openCell.nestedTableDepth;
				if (openCell.targetNestedTableDepth === null) {
					openCell.targetNestedTableDepth = depthAtEntry;
				}

				element.onEndTag(() => {
					openCell.nestedTableDepth = Math.max(0, openCell.nestedTableDepth - 1);
				});
			}
		});

		rewriter.on('center > table > tbody > tr > td table tr, center > table > tr > td table tr', {
			element(element) {
				const openCell = activeMainCell;
				if (!insideMainTable || !openCell) return;

				const targetDepth = openCell.targetNestedTableDepth;
				const nestedRow: OpenNestedRow = {
					capture: targetDepth !== null && openCell.nestedTableDepth === targetDepth,
					cellIndex: 0,
					firstCellBuffer: null
				};
				openCell.nestedRows.push(nestedRow);

				element.onEndTag(() => {
					const idx = openCell.nestedRows.lastIndexOf(nestedRow);
					if (idx >= 0) openCell.nestedRows.splice(idx, 1);
				});
			}
		});

		rewriter.on(
			'center > table > tbody > tr > td table tr > td, center > table > tr > td table tr > td',
			{
				element(element) {
					const openCell = activeMainCell;
					if (!insideMainTable || !openCell) return;

					const nestedRow = openCell.nestedRows[openCell.nestedRows.length - 1];
					if (!nestedRow || !nestedRow.capture) return;

					const currentCellIndex = nestedRow.cellIndex;
					nestedRow.cellIndex += 1;
					if (currentCellIndex !== 0) return;

					nestedRow.firstCellBuffer = '';
					element.onEndTag(() => {
						const raw = nestedRow.firstCellBuffer;
						nestedRow.firstCellBuffer = null;
						if (typeof raw !== 'string') return;
						const value = collapseSpaces(raw);
						if (value) openCell.cell.nestedLines.push(value);
					});
				},
				text(text) {
					const openCell = activeMainCell;
					if (!insideMainTable || !openCell) return;

					const nestedRow = openCell.nestedRows[openCell.nestedRows.length - 1];
					if (!nestedRow || !nestedRow.capture) return;
					if (nestedRow.firstCellBuffer === null) return;

					const targetDepth = openCell.targetNestedTableDepth;
					if (targetDepth === null || openCell.nestedTableDepth !== targetDepth) return;
					nestedRow.firstCellBuffer += text.text;
				}
			}
		);
	});

	return { rows, foundMainTable };
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

// Regex check for events on a timetable page
export function hasEvents(html: string): boolean {
	return parseLegendEntries(html, 'Дисциплины').length > 0;
}

export async function parseTimetablePage(
	html: string,
	group: GroupOption,
	week: WeekOption
): Promise<Pick<GroupWeekSchedule, 'events' | 'cohorts'>> {
	if (!/<center\b/i.test(html)) throw new Error('Timetable center container not found');

	const { rows, foundMainTable } = await collectMainTableRows(html);
	if (!foundMainTable) throw new Error('Main timetable table not found');
	if (rows.length === 0) throw new Error('No rows in timetable table');

	const firstRowCells = rows[0]!.cells;
	const colCount = firstRowCells.reduce((acc, cell) => {
		return acc + cell.colSpan;
	}, 0);

	const occupancy = new Array<number>(Math.max(colCount, 1)).fill(0);
	const rowTimes: Array<{ start: string; end: string } | null> = new Array(rows.length).fill(null);
	const dayDates = parseDayDates(html, week.startDateIso);

	const subjectResolver = makeLegendResolver(parseLegendEntries(html, 'Дисциплины'));

	const events: LessonEvent[] = [];

	for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
		const row = rows[rowIndex]!;
		const cells = row.cells;
		let col = 0;

		for (const cell of cells) {
			while (col < occupancy.length && occupancy[col]! > 0) col += 1;

			const colSpan = cell.colSpan;
			const rowSpan = cell.rowSpan;

			if (col === 0) {
				const periodRange = parseTimeRange(collapseSpaces(cell.fallbackText));
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
