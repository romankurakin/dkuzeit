<script lang="ts">
	import SchedulerView from '$lib/components/SchedulerView.svelte';
	import type { PageProps } from './$types';
	import { Select } from 'bits-ui';
	import { cv, subjectColorKey } from '$lib/scheduler/subject-colors';
	import { m } from '$lib/paraglide/messages';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import GithubIcon from '@lucide/svelte/icons/github';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	let { data }: PageProps = $props();
	const meta = $derived(data.meta);
	const schedule = $derived(data.schedule);
	const todayIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date());

	const urlCohorts = $derived(
		(page.url.searchParams.get('cohorts') ?? '')
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean)
	);

	function handleGroupChange(value: string): void {
		const params = new URLSearchParams(page.url.searchParams);
		params.set('group', value);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- same-page query param change
		goto(`/?${params.toString()}`, { replaceState: true, noScroll: true });
	}

	function handleWeekChange(value: string): void {
		const params = new URLSearchParams(page.url.searchParams);
		params.set('week', value);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- same-page query param change
		goto(`/?${params.toString()}`, { replaceState: true, noScroll: true });
	}
</script>

<svelte:head>
	<title>{m.app_title()}</title>
	<meta name="description" content={m.meta_description()} />
</svelte:head>

{#snippet selectBox(
	label: string,
	value: string,
	items: { value: string; label: string }[],
	disabled: boolean,
	onChange: (v: string) => void
)}
	<label class="min-w-44 flex-1">
		<span class="brutal-micro mb-1.5 block tracking-[0.25em] text-neutral-600">
			{label}
		</span>
		<Select.Root type="single" {value} onValueChange={onChange} {items} {disabled}>
			<Select.Trigger
				class="brutal-border brutal-hover flex w-full items-center justify-between p-2.5 text-xs font-bold tracking-wider uppercase disabled:opacity-30"
			>
				<span class="truncate">{items.find((i) => i.value === value)?.label ?? '—'}</span>
				<span aria-hidden="true" class="brutal-micro ml-2">&#9660;</span>
			</Select.Trigger>
			<Select.Portal>
				<Select.Content
					sideOffset={0}
					class="brutal-border z-50 w-(--bits-select-anchor-width) bg-white"
				>
					<Select.Viewport class="max-h-64 overflow-y-auto">
						{#each items as item (item.value)}
							<Select.Item
								value={item.value}
								label={item.label}
								class="brutal-hover cursor-pointer p-2.5 text-xs font-bold tracking-wider uppercase data-highlighted:bg-black data-highlighted:text-white"
							>
								{item.label}
							</Select.Item>
						{/each}
					</Select.Viewport>
				</Select.Content>
			</Select.Portal>
		</Select.Root>
	</label>
{/snippet}

<div class="min-h-[calc(100dvh-8rem)]">
	<SchedulerView
		groups={meta.groups}
		weeks={meta.weeks}
		events={schedule.events}
		cohorts={schedule.cohorts}
		resolvedGroup={schedule.resolvedGroup}
		resolvedWeek={schedule.resolvedWeek}
		{todayIso}
		{urlCohorts}
		onGroupChange={handleGroupChange}
		onWeekChange={handleWeekChange}
		onCohortChange={(_trackLabel, code) => {
			const cohort = schedule.cohorts.find((c) => c.code === code);
			if (!cohort) return;
			const sameCategory = new Set(
				schedule.cohorts.filter((c) => c.track === cohort.track).map((c) => c.code)
			);
			const filtered = urlCohorts.filter((c) => !sameCategory.has(c));
			const newCohorts = [...filtered, code].join(',');
			const params = new URLSearchParams(page.url.searchParams);
			if (newCohorts) {
				params.set('cohorts', newCohorts);
			} else {
				params.delete('cohorts');
			}
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- same-page query param change
			goto(`/?${params.toString()}`, { replaceState: true, noScroll: true });
		}}
	>
		{#snippet children(ctx)}
			<main>
				<div class="brutal-border-b flex flex-wrap gap-3 pb-6">
					{@render selectBox(
						m.group_label(),
						ctx.selectedGroup,
						ctx.groupSelectItems,
						false,
						ctx.onGroupChange
					)}
					{@render selectBox(
						m.week_label(),
						ctx.selectedWeek,
						ctx.weekSelectItems,
						false,
						ctx.onWeekChange
					)}
					{#each ctx.cohortGroups as cg (cg.label)}
						{@render selectBox(cg.label, cg.value, cg.items, false, (v) =>
							ctx.onCohortChange(cg.label, v)
						)}
					{/each}
				</div>

				{#if ctx.error}
					<div class="brutal-micro border-[3px] border-red-600 bg-red-50 p-4 text-red-900">
						{ctx.error}
					</div>
				{/if}

				{#if ctx.orderedDates.length === 0}
					<div class="py-20 text-center text-sm tracking-widest text-neutral-500 uppercase">
						{m.no_events()}
					</div>
				{:else}
					<div class="-mb-0.75 hidden overflow-x-auto lg:block">
						<table class="w-full table-fixed border-collapse">
							<thead>
								<tr>
									<th class="w-18 min-w-18 p-0"><span class="sr-only">{m.week_label()}</span></th>
									{#each ctx.orderedDates as date (date)}
										<th
											id="day-{date}"
											class="brutal-day brutal-border-l p-3 text-left"
											class:bg-black={ctx.isToday(date)}
											class:text-white={ctx.isToday(date)}
											class:bg-neutral-100={!ctx.isToday(date)}
										>
											{ctx.formatDateLabel(date)}
										</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each ctx.timeSlots as slot (slot.key)}
									<tr class="brutal-border-t">
										<td class="p-0 align-top">
											<div class="flex flex-col items-end px-2 py-3 leading-none">
												<span class="text-xs font-bold text-black">{slot.start}</span>
												<span class="mt-0.5 text-xs font-bold text-black">{slot.end}</span>
											</div>
										</td>
										{#each ctx.orderedDates as date (date)}
											{@const slotEvents = ctx.getSlotEvents(date, slot.key)}
											{@const firstColor =
												slotEvents.length === 1
													? ctx.subjectColorMap.get(subjectColorKey(slotEvents[0]!))
													: undefined}
											<td
												class="brutal-border-l p-0 {slotEvents.length === 0 ? 'bg-neutral-50' : ''}"
												style={firstColor ? `background: ${cv(firstColor, 400)};` : ''}
											>
												{#each slotEvents as event, ei (event.id)}
													{@const color = ctx.subjectColorMap.get(subjectColorKey(event))}
													<div
														class="brutal-cell p-2.5 {ei > 0
															? 'border-t border-black/20'
															: ''} {!color ? 'bg-neutral-100 text-neutral-500' : ''}"
														style={slotEvents.length > 1 && color
															? `background: ${cv(color, 400)};`
															: ''}
													>
														<div class="text-xs leading-tight font-bold">
															{ctx.eventTitleLabel(event)}
														</div>
														{#if event.lessonType && ctx.uiLocale !== 'de'}
															<div class="brutal-micro mt-1 opacity-70">
																{event.lessonType}
															</div>
														{/if}
														{#if event.room}
															<div class="mt-0.5 text-xs leading-tight font-bold">
																{event.room}
															</div>
														{/if}
													</div>
												{/each}
											</td>
										{/each}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<div class="lg:hidden">
						{#each ctx.orderedDates as date (date)}
							<div id="day-mobile-{date}" class="brutal-border-t">
								<div
									class="brutal-day sticky top-0 z-10 p-3"
									class:bg-black={ctx.isToday(date)}
									class:text-white={ctx.isToday(date)}
									class:bg-neutral-100={!ctx.isToday(date)}
								>
									{ctx.formatDateLabel(date)}
								</div>
								{#each ctx.groupedEvents[date] ?? [] as event (event.id)}
									{@const color = ctx.subjectColorMap.get(subjectColorKey(event))}
									<div
										class="brutal-cell-mobile flex items-start gap-3 border-t border-black/20 p-3"
										style={color ? `background: ${cv(color, 400)};` : ''}
									>
										<div
											class="w-16 shrink-0 pt-0.5 text-xs font-bold {color
												? ''
												: 'text-neutral-500'}"
										>
											{event.startTime}<br />{event.endTime}
										</div>
										<div class="min-w-0 flex-1">
											<div class="text-sm leading-tight font-bold">
												{ctx.eventTitleLabel(event)}
											</div>
											{#if event.lessonType && ctx.uiLocale !== 'de'}
												<div class="brutal-micro mt-1 opacity-70">
													{event.lessonType}
												</div>
											{/if}
											{#if event.room}
												<div class="mt-0.5 text-sm leading-tight font-bold">
													{event.room}
												</div>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						{/each}
					</div>
				{/if}
			</main>

			<footer class="brutal-border-t pt-5">
				<div class="flex flex-wrap gap-3">
					<button
						type="button"
						class="brutal-border brutal-hover brutal-micro inline-flex items-center gap-2 p-2.5 disabled:opacity-30"
						disabled={ctx.isGeneratingLinks}
						onclick={ctx.onCopyCalendarLink}
					>
						<CalendarIcon size={12} />
						{ctx.copiedField === 'calendar' ? m.copied() : m.copy_calendar_link()}
					</button>
				</div>
				{#if ctx.calendarWarning}
					<p class="brutal-micro mt-3 text-red-600">
						{ctx.calendarWarning}
					</p>
				{/if}
				<p class="mt-4 inline-flex items-center gap-1 text-xs leading-tight font-bold">
					{m.made_by()}
					<a
						href="https://github.com/romankurakin"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1 hover:underline"
					>
						<GithubIcon size={12} /> Roman Kurakin
					</a>
				</p>
			</footer>
		{/snippet}
	</SchedulerView>
</div>
