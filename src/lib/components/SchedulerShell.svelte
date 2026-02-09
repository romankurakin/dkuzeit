<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount, tick } from 'svelte';
	import { watch } from 'runed';
	import { m } from '$lib/paraglide/messages';
	import { getLocale, localizeHref } from '$lib/paraglide/runtime';
	import { useSearchParams, createSearchParamsSchema } from 'runed/kit';
	import type { GroupOption, Cohort, LessonEvent, WeekOption } from '$lib/components/timetable/types';
	import { Temporal } from 'temporal-polyfill';
	import { buildSubjectColorMap } from '$lib/scheduler/subject-colors';
	import { formatDateLabel } from '$lib/scheduler/date-format';
	import type { SchedulerContext } from '$lib/scheduler/types';

	let { children }: { children: Snippet<[SchedulerContext]> } = $props();

	const searchParamsSchema = createSearchParamsSchema({
		group: { type: 'string', default: '' },
		cohorts: { type: 'string', default: '' }
	});

	const params = useSearchParams(searchParamsSchema, {
		pushHistory: false,
		showDefaults: false,
		noScroll: true
	});

	let groups = $state<GroupOption[]>([]);
	let weeks = $state<WeekOption[]>([]);
	let cohorts = $state<Cohort[]>([]);
	let events = $state<LessonEvent[]>([]);
	let selectedWeek = $state('');
	let isLoadingMeta = $state(false);
	let isLoadingSchedule = $state(false);
	let error = $state('');
	let isGeneratingLinks = $state(false);
	let copiedField = $state<'site' | 'calendar' | null>(null);
	let calendarWarning = $state('');

	const selectedGroup = $derived(params.group);
	const myCohorts = $derived(
		params.cohorts
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean)
	);

	const uiLocale = $derived((getLocale() === 'de' ? 'de' : 'ru') as 'ru' | 'de');
	const todayIso = $derived(Temporal.Now.plainDateISO('Asia/Almaty').toString());

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
		const selectedCodes = new Set(myCohorts);
		const selectedCategories = new Set<string>();
		for (const code of myCohorts) {
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

		result.sort((a, b) =>
			a.dateIso.localeCompare(b.dateIso) || a.startTime.localeCompare(b.startTime)
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
		return (groupedEvents[date] ?? []).filter(
			(e) => `${e.startTime}-${e.endTime}` === slotKey
		);
	}

	const groupSelectItems = $derived(
		groups.map((group) => ({
			value: group.codeRaw,
			label: uiLocale === 'de' ? group.codeDe : group.codeRu
		}))
	);

	const weekSelectItems = $derived(
		weeks.map((week) => ({ value: week.value, label: week.label }))
	);

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
			if (myCohorts.includes(c.code)) {
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
				event.subjectFullDe ||
				event.subjectShortDe ||
				event.subjectFullRu ||
				event.subjectShortRu;
		} else {
			base =
				event.subjectFullRu ||
				event.subjectShortRu ||
				event.subjectFullDe ||
				event.subjectShortDe;
		}
		return event.cohortCode ? `${base} ${event.cohortCode}` : base;
	}

	function chooseInitialGroup(candidates: GroupOption[], preferred: string): string {
		if (preferred) {
			const resolved = candidates.find(
				(group) =>
					group.codeRaw === preferred ||
					group.codeRu === preferred ||
					group.codeDe === preferred
			);
			if (resolved) return resolved.codeRaw;
		}
		return candidates[0]?.codeRaw ?? '';
	}

	function chooseCurrentWeek(candidates: WeekOption[]): string {
		if (candidates.length === 0) return '';
		const today = Temporal.Now.plainDateISO('Asia/Almaty');
		let targetDate = today;
		if (today.dayOfWeek === 7) {
			targetDate = today.add({ days: 1 });
		}
		const targetStr = targetDate.toString();
		let best = candidates[0]!.value;
		for (const week of candidates) {
			if (week.startDateIso <= targetStr) {
				best = week.value;
			}
		}
		return best;
	}

	async function loadMeta(): Promise<void> {
		isLoadingMeta = true;
		error = '';
		try {
			const response = await fetch('/api/meta');
			if (!response.ok) throw new Error(m.api_error_meta());
			const data = (await response.json()) as { groups: GroupOption[]; weeks: WeekOption[] };
			groups = data.groups;
			weeks = data.weeks;
			params.group = chooseInitialGroup(groups, params.group);
			selectedWeek = chooseCurrentWeek(weeks);
		} catch (err) {
			error = err instanceof Error ? err.message : m.api_error_meta();
		} finally {
			isLoadingMeta = false;
		}
	}

	async function loadSchedule(): Promise<void> {
		if (!selectedGroup || !selectedWeek) return;
		isLoadingSchedule = true;
		error = '';
		try {
			const fetchParams = new URLSearchParams({ group: selectedGroup, week: selectedWeek });
			const response = await fetch(`/api/schedule?${fetchParams.toString()}`);
			if (!response.ok) {
				const payload = (await response.json()) as { error?: string };
				throw new Error(payload.error ?? m.api_error_schedule());
			}
			const data = (await response.json()) as { events: LessonEvent[]; cohorts: Cohort[] };
			events = data.events;
			cohorts = data.cohorts;
			const allowed = new Set(cohorts.map((c) => c.code));
			const valid = myCohorts.filter((c) => allowed.has(c));
			params.cohorts = valid.join(',');
		} catch (err) {
			error = err instanceof Error ? err.message : m.api_error_schedule();
			events = [];
		} finally {
			isLoadingSchedule = false;
		}
	}

	async function handleGroupValueChange(value: string): Promise<void> {
		if (!value || value === selectedGroup) return;
		params.group = value;
		await loadSchedule();
	}

	async function handleWeekValueChange(value: string): Promise<void> {
		if (!value || value === selectedWeek) return;
		selectedWeek = value;
		await loadSchedule();
	}

	async function handleCohortChange(_trackLabel: string, code: string): Promise<void> {
		calendarWarning = '';
		const cohort = cohorts.find((c) => c.code === code);
		if (!cohort) return;
		const category = trackCategory(cohort.track);
		const sameCategory = new Set(
			cohorts.filter((c) => trackCategory(c.track) === category).map((c) => c.code)
		);
		const filtered = myCohorts.filter((c) => !sameCategory.has(c));
		params.cohorts = [...filtered, code].join(',');
	}

	async function handleCopySiteLink(): Promise<void> {
		await navigator.clipboard.writeText(location.href);
		copiedField = 'site';
		setTimeout(() => {
			copiedField = null;
		}, 1500);
	}

	async function handleCopyCalendarLink(): Promise<void> {
		if (!selectedGroup || !selectedWeek) return;
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
					group: selectedGroup,
					week: selectedWeek,
					cohorts: myCohorts,
					lang: uiLocale
				})
			}).then(async (response) => {
				if (!response.ok) throw new Error(m.api_error_calendar());
				const payload = (await response.json()) as { token: string };
				return `${location.origin}${localizeHref('/api/calendar', { locale: uiLocale })}?token=${encodeURIComponent(payload.token)}`;
			});
			// Safari requires clipboard write in the same user-gesture microtask.
			// ClipboardItem with a lazy blob promise preserves the gesture context.
			await navigator.clipboard.write([
				new ClipboardItem({
					'text/plain': textPromise.then(
						(text) => new Blob([text], { type: 'text/plain' })
					)
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
	watch(
		() => orderedDates,
		() => {
			if (orderedDates.length === 0) return;
			const target = orderedDates.includes(todayIso)
				? todayIso
				: (orderedDates.findLast((d) => d <= todayIso) ?? orderedDates[0]);
			void tick().then(() => {
				const el =
					document.getElementById(`day-mobile-${target}`) ??
					document.getElementById(`day-${target}`);
				el?.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
			});
		}
	);

	onMount(async () => {
		await loadMeta();
		if (!selectedGroup || !selectedWeek) return;
		await loadSchedule();
	});
</script>

{@render children({
	orderedDates,
	groupedEvents,
	subjectColorMap,
	groupSelectItems,
	weekSelectItems,
	cohortGroups,
	selectedGroup,
	selectedWeek,
	uiLocale,
	todayIso,
	isLoadingMeta,
	isLoadingSchedule,
	error,
	isGeneratingLinks,
	copiedField,
	calendarWarning,
	onGroupChange: handleGroupValueChange,
	onWeekChange: handleWeekValueChange,
	onCohortChange: handleCohortChange,
	onCopySiteLink: handleCopySiteLink,
	onCopyCalendarLink: handleCopyCalendarLink,
	formatDateLabel: (dateIso: string) => formatDateLabel(dateIso, uiLocale),
	eventTitleLabel,
	isToday,
	timeSlots,
	getSlotEvents
})}
