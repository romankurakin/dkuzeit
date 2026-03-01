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
import { parseDocument } from 'htmlparser2';
import type { ChildNode, Element } from 'domhandler';

type TimeRange = { start: string; end: string };

function parseWeekLabelDate(label: string): string | null {
	const match = label.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
	if (!match) return null;
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

function preserveYearPrefixForGermanGroupCode(codeRu: string, codeDe: string): string {
	const normalizedDe = codeDe.replace(/^-+/, '');
	if (!normalizedDe || /^\d/.test(normalizedDe)) return normalizedDe;

	const year = codeRu.match(/^(\d+)/)?.[1];
	if (!year) return normalizedDe;

	// Keep A/B-like subgroup markers compact: 1 + A-IB => 1A-IB
	if (/^[A-Za-z]-/.test(normalizedDe)) return `${year}${normalizedDe}`;
	return `${year}-${normalizedDe}`;
}

export function parseNavHtml(html: string): MetaPayload {
	const weekSelectMatch = html.match(/<select\s+name="week"[\s\S]*?<\/select>/i);
	if (!weekSelectMatch) throw new Error('Week select not found in navbar');

	const weekOptions: WeekOption[] = [];
	for (const match of weekSelectMatch[0].matchAll(/<option\s+value="(\d+)">([^<]+)<\/option>/gi)) {
		const value = match[1]!.padStart(2, '0');
		const label = cleanText(match[2]!);
		const startDateIso = parseWeekLabelDate(label);
		if (!startDateIso) continue;
		weekOptions.push({ value, label, startDateIso });
	}

	const classesMatch = html.match(/var\s+classes\s*=\s*\[([\s\S]*?)\];/i);
	if (!classesMatch) throw new Error('Classes array not found in navbar');

	const groups: GroupOption[] = parseJsStringArray(classesMatch[1]!).map((codeRaw, idx) => {
		const codeRu = sanitizeLabel(stripParenSuffix(russianOnlyLabel(codeRaw)));
		const codeDeRaw = sanitizeLabel(stripParenSuffix(germanOnlyLabel(codeRaw)));
		return {
			id: idx + 1,
			codeRaw: cleanText(codeRaw),
			codeRu,
			codeDe: preserveYearPrefixForGermanGroupCode(codeRu, codeDeRaw)
		};
	});

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

function isDateMarkerCell(value: string): boolean {
	// Day-block marker in source tables, not a real lesson
	// Examples: 23.3.2026 or 23.3.2026-23.3.2026
	return /^\d{1,2}\.\d{1,2}\.\d{4}(?:\s*-\s*\d{1,2}\.\d{1,2}\.\d{4})?$/.test(value);
}

function isUnknownPlaceholderSubject(value: string): boolean {
	// Unknown slots in upstream tables (mostly admin pages): "?"
	return /^\?+$/.test(value.trim());
}

function isRenderableSubject(value: string): boolean {
	return value.length > 0 && !value.includes('________________') && !isDateMarkerCell(value);
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

function extractCellLines(cell: ParsedCell): string[] {
	if (cell.nestedLines.length > 0) return cell.nestedLines;
	const fallback = collapseSpaces(cell.fallbackText);
	return fallback ? [fallback] : [];
}

function isElementNode(node: ChildNode): node is Element {
	return node.type === 'tag' || node.type === 'script' || node.type === 'style';
}

function hasChildren(node: ChildNode | Element): node is ChildNode & { children: ChildNode[] } {
	return 'children' in node && Array.isArray(node.children);
}

function collectText(node: ChildNode): string {
	if (node.type === 'text') return node.data;
	if (!hasChildren(node)) return '';
	let out = '';
	for (const child of node.children) out += collectText(child);
	return out;
}

function collectTextWithoutNestedTables(node: ChildNode, insideTable: boolean): string {
	if (node.type === 'text') return insideTable ? '' : node.data;
	if (!hasChildren(node)) return '';

	const nextInsideTable = insideTable || (isElementNode(node) && node.name === 'table');
	let out = '';
	for (const child of node.children) out += collectTextWithoutNestedTables(child, nextInsideTable);
	return out;
}

function findFirstDescendantTable(node: Element): Element | null {
	for (const child of node.children) {
		if (!isElementNode(child)) continue;
		if (child.name === 'table') return child;
		const nested = findFirstDescendantTable(child);
		if (nested) return nested;
	}
	return null;
}

function collectFirstLevelRows(table: Element): Element[] {
	const rows: Element[] = [];

	const walk = (nodes: ChildNode[], nearestTable: Element) => {
		for (const node of nodes) {
			if (!isElementNode(node)) continue;
			if (node.name === 'tr' && nearestTable === table) rows.push(node);
			const childNearestTable = node.name === 'table' ? node : nearestTable;
			walk(node.children, childNearestTable);
		}
	};

	walk(table.children, table);
	return rows;
}

function collectNestedLines(cellElement: Element): string[] {
	const firstNestedTable = findFirstDescendantTable(cellElement);
	if (!firstNestedTable) return [];

	const lines: string[] = [];
	for (const row of collectFirstLevelRows(firstNestedTable)) {
		let firstTd: Element | null = null;
		for (const child of row.children) {
			if (isElementNode(child) && child.name === 'td') {
				firstTd = child;
				break;
			}
		}
		if (!firstTd) continue;
		const value = collapseSpaces(collectTextWithoutNestedTables(firstTd, false));
		if (value) lines.push(value);
	}
	return lines;
}

function parsePositiveSpan(value: string | undefined): number {
	const parsed = Number(value ?? '1');
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function collectRowCells(row: Element): ParsedCell[] {
	const cells: ParsedCell[] = [];
	for (const child of row.children) {
		if (!isElementNode(child) || child.name !== 'td') continue;
		cells.push({
			colSpan: parsePositiveSpan(child.attribs.colspan),
			rowSpan: parsePositiveSpan(child.attribs.rowspan),
			fallbackText: collectText(child),
			nestedLines: collectNestedLines(child)
		});
	}
	return cells;
}

function collectDistinctPeriods(
	rowTimes: Array<TimeRange | null>,
	startRow: number,
	rowSpan: number,
	rowCount: number
): TimeRange[] {
	const periods: TimeRange[] = [];
	const seen = new Set<string>();
	for (let row = startRow; row < Math.min(rowCount, startRow + rowSpan); row += 1) {
		const range = rowTimes[row];
		if (!range) continue;
		const key = `${range.start}-${range.end}`;
		if (seen.has(key)) continue;
		seen.add(key);
		periods.push(range);
	}
	return periods;
}

function collectCohortsFromEvents(events: LessonEvent[], groupCodeRaw: string): Cohort[] {
	const cohortMap = new Map<string, Cohort>();
	for (const event of events) {
		if (!event.cohortCode || event.track === 'none') continue;

		const current = cohortMap.get(event.cohortCode);
		if (current) {
			if (!current.sourceGroups.includes(groupCodeRaw)) current.sourceGroups.push(groupCodeRaw);
			continue;
		}

		cohortMap.set(event.cohortCode, {
			code: event.cohortCode,
			track: event.track,
			label: event.subjectFullRu || event.subjectShortRu,
			sourceGroups: [groupCodeRaw]
		});
	}

	return Array.from(cohortMap.values());
}

function findFirstMainTable(node: ChildNode): Element | null {
	if (!hasChildren(node)) return null;

	if (isElementNode(node) && node.name === 'center') {
		for (const child of node.children) {
			if (isElementNode(child) && child.name === 'table') return child;
		}
	}

	for (const child of node.children) {
		const found = findFirstMainTable(child);
		if (found) return found;
	}
	return null;
}

function collectMainTableRows(html: string): { rows: ParsedRow[]; foundMainTable: boolean } {
	const document = parseDocument(html);
	const mainTable = findFirstMainTable(document);
	if (!mainTable) return { rows: [], foundMainTable: false };

	const rows: ParsedRow[] = [];
	for (const child of mainTable.children) {
		if (!isElementNode(child)) continue;
		if (child.name === 'tr') {
			rows.push({ cells: collectRowCells(child) });
			continue;
		}
		if (child.name !== 'tbody') continue;

		for (const bodyChild of child.children) {
			if (!isElementNode(bodyChild) || bodyChild.name !== 'tr') continue;
			rows.push({ cells: collectRowCells(bodyChild) });
		}
	}

	return { rows, foundMainTable: true };
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

	const { rows, foundMainTable } = collectMainTableRows(html);
	if (!foundMainTable) throw new Error('Main timetable table not found');
	if (rows.length === 0) throw new Error('No rows in timetable table');

	const firstRowCells = rows[0]!.cells;
	const colCount = firstRowCells.reduce((acc, cell) => {
		return acc + cell.colSpan;
	}, 0);

	const occupancy = new Array<number>(Math.max(colCount, 1)).fill(0);
	const rowTimes: Array<TimeRange | null> = new Array(rows.length).fill(null);
	const dayDates = parseDayDates(html, week.startDateIso);

	const subjectResolver = makeLegendResolver(parseLegendEntries(html, 'Дисциплины'));

	// Defer event creation until all rowTimes are populated so that
	// multi-period cells (rowspan > 2) can be split correctly
	interface DeferredEvent {
		dayIndex: number;
		subjectRaw: string;
		roomRaw: string;
		rowIndex: number;
		rowSpan: number;
	}

	const deferred: DeferredEvent[] = [];

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

				// Skip empty cells, placeholder underscores, and holiday date-only cells
				// (e.g. "23.3.2026" or "23.3.2026-23.3.2026" spanning the day column)
				if (isRenderableSubject(subjectRaw)) {
					const dayIndex = Math.floor((col - 1) / 12);
					if (dayIndex >= 0 && dayIndex < dayDates.length) {
						deferred.push({ dayIndex, subjectRaw, roomRaw, rowIndex, rowSpan });
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

	// Now that all rowTimes are known, create events and split
	// multi-period cells into one event per time slot
	const splitEvents: LessonEvent[] = [];
	const seenEventSeeds = new Set<string>();

	for (const d of deferred) {
		const legendFullRaw = subjectResolver(d.subjectRaw);
		if (isUnknownPlaceholderSubject(d.subjectRaw) && !legendFullRaw) continue;
		const hasLegendFull = legendFullRaw.trim().length > 0;
		const noGerman = isMissingGermanName(hasLegendFull ? legendFullRaw : d.subjectRaw);
		const shortLabels = splitBilingualLabel(d.subjectRaw, noGerman);
		const fullLabels = hasLegendFull
			? splitBilingualLabel(legendFullRaw, noGerman)
			: { ...shortLabels, lessonType: '' };
		const subjectFullRaw = hasLegendFull ? legendFullRaw : sanitizeLabel(shortLabels.ru);
		const lessonType = hasLegendFull && !noGerman ? fullLabels.lessonType : '';
		const cohort = extractCohortCode(d.subjectRaw);
		const nameTrack = detectTrack(subjectFullRaw);
		const track = nameTrack !== 'none' ? nameTrack : (cohort?.track ?? 'none');
		const cohortCode = cohort && !genericCodes.has(cohort.code) ? cohort.code : null;
		const scope = cohortCode ? 'cohort_shared' : 'core_fixed';
		const dateIso = dayDates[d.dayIndex]!;

		const periods = collectDistinctPeriods(rowTimes, d.rowIndex, d.rowSpan, rows.length);

		for (const period of periods) {
			const eventSeed = `${group.codeRaw}|${dateIso}|${period.start}|${period.end}|${d.subjectRaw}|${d.roomRaw}|${cohortCode ?? ''}`;
			if (seenEventSeeds.has(eventSeed)) continue;
			seenEventSeeds.add(eventSeed);
			const id = stableEventId(eventSeed);

			splitEvents.push({
				id,
				dateIso,
				dayIndex: d.dayIndex,
				startTime: period.start,
				endTime: period.end,
				subjectShortRaw: d.subjectRaw,
				subjectShortRu: sanitizeLabel(shortLabels.ru),
				subjectShortDe: sanitizeLabel(shortLabels.de),
				subjectFullRaw,
				subjectFullRu: sanitizeLabel(fullLabels.ru),
				subjectFullDe: sanitizeLabel(fullLabels.de),
				lessonType: sanitizeLabel(lessonType),
				room: d.roomRaw,
				groupCode: group.codeRaw,
				originGroupCode: group.codeRaw,
				track,
				cohortCode,
				scope
			});
		}
	}

	splitEvents.sort(
		(a, b) =>
			a.dateIso.localeCompare(b.dateIso) ||
			a.startTime.localeCompare(b.startTime) ||
			a.subjectShortRaw.localeCompare(b.subjectShortRaw)
	);

	return { events: splitEvents, cohorts: collectCohortsFromEvents(splitEvents, group.codeRaw) };
}
