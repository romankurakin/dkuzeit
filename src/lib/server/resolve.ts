import { toSlug } from '$lib/url-slug';
import { ALMATY_TIME_ZONE } from './time';
import type { GroupOption, WeekOption } from './types';

export function resolveGroup(groups: GroupOption[], param: string): string {
	if (!param) return groups[0]?.codeRaw ?? '';
	const match = groups.find(
		(g) =>
			g.codeRaw === param || g.codeRu === param || g.codeDe === param || toSlug(g.codeRu) === param
	);
	return match?.codeRaw ?? '';
}

export function resolveWeekByDate(weeks: WeekOption[]): string {
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

export function resolveWeek(weeks: WeekOption[], param: string): string {
	if (!param) return resolveWeekByDate(weeks);
	const match = weeks.find((w) => w.value === param);
	return match?.value ?? resolveWeekByDate(weeks);
}

export function groupSlug(groups: GroupOption[], codeRaw: string): string {
	const group = groups.find((g) => g.codeRaw === codeRaw);
	return group ? toSlug(group.codeRu) : toSlug(codeRaw);
}
