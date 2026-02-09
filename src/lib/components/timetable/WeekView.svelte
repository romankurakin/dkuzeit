<script lang="ts">
	import { tick } from 'svelte';
	import { m } from '$lib/paraglide/messages';
	import { formatDateLabel } from '$lib/scheduler/date-format';
	import type { LessonEvent } from './types';

	let {
		orderedDates,
		groupedEvents,
		isLoading = false,
		todayIso,
		uiLocale
	}: {
		orderedDates: string[];
		groupedEvents: Record<string, LessonEvent[]>;
		isLoading?: boolean;
		todayIso: string;
		uiLocale: 'ru' | 'de';
	} = $props();

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

	$effect(() => {
		if (orderedDates.length === 0) return;
		const target = orderedDates.includes(todayIso)
			? todayIso
			: (orderedDates.findLast((d) => d <= todayIso) ?? orderedDates[0]);
		void tick().then(() => {
			document
				.getElementById(`day-${target}`)
				?.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
		});
	});
</script>

<section>
	{#if isLoading}
		<p>{m.loading()}</p>
	{:else if orderedDates.length === 0}
		<p>{m.no_events()}</p>
	{:else}
		<div class="gap-4 lg:grid lg:auto-cols-fr lg:grid-flow-col">
			{#each orderedDates as date (date)}
				<div id={`day-${date}`} class="mb-4 sm:mb-0">
					<div class="mb-2 border-b pb-2">
						{formatDateLabel(date, uiLocale)}
						{#if isToday(date)}
							*{/if}
					</div>
					<div class="space-y-2">
						{#each groupedEvents[date] as event (event.id)}
							<div class="border p-2">
								<div>{event.startTime}–{event.endTime}</div>
								<div>{eventTitleLabel(event)}</div>
								{#if event.lessonType && uiLocale !== 'de'}
									<div>{event.lessonType}</div>
								{/if}
								{#if event.room}
									<div>{event.room}</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</section>
