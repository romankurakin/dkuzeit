<script lang="ts">
	import type { Snippet } from 'svelte';
	import { tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { m } from '$lib/paraglide/messages';
	import { getLocale, localizeHref } from '$lib/paraglide/runtime';
	import type { GroupOption, Cohort, LessonEvent, WeekOption } from '$lib/server/types';
	import { buildSubjectColorMap } from '$lib/scheduler/subject-colors';
	import { formatDateLabel } from '$lib/scheduler/date-format';
	import type { SchedulerContext } from '$lib/scheduler/types';
	import {
		filterDisplayEvents,
		groupEventsByDate,
		extractTimeSlots,
		buildCohortGroups,
		eventTitleLabel
	} from '$lib/scheduler/event-filter';

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
	let cohortWarningActive = $state(false);

	const uiLocale = $derived((getLocale() === 'de' ? 'de' : 'ru') as 'ru' | 'de');
	const categoryLabels = $derived<Record<string, string>>({
		de: m.category_de(),
		en: m.category_en(),
		kz: m.category_kz(),
		pe: m.category_pe()
	});

	const displayEvents = $derived(filterDisplayEvents(events, cohorts, urlCohorts, categoryLabels));

	const groupedEvents = $derived(groupEventsByDate(displayEvents));

	const orderedDates = $derived(Object.keys(groupedEvents).sort((a, b) => a.localeCompare(b)));
	const subjectColorMap = $derived(buildSubjectColorMap(displayEvents));

	const timeSlots = $derived(extractTimeSlots(displayEvents));

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

	const cohortGroups = $derived(buildCohortGroups(cohorts, categoryLabels, urlCohorts));

	function isToday(dateIso: string): boolean {
		return dateIso === todayIso;
	}

	function handleCohortChangeInternal(trackLabel: string, code: string): void {
		onCohortChange(trackLabel, code);
	}

	async function handleCopyCalendarLink(): Promise<void> {
		if (!resolvedGroup || !resolvedWeek) return;
		const unselected = cohortGroups.filter((cg) => !cg.value);
		if (unselected.length > 0) {
			cohortWarningActive = true;
			toast.warning(m.calendar_select_cohorts(), {
				id: 'cohort-warning',
				onDismiss: () => {
					cohortWarningActive = false;
				},
				onAutoClose: () => {
					cohortWarningActive = false;
				}
			});
			const firstUnselected = document.querySelector<HTMLButtonElement>(
				'button[data-cohort-empty]'
			);
			if (firstUnselected) {
				firstUnselected.scrollIntoView({ behavior: 'smooth', block: 'center' });
				setTimeout(() => firstUnselected.focus(), 400);
			}
			return;
		}
		isGeneratingLinks = true;
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
			toast.error(err instanceof Error ? err.message : m.api_error_calendar());
		} finally {
			isGeneratingLinks = false;
		}
	}

	// Auto-scroll to today on data load
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
	isGeneratingLinks,
	cohortWarningActive,
	copiedField,
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
	eventTitleLabel: (event: LessonEvent) => eventTitleLabel(event, uiLocale),
	isToday,
	timeSlots,
	getSlotEvents
})}
