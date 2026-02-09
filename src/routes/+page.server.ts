import { buildMergedSchedule, getMeta, CLIENT_CACHE_HEADER } from '$lib/server/dku';
import { ALMATY_TIME_ZONE } from '$lib/server/time';
import type { Cohort, GroupOption, LessonEvent, WeekOption } from '$lib/server/types';
import type { PageServerLoad } from './$types';

function resolveGroup(groups: GroupOption[], param: string): string {
	if (!param) return groups[0]?.codeRaw ?? '';
	const match = groups.find((g) => g.codeRaw === param || g.codeRu === param || g.codeDe === param);
	return match?.codeRaw ?? groups[0]?.codeRaw ?? '';
}

function resolveWeekByDate(weeks: WeekOption[]): string {
	if (weeks.length === 0) return '';
	const now = new Date();
	const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: ALMATY_TIME_ZONE });
	const dowFmt = new Intl.DateTimeFormat('en-US', { timeZone: ALMATY_TIME_ZONE, weekday: 'short' });
	let target = dateFmt.format(now);
	if (dowFmt.format(now) === 'Sun') {
		target = dateFmt.format(new Date(now.getTime() + 86_400_000));
	}
	let best = weeks[0]!.value;
	for (const week of weeks) {
		if (week.startDateIso <= target) best = week.value;
	}
	return best;
}

function resolveWeek(weeks: WeekOption[], param: string): string {
	if (!param) return resolveWeekByDate(weeks);
	const match = weeks.find((w) => w.value === param);
	return match?.value ?? resolveWeekByDate(weeks);
}

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	setHeaders({ 'cache-control': CLIENT_CACHE_HEADER });
	const meta = await getMeta();
	const groupCode = resolveGroup(meta.groups, url.searchParams.get('group') ?? '');
	const weekValue = resolveWeek(meta.weeks, url.searchParams.get('week') ?? '');
	if (!groupCode || !weekValue) {
		return {
			meta: { groups: meta.groups, weeks: meta.weeks, resolvedWeek: weekValue },
			schedule: {
				events: [],
				cohorts: [],
				resolvedGroup: groupCode,
				resolvedWeek: weekValue
			}
		};
	}

	let events: LessonEvent[] = [];
	let cohorts: Cohort[] = [];
	try {
		const merged = await buildMergedSchedule(groupCode, weekValue, []);
		events = merged.events;
		cohorts = merged.cohorts;
	} catch {
		/* keep empty schedule */
	}
	return {
		meta: { groups: meta.groups, weeks: meta.weeks, resolvedWeek: weekValue },
		schedule: {
			events,
			cohorts,
			resolvedGroup: groupCode,
			resolvedWeek: weekValue
		}
	};
};
