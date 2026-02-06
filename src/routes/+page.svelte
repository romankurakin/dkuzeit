<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages';
	import { getLocale, localizeHref } from '$lib/paraglide/runtime';
	import { useSearchParams, createSearchParamsSchema } from 'runed/kit';
	import ControlBar from '$lib/components/timetable/ControlBar.svelte';
	import WeekView from '$lib/components/timetable/WeekView.svelte';
	import type { GroupOption, Cohort, LessonEvent, WeekOption } from '$lib/components/timetable/types';
	import LinkIcon from '@lucide/svelte/icons/link';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import GithubIcon from '@lucide/svelte/icons/github';

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
	const todayIso = $derived(todayIsoInAlmaty());

	const displayEvents = $derived.by(() => {
		// Map cohortCode to category
		const codeToCategory = new Map<string, string>();
		for (const c of cohorts) {
			codeToCategory.set(c.code, trackCategory(c.track));
		}

		// Which categories have a selection?
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

		// Merge collapsed groups into single placeholder events
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
	const groupSelectItems = $derived(
		groups.map((group) => ({
			value: group.codeRaw,
			label: uiLocale === 'de' ? group.codeDe : group.codeRu
		}))
	);
	const weekSelectItems = $derived(weeks.map((week) => ({ value: week.value, label: week.label })));

	const categoryLabels = $derived<Record<string, string>>({
		de: m.category_de(),
		en: m.category_en(),
		kz: m.category_kz(),
		pe: m.category_pe()
	});

	const cohortGroups = $derived.by(() => {
		const map = new Map<string, { label: string; items: { value: string; label: string }[]; value: string }>();
		for (const c of cohorts) {
			const cat = trackCategory(c.track);
			if (!map.has(cat)) {
				map.set(cat, {
					label: categoryLabels[cat] ?? cat,
					items: [],
					value: ''
				});
			}
			const group = map.get(cat)!;
			group.items.push({ value: c.code, label: c.code });
			if (myCohorts.includes(c.code)) {
				group.value = c.code;
			}
		}
		return [...map.values()];
	});

	function trackCategory(track: Cohort['track']): string {
		return track;
	}

	function todayIsoInAlmaty(): string {
		const parts = new Intl.DateTimeFormat('en-GB', {
			timeZone: 'Asia/Almaty',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		}).formatToParts(new Date());

		let year = '1970';
		let month = '01';
		let day = '01';
		for (const part of parts) {
			if (part.type === 'year') year = part.value;
			if (part.type === 'month') month = part.value;
			if (part.type === 'day') day = part.value;
		}
		return `${year}-${month}-${day}`;
	}

	function dayOfWeekInAlmaty(): number {
		const formatter = new Intl.DateTimeFormat('en-US', {
			timeZone: 'Asia/Almaty',
			weekday: 'short'
		});
		const dayName = formatter.format(new Date());
		const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
		return map[dayName] ?? 0;
	}

	function chooseInitialGroup(candidates: GroupOption[], preferred: string): string {
		if (preferred) {
			const resolved = candidates.find(
				(group) =>
					group.codeRaw === preferred || group.codeRu === preferred || group.codeDe === preferred
			);
			if (resolved) return resolved.codeRaw;
		}
		return candidates[0]?.codeRaw ?? '';
	}

	function chooseCurrentWeek(candidates: WeekOption[]): string {
		if (candidates.length === 0) return '';
		const today = todayIsoInAlmaty();
		const isSunday = dayOfWeekInAlmaty() === 0;

		let targetDate = today;
		if (isSunday) {
			const d = new Date(today + 'T00:00:00');
			d.setDate(d.getDate() + 1);
			targetDate = d.toISOString().slice(0, 10);
		}

		let best = candidates[0]!.value;
		for (const week of candidates) {
			if (week.startDateIso <= targetDate) {
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

			// Validate selected cohorts against what's available for this group
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
		setTimeout(() => { copiedField = null; }, 1500);
	}

	async function handleCopyCalendarLink(): Promise<void> {
		if (!selectedGroup || !selectedWeek) return;
		const unselected = cohortGroups.filter(cg => !cg.value);
		if (unselected.length > 0) {
			calendarWarning = m.calendar_select_cohorts() + ' ' + unselected.map(g => g.label).join(', ');
			return;
		}
		calendarWarning = '';
		isGeneratingLinks = true;
		error = '';
		try {
			const response = await fetch('/api/token', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					group: selectedGroup,
					week: selectedWeek,
					cohorts: myCohorts,
					lang: uiLocale
				})
			});
			if (!response.ok) throw new Error(m.api_error_calendar());
			const payload = (await response.json()) as { token: string };
			const calendarUrl = `${location.origin}${localizeHref('/api/calendar', { locale: uiLocale })}?token=${encodeURIComponent(payload.token)}`;
			await navigator.clipboard.writeText(calendarUrl);
			copiedField = 'calendar';
			setTimeout(() => { copiedField = null; }, 1500);
		} catch (err) {
			error = err instanceof Error ? err.message : m.api_error_calendar();
		} finally {
			isGeneratingLinks = false;
		}
	}

	onMount(async () => {
		await loadMeta();
		if (!selectedGroup || !selectedWeek) return;
		await loadSchedule();
	});
</script>

<svelte:head>
	<title>{m.app_title()}</title>
	<meta name="description" content={m.meta_description()} />
</svelte:head>

<main>
	<ControlBar
		groupLabel={m.group_label()}
		weekLabel={m.week_label()}
		groupValue={selectedGroup}
		weekValue={selectedWeek}
		groupItems={groupSelectItems}
		weekItems={weekSelectItems}
		{cohortGroups}
		isDisabled={isLoadingMeta}
		isLoading={isLoadingSchedule}
		onGroupChange={handleGroupValueChange}
		onWeekChange={handleWeekValueChange}
		onCohortChange={handleCohortChange}
	/>

	{#if error}
		<section>{error}</section>
	{/if}

	<WeekView
		{orderedDates}
		{groupedEvents}
		isLoading={isLoadingSchedule}
		{todayIso}
		{uiLocale}
	/>
</main>

<footer class="border-t pt-4 space-y-2">
	<div class="flex gap-2">
		<button
			type="button"
			class="border p-2 inline-flex items-center gap-1"
			disabled={isGeneratingLinks || isLoadingSchedule}
			onclick={handleCopySiteLink}
		>
			<LinkIcon size={16} />
			{copiedField === 'site' ? m.copied() : m.copy_site_link()}
		</button>
		<button
			type="button"
			class="border p-2 inline-flex items-center gap-1"
			disabled={isGeneratingLinks || isLoadingSchedule}
			onclick={handleCopyCalendarLink}
		>
			<CalendarIcon size={16} />
			{copiedField === 'calendar' ? m.copied() : m.copy_calendar_link()}
		</button>
	</div>
	{#if calendarWarning}
		<p>{calendarWarning}</p>
	{/if}
	<p class="inline-flex items-center gap-1">{m.made_by()} <a href="https://github.com/romankurakin" class="inline-flex items-center gap-1"><GithubIcon size={16} /> Roman</a></p>
</footer>
