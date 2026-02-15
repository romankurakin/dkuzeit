import type { Cohort, LessonEvent } from '$lib/server/types';
import type { CohortGroup } from './types';

export function filterDisplayEvents(
	events: LessonEvent[],
	cohorts: Cohort[],
	urlCohorts: string[],
	categoryLabels: Record<string, string>
): LessonEvent[] {
	const codeToCategory = new Map(cohorts.map((c) => [c.code, c.track] as const));
	const selectedCodes = new Set(urlCohorts);
	const selectedCategories = new Set<Cohort['track']>();
	for (const code of urlCohorts) {
		const category = codeToCategory.get(code);
		if (category) selectedCategories.add(category);
	}

	const result: LessonEvent[] = [];
	const toCollapse = new Map<string, { category: string; events: LessonEvent[] }>();

	for (const event of events) {
		if (event.scope === 'core_fixed' || !event.cohortCode) {
			result.push(event);
			continue;
		}
		const cat = codeToCategory.get(event.cohortCode);
		if (!cat) {
			result.push(event);
			continue;
		}
		if (selectedCategories.has(cat)) {
			if (selectedCodes.has(event.cohortCode)) {
				result.push(event);
			}
		} else {
			const key = `${event.dateIso}|${event.startTime}|${event.endTime}|${cat}`;
			const bucket = toCollapse.get(key) ?? { category: cat, events: [] };
			bucket.events.push(event);
			toCollapse.set(key, bucket);
		}
	}

	for (const { category, events: groupedEvents } of toCollapse.values()) {
		const first = groupedEvents[0]!;
		const label = categoryLabels[category] ?? category;
		result.push({
			...first,
			id: first.id + '_merged',
			subjectShortRu: label,
			subjectFullRu: label,
			subjectShortDe: label,
			subjectFullDe: label,
			lessonType: '',
			cohortCode: null,
			room: ''
		});
	}

	result.sort(
		(a, b) => a.dateIso.localeCompare(b.dateIso) || a.startTime.localeCompare(b.startTime)
	);
	return result;
}

export function groupEventsByDate(events: LessonEvent[]): Record<string, LessonEvent[]> {
	const acc: Record<string, LessonEvent[]> = {};
	for (const event of events) {
		if (!acc[event.dateIso]) acc[event.dateIso] = [];
		acc[event.dateIso]!.push(event);
	}
	return acc;
}

export function extractTimeSlots(
	events: LessonEvent[]
): Array<{ key: string; start: string; end: string }> {
	const seen = new Map<string, { start: string; end: string }>();
	for (const event of events) {
		const key = `${event.startTime}-${event.endTime}`;
		if (!seen.has(key)) seen.set(key, { start: event.startTime, end: event.endTime });
	}
	return [...seen.entries()]
		.sort(([, a], [, b]) => a.start.localeCompare(b.start))
		.map(([key, v]) => ({ key, ...v }));
}

export function buildCohortGroups(
	cohorts: Cohort[],
	categoryLabels: Record<string, string>,
	urlCohorts: string[]
): CohortGroup[] {
	const selectedCodes = new Set(urlCohorts);
	const map = new Map<string, CohortGroup>();
	for (const c of cohorts) {
		const cat = c.track;
		if (!map.has(cat)) {
			map.set(cat, { label: categoryLabels[cat] ?? cat, items: [], value: '' });
		}
		const group = map.get(cat)!;
		group.items.push({ value: c.code, label: c.code });
		if (selectedCodes.has(c.code)) {
			group.value = c.code;
		}
	}
	return [...map.values()];
}

export function eventTitleLabel(event: LessonEvent, uiLocale: 'ru' | 'de'): string {
	let base: string;
	if (uiLocale === 'de') {
		base =
			event.subjectFullDe || event.subjectShortDe || event.subjectFullRu || event.subjectShortRu;
	} else {
		base =
			event.subjectFullRu || event.subjectShortRu || event.subjectFullDe || event.subjectShortDe;
	}
	return event.cohortCode ? `${base} ${event.cohortCode}` : base;
}
