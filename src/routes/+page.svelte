<script lang="ts">
	import SchedulerView from '$lib/components/SchedulerView.svelte';
	import { Select } from 'bits-ui';
	import { cv, subjectColorKey } from '$lib/scheduler/subject-colors';
	import { m } from '$lib/paraglide/messages';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import GithubIcon from '@lucide/svelte/icons/github';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { fetchMeta, fetchSchedule } from './data.remote';

	const group = $derived(page.url.searchParams.get('group') ?? '');
	const urlCohorts = $derived(
		(page.url.searchParams.get('cohorts') ?? '')
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean)
	);

	let week = $state('');

	function handleGroupChange(value: string): void {
		const params = new URLSearchParams(page.url.searchParams);
		params.set('group', value);
		goto(`?${params.toString()}`, { replaceState: true, noScroll: true });
	}

	function handleWeekChange(value: string): void {
		week = value;
	}
</script>

<svelte:head>
	<title>{m.app_title()}</title>
	<meta name="description" content={m.meta_description()} />
</svelte:head>

{#snippet selectBox(label: string, value: string, items: {value: string; label: string}[], disabled: boolean, onChange: (v: string) => void)}
	<label class="flex-1 min-w-44">
		<span class="block brutal-micro mb-1.5 text-neutral-600 tracking-[0.25em]">
			{label}
		</span>
		<Select.Root type="single" {value} onValueChange={onChange} {items} {disabled}>
			<Select.Trigger
				class="brutal-border brutal-hover p-2.5 w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider disabled:opacity-30"
			>
				<span class="truncate">{items.find((i) => i.value === value)?.label ?? '—'}</span>
				<span aria-hidden="true" class="ml-2 brutal-micro">&#9660;</span>
			</Select.Trigger>
			<Select.Portal>
				<Select.Content
					sideOffset={0}
					class="z-50 w-(--bits-select-anchor-width) brutal-border bg-white"
				>
					<Select.Viewport class="max-h-64 overflow-y-auto">
						{#each items as item (item.value)}
							<Select.Item
								value={item.value}
								label={item.label}
								class="p-2.5 text-xs font-bold uppercase tracking-wider cursor-pointer brutal-hover data-highlighted:bg-black data-highlighted:text-white"
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

{#snippet loadingBlock()}
	<div class="flex-1 flex items-center justify-center py-20">
		<span class="text-xl font-bold uppercase tracking-[0.3em] animate-pulse">
			{m.loading()}
		</span>
	</div>
{/snippet}

<div class="min-h-[calc(100dvh-8rem)]">
{#await fetchMeta()}
	{@render loadingBlock()}
{:then meta}
	{@const resolvedGroup = group || (meta.groups[0]?.codeRaw ?? '')}
	{@const resolvedWeek = week || meta.resolvedWeek}
	{#await fetchSchedule({ group: resolvedGroup, week: resolvedWeek })}
		<main class="mb-0">
			<div class="border-b-4 border-black pb-6 mb-0 flex flex-wrap gap-3">
				{@render selectBox(
					m.group_label(),
					resolvedGroup,
					meta.groups.map((g) => ({ value: g.codeRaw, label: g.codeRu })),
					false,
					handleGroupChange
				)}
				{@render selectBox(
					m.week_label(),
					resolvedWeek,
					meta.weeks.map((w) => ({ value: w.value, label: w.label })),
					false,
					handleWeekChange
				)}
			</div>
			{@render loadingBlock()}
		</main>
	{:then schedule}
		<SchedulerView
			groups={meta.groups}
			weeks={meta.weeks}
			events={schedule.events}
			cohorts={schedule.cohorts}
			resolvedGroup={schedule.resolvedGroup}
			resolvedWeek={schedule.resolvedWeek}
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
				goto(`?${params.toString()}`, { replaceState: true, noScroll: true });
			}}
		>
			{#snippet children(ctx)}
				<main class="mb-0">
					<div class="border-b-4 border-black pb-6 mb-0 flex flex-wrap gap-3">
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
							{@render selectBox(
								cg.label,
								cg.value,
								cg.items,
								false,
								(v) => ctx.onCohortChange(cg.label, v)
							)}
						{/each}
					</div>

					{#if ctx.error}
						<div class="border-4 border-red-600 bg-red-50 p-4 text-red-900 brutal-micro">
							{ctx.error}
						</div>
					{/if}

					{#if ctx.orderedDates.length === 0}
						<div class="py-20 text-center text-sm uppercase tracking-widest text-neutral-500">
							{m.no_events()}
						</div>
					{:else}
						<div class="hidden lg:block overflow-x-auto -mb-0.75">
							<table class="w-full border-collapse table-fixed">
								<thead>
									<tr>
										<th class="w-18 min-w-18 p-0"><span class="sr-only">{m.week_label()}</span></th>
										{#each ctx.orderedDates as date (date)}
											<th
												id="day-{date}"
												class="p-3 brutal-day text-left brutal-border-l"
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
												<div class="px-2 py-3 flex flex-col items-end leading-none">
													<span class="text-xs font-bold text-black">{slot.start}</span>
													<span class="text-xs font-bold text-black mt-0.5">{slot.end}</span>
												</div>
											</td>
											{#each ctx.orderedDates as date (date)}
												{@const slotEvents = ctx.getSlotEvents(date, slot.key)}
												{@const firstColor = slotEvents.length === 1 ? ctx.subjectColorMap.get(subjectColorKey(slotEvents[0]!)) : undefined}
												<td
													class="brutal-border-l p-0 {slotEvents.length === 0 ? 'bg-neutral-50' : ''}"
													style={firstColor ? `background: ${cv(firstColor, 400)};` : ''}
												>
													{#each slotEvents as event, ei (event.id)}
														{@const color = ctx.subjectColorMap.get(subjectColorKey(event))}
														<div
															class="p-2.5 brutal-cell {ei > 0 ? 'border-t border-black/20' : ''} {!color ? 'bg-neutral-100 text-neutral-500' : ''}"
															style={slotEvents.length > 1 && color
																? `background: ${cv(color, 400)};`
																: ''}
														>
															<div class="font-bold text-xs leading-tight">
																{ctx.eventTitleLabel(event)}
															</div>
															{#if event.lessonType && ctx.uiLocale !== 'de'}
																<div class="brutal-micro mt-1 opacity-70">
																	{event.lessonType}
																</div>
															{/if}
															{#if event.room}
																<div class="font-bold text-xs leading-tight mt-0.5">
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
										class="p-3 brutal-day sticky top-0 z-10"
										class:bg-black={ctx.isToday(date)}
										class:text-white={ctx.isToday(date)}
										class:bg-neutral-100={!ctx.isToday(date)}
									>
										{ctx.formatDateLabel(date)}
									</div>
									{#each ctx.groupedEvents[date] ?? [] as event (event.id)}
										{@const color = ctx.subjectColorMap.get(subjectColorKey(event))}
										<div
											class="border-t border-black/20 p-3 flex items-start gap-3 brutal-cell-mobile"
											style={color
												? `background: ${cv(color, 400)};`
												: ''}
										>
											<div class="text-xs font-bold shrink-0 w-16 pt-0.5 {color ? '' : 'text-neutral-500'}">
												{event.startTime}<br />{event.endTime}
											</div>
											<div class="flex-1 min-w-0">
												<div class="font-bold text-sm leading-tight">
													{ctx.eventTitleLabel(event)}
												</div>
												{#if event.lessonType && ctx.uiLocale !== 'de'}
													<div class="brutal-micro mt-1 opacity-70">
														{event.lessonType}
													</div>
												{/if}
												{#if event.room}
													<div class="font-bold text-sm leading-tight mt-0.5">
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

				<footer class="border-t-4 border-black pt-5 mt-0">
					<div class="flex gap-3 flex-wrap">
						<button
							type="button"
							class="brutal-border brutal-hover brutal-micro p-2.5 inline-flex items-center gap-2 disabled:opacity-30"
							disabled={ctx.isGeneratingLinks}
							onclick={ctx.onCopyCalendarLink}
						>
							<CalendarIcon size={12} />
							{ctx.copiedField === 'calendar' ? m.copied() : m.copy_calendar_link()}
						</button>
					</div>
					{#if ctx.calendarWarning}
						<p class="mt-3 brutal-micro text-red-600">
							{ctx.calendarWarning}
						</p>
					{/if}
					<p class="mt-4 text-xs font-bold leading-tight inline-flex items-center gap-1">
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
	{/await}
{/await}
</div>
