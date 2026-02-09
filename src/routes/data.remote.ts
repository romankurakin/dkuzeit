import { query } from '$app/server';
import { getMeta, buildMergedSchedule } from '$lib/server/dku';
import type { GroupOption, WeekOption, LessonEvent, Cohort } from '$lib/server/types';

function resolveGroup(groups: GroupOption[], param: string): string {
	if (!param) return groups[0]?.codeRaw ?? '';
	const match = groups.find(
		(g) => g.codeRaw === param || g.codeRu === param || g.codeDe === param
	);
	return match?.codeRaw ?? groups[0]?.codeRaw ?? '';
}

function resolveWeek(weeks: WeekOption[]): string {
	if (weeks.length === 0) return '';
	const now = new Date();
	const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' });
	const dowFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Almaty', weekday: 'short' });
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

export const fetchMeta = query(async () => {
	const meta = await getMeta();
	return {
		groups: meta.groups,
		weeks: meta.weeks,
		resolvedWeek: resolveWeek(meta.weeks)
	};
});

export const fetchSchedule = query(
	'unchecked',
	async (args: { group: string; week: string }) => {
		const meta = await getMeta();
		const groupCode = resolveGroup(meta.groups, args.group);
		const weekValue = args.week || resolveWeek(meta.weeks);

		if (!groupCode || !weekValue) {
			return {
				events: [] as LessonEvent[],
				cohorts: [] as Cohort[],
				resolvedGroup: groupCode,
				resolvedWeek: weekValue
			};
		}

		try {
			const schedule = await buildMergedSchedule(groupCode, weekValue, []);
			return {
				events: schedule.events,
				cohorts: schedule.cohorts,
				resolvedGroup: groupCode,
				resolvedWeek: weekValue
			};
		} catch {
			return {
				events: [] as LessonEvent[],
				cohorts: [] as Cohort[],
				resolvedGroup: groupCode,
				resolvedWeek: weekValue
			};
		}
	}
);
