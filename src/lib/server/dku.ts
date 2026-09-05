import { cleanText } from './text';
import { parseNavHtml, parseTimetablePage } from './parser';
import type { GroupWeekSchedule, LessonEvent, MetaPayload, WeekOption } from './types';
import { todayInAlmaty } from './time';
import {
	cached,
	fetchDocument,
	META_CACHE_POLICY,
	SCHEDULE_CACHE_POLICY,
	type DkuRequestContext
} from './dku-fetch';
import { recordTimetableOutput } from './metrics';
import { traceSpan } from './tracing';

export { API_RESPONSE_CACHE_HEADER } from './dku-fetch';

export function isUnknownEntityError(err: unknown): boolean {
	if (!(err instanceof Error)) return false;
	return /^Unknown (group|week): /.test(err.message);
}

export interface DkuRequestOptions {
	meta?: MetaPayload;
	request?: DkuRequestContext;
}

export async function getMeta(request?: DkuRequestContext): Promise<MetaPayload> {
	return cached(
		'meta',
		() =>
			traceSpan(
				'resolve source page',
				'source.resolve',
				{ 'source.kind': 'meta', 'html.path': 'frames/navbar.htm' },
				async () => {
					const document = await fetchDocument('frames/navbar.htm', request?.tracing);
					return traceSpan(
						'extract timetable metadata from DOM',
						'timetable.extract',
						{
							'html.path': 'frames/navbar.htm',
							'html.phase': 'metadata.extract'
						},
						async (span) => {
							const meta = parseNavHtml(document);
							span.setAttribute('timetable.group_count', meta.groups.length);
							span.setAttribute('timetable.week_count', meta.weeks.length);
							return meta;
						},
						request?.tracing
					);
				},
				request?.tracing
			),
		request,
		META_CACHE_POLICY
	);
}

async function getSchedule(
	meta: MetaPayload,
	groupCode: string,
	weekValue: string,
	request?: DkuRequestContext
): Promise<GroupWeekSchedule> {
	const week = meta.weeks.find((w) => w.value === weekValue);
	if (!week) throw new Error(`Unknown week: ${weekValue}`);
	const group = meta.groups.find((g) => g.codeRaw === groupCode || g.codeRu === groupCode);
	if (!group) throw new Error(`Unknown group: ${groupCode}`);

	return cached(
		`schedule:${week.value}:${group.id}`,
		() => {
			const path = `${week.value}/c/c${String(group.id).padStart(5, '0')}.htm`;
			return traceSpan(
				'resolve source page',
				'source.resolve',
				{ 'source.kind': 'schedule', 'html.path': path, group: group.codeRaw, week: week.value },
				async () => {
					const document = await fetchDocument(path, request?.tracing);
					const parsed = await traceSpan(
						'extract timetable from DOM',
						'timetable.extract',
						{
							group: group.codeRaw,
							week: week.value,
							'html.path': path,
							'html.phase': 'schedule.extract'
						},
						async (span) => {
							const result = parseTimetablePage(document, group, week);
							span.setAttribute('timetable.event_count', result.events.length);
							span.setAttribute('timetable.cohort_count', result.cohorts.length);
							recordTimetableOutput(result.events.length, result.cohorts.length);
							return result;
						},
						request?.tracing
					);
					return { group, week, events: parsed.events, cohorts: parsed.cohorts };
				},
				request?.tracing
			);
		},
		request,
		SCHEDULE_CACHE_POLICY
	);
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
	opts: DkuRequestOptions = {}
): Promise<GroupWeekSchedule> {
	const resolvedMeta = opts.meta ?? (await getMeta(opts.request));
	const core = await getSchedule(resolvedMeta, groupCode, weekValue, opts.request);
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
