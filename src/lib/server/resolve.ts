import { toSlug } from '$lib/url-slug';
import { todayInAlmaty, isSundayInAlmaty } from './time';
import type { GroupOption, WeekOption } from './types';

export function resolveGroup(groups: GroupOption[], param: string): string {
	if (!param) return groups[0]?.codeRaw ?? '';
	const exactRaw = groups.find((g) => g.codeRaw === param);
	if (exactRaw) return exactRaw.codeRaw;

	const exactRu = groups.find((g) => g.codeRu === param);
	if (exactRu) return exactRu.codeRaw;

	const exactDe = groups.find((g) => g.codeDe === param);
	if (exactDe) return exactDe.codeRaw;

	const bySlug = groups.filter((g) => toSlug(g.codeRu) === param);
	if (bySlug.length === 1) return bySlug[0]!.codeRaw;
	return '';
}

export function resolveWeekByDate(weeks: WeekOption[]): string {
	if (weeks.length === 0) return '';
	const now = new Date();
	let target = todayInAlmaty(now);
	// On Sunday, start looking from Monday (next week)
	if (isSundayInAlmaty(now)) {
		target = todayInAlmaty(new Date(now.getTime() + 86_400_000));
	}
	let earliest = weeks[0]!;
	let best: WeekOption | null = null;
	for (const week of weeks) {
		if (week.startDateIso < earliest.startDateIso) earliest = week;
		if (week.startDateIso > target) continue;
		if (!best || week.startDateIso > best.startDateIso) best = week;
	}
	return (best ?? earliest).value;
}

export function resolveWeek(weeks: WeekOption[], param: string): string {
	if (!param) return resolveWeekByDate(weeks);
	const match = weeks.find((w) => w.value === param);
	return match?.value ?? resolveWeekByDate(weeks);
}

export function resolveWeekWithFloor(weeks: WeekOption[], param: string): string {
	const auto = resolveWeekByDate(weeks);
	if (!param) return auto;
	const selected = weeks.find((w) => w.value === param);
	if (!selected) return auto;
	const autoWeek = weeks.find((w) => w.value === auto);
	if (!autoWeek) return selected.value;
	if (selected.startDateIso < autoWeek.startDateIso) return autoWeek.value;
	return selected.value;
}

export function groupSlug(groups: GroupOption[], codeRaw: string): string {
	const group = groups.find((g) => g.codeRaw === codeRaw);
	return group ? toSlug(group.codeRu) : toSlug(codeRaw);
}
