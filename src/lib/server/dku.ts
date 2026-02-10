import { cleanText } from './text';
import { parseNavHtml, parseTimetablePage } from './parser';
import type { GroupWeekSchedule, LessonEvent, MetaPayload, WeekOption } from './types';
import { todayInAlmaty } from './time';
import { cached, fetchText } from './dku-fetch';

export { CLIENT_CACHE_HEADER, CLIENT_TTL_SECONDS } from './dku-fetch';

export async function getMeta(): Promise<MetaPayload> {
	return cached('meta', async () => {
		const html = await fetchText('frames/navbar.htm');
		return parseNavHtml(html);
	});
}

async function getSchedule(
	meta: MetaPayload,
	groupCode: string,
	weekValue: string
): Promise<GroupWeekSchedule> {
	const week = meta.weeks.find((w) => w.value === weekValue);
	if (!week) throw new Error(`Unknown week: ${weekValue}`);
	const group = meta.groups.find((g) => g.codeRaw === groupCode || g.codeRu === groupCode);
	if (!group) throw new Error(`Unknown group: ${groupCode}`);

	return cached(`schedule:${week.value}:${group.id}`, async () => {
		const path = `${week.value}/c/c${String(group.id).padStart(5, '0')}.htm`;
		const parsed = await parseTimetablePage(await fetchText(path), group, week);
		return { group, week, events: parsed.events, cohorts: parsed.cohorts };
	});
}

const ASSESSMENT_RE =
	/\b(экзам|пересдач|зач[её]т|диф\.?\s*зач|коллоквиум|midterm|final|аттест|сесс)\b/i;

function isAssessment(e: LessonEvent): boolean {
	return ASSESSMENT_RE.test(
		`${e.subjectShortRaw} ${e.subjectFullRaw} ${e.subjectShortRu} ${e.subjectFullRu}`
	);
}

export async function buildMergedSchedule(
	groupCode: string,
	weekValue: string,
	selectedCohorts: string[],
	meta?: MetaPayload
): Promise<GroupWeekSchedule> {
	const resolvedMeta = meta ?? (await getMeta());
	const core = await getSchedule(resolvedMeta, groupCode, weekValue);
	const cohorts = [...core.cohorts].sort(
		(a, b) => a.track.localeCompare(b.track) || a.code.localeCompare(b.code)
	);

	if (selectedCohorts.length === 0) return { ...core, cohorts };

	const selected = new Set(selectedCohorts.map((s) => cleanText(s)));
	const events = core.events.filter(
		(e) =>
			e.scope === 'core_fixed' || isAssessment(e) || (e.cohortCode && selected.has(e.cohortCode))
	);
	return { ...core, events, cohorts };
}

export function buildCalendarTitle(groupCode: string): string {
	return `DKU ${groupCode}`;
}

export function pickRollingWeeksForCalendar(
	weeks: WeekOption[],
	anchor: string,
	opts: { now?: Date; windowSize?: number } = {}
): WeekOption[] {
	if (weeks.length === 0) return [];
	const sorted = [...weeks].sort((a, b) => a.startDateIso.localeCompare(b.startDateIso));
	const size = Math.max(1, opts.windowSize ?? 2);
	const today = todayInAlmaty(opts.now);

	const anchorIdx = sorted.findIndex((w) => w.value === anchor);
	const anchorDate = anchorIdx >= 0 ? sorted[anchorIdx]!.startDateIso : '';

	const idx =
		anchorDate > today
			? anchorIdx
			: sorted.reduce((acc, w, i) => (w.startDateIso <= today ? i : acc), 0);

	return sorted.slice(idx, idx + size);
}
