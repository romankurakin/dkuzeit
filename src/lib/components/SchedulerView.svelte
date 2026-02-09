<script lang="ts">
	import type { Snippet } from 'svelte';
	import { tick } from 'svelte';
	import { m } from '$lib/paraglide/messages';
	import { getLocale, localizeHref } from '$lib/paraglide/runtime';
	import type {
		GroupOption,
		Cohort,
		LessonEvent,
		WeekOption
	} from '$lib/components/timetable/types';
	import { buildSubjectColorMap } from '$lib/scheduler/subject-colors';
	import { formatDateLabel } from '$lib/scheduler/date-format';
	import type { SchedulerContext } from '$lib/scheduler/types';

	let {
		children,
		groups,
		weeks,
		events,
		cohorts,
		resolvedGroup,
		resolvedWeek,
		todayIso,
		urlCohorts,
		onGroupChange,
		onWeekChange,
		onCohortChange
	}: {
		children: Snippet<[SchedulerContext]>;
		groups: GroupOption[];
		weeks: WeekOption[];
		events: LessonEvent[];
		cohorts: Cohort[];
		resolvedGroup: string;
		resolvedWeek: string;
		todayIso: string;
		urlCohorts: string[];
		onGroupChange: (group: string) => void;
		onWeekChange: (week: string) => void;
		onCohortChange: (trackLabel: string, code: string) => void;
	} = $props();

	let isGeneratingLinks = $state(false);
	let copiedField = $state<'site' | 'calendar' | null>(null);
	let calendarWarning = $state('');
	let error = $state('');

	const uiLocale = $derived((getLocale() === 'de' ? 'de' : 'ru') as 'ru' | 'de');
	const categoryLabels = $derived<Record<string, string>>({
		de: m.category_de(),
		en: m.category_en(),
		kz: m.category_kz(),
		pe: m.category_pe()
	});

	function trackCategory(track: Cohort['track']): string {
		return track;
	}

	const displayEvents = $derived.by(() => {
		const codeToCategory = new Map<string, string>();
		for (const c of cohorts) {
			codeToCategory.set(c.code, trackCategory(c.track));
		}
		const selectedCodes = new Set(urlCohorts);
		const selectedCategories = new Set<string>();
		for (const code of urlCohorts) {
			const cat = codeToCategory.get(code);
			if (cat) selectedCategories.add(cat);
		}

		const result: LessonEvent[] = [];
		const toCollapse = new Map<string, LessonEvent[]>();

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
				if (!toCollapse.has(key)) toCollapse.set(key, []);
				toCollapse.get(key)!.push(event);
			}
		}

		for (const [key, group] of toCollapse) {
			const first = group[0]!;
			const cat = key.split('|')[3]!;
			const label = categoryLabels[cat] ?? cat;
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
	});

	const groupedEvents = $derived.by(() => {
		const acc: Record<string, LessonEvent[]> = {};
		for (const event of displayEvents) {
			if (!acc[event.dateIso]) acc[event.dateIso] = [];
			acc[event.dateIso]!.push(event);
		}
		return acc;
	});

	const orderedDates = $derived(Object.keys(groupedEvents).sort((a, b) => a.localeCompare(b)));
	const subjectColorMap = $derived(buildSubjectColorMap(displayEvents));

	const timeSlots = $derived.by(() => {
		const seen = new Map<string, { start: string; end: string }>();
		for (const event of displayEvents) {
			const key = `${event.startTime}-${event.endTime}`;
			if (!seen.has(key)) seen.set(key, { start: event.startTime, end: event.endTime });
		}
		return [...seen.entries()]
			.sort(([, a], [, b]) => a.start.localeCompare(b.start))
			.map(([key, v]) => ({ key, ...v }));
	});

	function getSlotEvents(date: string, slotKey: string): LessonEvent[] {
		return (groupedEvents[date] ?? []).filter((e) => `${e.startTime}-${e.endTime}` === slotKey);
	}

	const groupSelectItems = $derived(
		groups.map((group) => ({
			value: group.codeRaw,
			label: uiLocale === 'de' ? group.codeDe : group.codeRu
		}))
	);

	const weekSelectItems = $derived(weeks.map((week) => ({ value: week.value, label: week.label })));

	const cohortGroups = $derived.by(() => {
		const map = new Map<
			string,
			{ label: string; items: { value: string; label: string }[]; value: string }
		>();
		for (const c of cohorts) {
			const cat = trackCategory(c.track);
			if (!map.has(cat)) {
				map.set(cat, { label: categoryLabels[cat] ?? cat, items: [], value: '' });
			}
			const group = map.get(cat)!;
			group.items.push({ value: c.code, label: c.code });
			if (urlCohorts.includes(c.code)) {
				group.value = c.code;
			}
		}
		return [...map.values()];
	});

	function isToday(dateIso: string): boolean {
		return dateIso === todayIso;
	}

	function eventTitleLabel(event: LessonEvent): string {
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

	function handleCohortChangeInternal(trackLabel: string, code: string): void {
		calendarWarning = '';
		onCohortChange(trackLabel, code);
	}

	async function handleCopyCalendarLink(): Promise<void> {
		if (!resolvedGroup || !resolvedWeek) return;
		const unselected = cohortGroups.filter((cg) => !cg.value);
		if (unselected.length > 0) {
			calendarWarning =
				m.calendar_select_cohorts() + ' ' + unselected.map((g) => g.label).join(', ');
			return;
		}
		calendarWarning = '';
		isGeneratingLinks = true;
		error = '';
		try {
			const textPromise = fetch('/api/token', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					group: resolvedGroup,
					week: resolvedWeek,
					cohorts: urlCohorts,
					lang: uiLocale
				})
			}).then(async (response) => {
				if (!response.ok) throw new Error(m.api_error_calendar());
				const payload = (await response.json()) as { token: string };
				return `${location.origin}${localizeHref('/api/calendar', { locale: uiLocale })}?token=${encodeURIComponent(payload.token)}`;
			});
			await navigator.clipboard.write([
				new ClipboardItem({
					'text/plain': textPromise.then((text) => new Blob([text], { type: 'text/plain' }))
				})
			]);
			copiedField = 'calendar';
			setTimeout(() => {
				copiedField = null;
			}, 1500);
		} catch (err) {
			error = err instanceof Error ? err.message : m.api_error_calendar();
		} finally {
			isGeneratingLinks = false;
		}
	}

	// Auto-scroll to today when data loads
	$effect(() => {
		if (orderedDates.length === 0) return;
		const target = orderedDates.includes(todayIso)
			? todayIso
			: (orderedDates.findLast((d) => d <= todayIso) ?? orderedDates[0]);
		void tick().then(() => {
			const el =
				document.getElementById(`day-mobile-${target}`) ?? document.getElementById(`day-${target}`);
			el?.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
		});
	});
</script>

{@render children({
	orderedDates,
	groupedEvents,
	subjectColorMap,
	groupSelectItems,
	weekSelectItems,
	cohortGroups,
	selectedGroup: resolvedGroup,
	selectedWeek: resolvedWeek,
	uiLocale,
	todayIso,
	error,
	isGeneratingLinks,
	copiedField,
	calendarWarning,
	onGroupChange,
	onWeekChange,
	onCohortChange: handleCohortChangeInternal,
	onCopySiteLink: async () => {
		await navigator.clipboard.writeText(location.href);
		copiedField = 'site';
		setTimeout(() => {
			copiedField = null;
		}, 1500);
	},
	onCopyCalendarLink: handleCopyCalendarLink,
	formatDateLabel: (dateIso: string) => formatDateLabel(dateIso, uiLocale),
	eventTitleLabel,
	isToday,
	timeSlots,
	getSlotEvents
})}
