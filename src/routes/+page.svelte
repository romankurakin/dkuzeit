<script lang="ts">
	import SchedulerShell from '$lib/components/SchedulerShell.svelte';
	import { Select } from 'bits-ui';
	import { cv } from '$lib/scheduler/subject-colors';
	import { m } from '$lib/paraglide/messages';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import GithubIcon from '@lucide/svelte/icons/github';
</script>

<svelte:head>
	<title>{m.app_title()}</title>
	<meta name="description" content={m.meta_description()} />
</svelte:head>

{#snippet selectBox(label: string, value: string, items: {value: string; label: string}[], disabled: boolean, onChange: (v: string) => void)}
	<label class="flex-1 min-w-44">
		<span class="block brutal-micro mb-1.5 text-neutral-500 tracking-[0.25em]">
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

<SchedulerShell>
	{#snippet children(ctx)}
		<main class="mb-0">
			<div class="border-b-4 border-black pb-6 mb-0 flex flex-wrap gap-3">
				{@render selectBox(
					m.group_label(),
					ctx.selectedGroup,
					ctx.groupSelectItems,
					ctx.isLoadingMeta,
					ctx.onGroupChange
				)}
				{#each ctx.cohortGroups as cg (cg.label)}
					{@render selectBox(
						cg.label,
						cg.value,
						cg.items,
						ctx.isLoadingMeta || ctx.isLoadingSchedule,
						(v) => ctx.onCohortChange(cg.label, v)
					)}
				{/each}
				{@render selectBox(
					m.week_label(),
					ctx.selectedWeek,
					ctx.weekSelectItems,
					ctx.isLoadingMeta,
					ctx.onWeekChange
				)}
			</div>

			{#if ctx.error}
				<div class="border-4 border-red-600 bg-red-50 p-4 text-red-900 brutal-micro">
					{ctx.error}
				</div>
			{/if}

			{#if ctx.isLoadingMeta || ctx.isLoadingSchedule}
				<div class="py-20 text-center">
					<span class="text-xl font-bold uppercase tracking-[0.3em] animate-pulse">
						{m.loading()}
					</span>
				</div>
			{:else if ctx.orderedDates.length === 0}
				<div class="py-20 text-center text-sm uppercase tracking-widest text-neutral-400">
					{m.no_events()}
				</div>
			{:else}
				<div class="hidden sm:block overflow-x-auto -mb-0.75">
					<table class="w-full border-collapse brutal-border-b table-fixed">
						<thead>
							<tr>
								<th class="w-18 min-w-18 p-0"></th>
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
										{@const firstColor = slotEvents.length === 1 ? ctx.subjectColorMap.get(slotEvents[0]!.subjectShortRu) : undefined}
										<td
											class="brutal-border-l p-0 {slotEvents.length === 0 ? 'bg-neutral-50' : ''}"
											style={firstColor ? `background: ${cv(firstColor, 300)};` : ''}
										>
											{#each slotEvents as event, ei (event.id)}
												{@const color = ctx.subjectColorMap.get(event.subjectShortRu)}
												<div
													class="p-2.5 {ei > 0 ? 'border-t border-black/20' : ''} {!color ? 'bg-neutral-100 text-neutral-500' : ''}"
													style={slotEvents.length > 1 && color
														? `background: ${cv(color, 300)};`
														: ''}
												>
													<div class="font-bold text-xs leading-tight">
														{ctx.eventTitleLabel(event)}
													</div>
													{#if event.lessonType && ctx.uiLocale !== 'de'}
														<div class="brutal-micro mt-1 opacity-50">
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

				<div class="sm:hidden">
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
								{@const color = ctx.subjectColorMap.get(event.subjectShortRu)}
								<div
									class="border-t border-black/20 p-3 flex items-start gap-3"
									style={color
										? `background: ${cv(color, 300)};`
										: ''}
								>
									<div class="text-xs font-bold shrink-0 w-16 pt-0.5 {color ? '' : 'text-neutral-400'}">
										{event.startTime}<br />{event.endTime}
									</div>
									<div class="flex-1 min-w-0">
										<div class="font-bold text-sm leading-tight">
											{ctx.eventTitleLabel(event)}
										</div>
										{#if event.lessonType && ctx.uiLocale !== 'de'}
											<div class="brutal-micro mt-1 opacity-50">
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
					<div class="brutal-border-t"></div>
				</div>
			{/if}
		</main>

		<footer class="border-t-4 border-black pt-5 mt-0">
			<div class="flex gap-3 flex-wrap">
				<button
					type="button"
					class="brutal-border brutal-hover brutal-micro p-2.5 inline-flex items-center gap-2 disabled:opacity-30"
					disabled={ctx.isGeneratingLinks || ctx.isLoadingSchedule}
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
					class="inline-flex items-center gap-1 hover:underline"
				>
					<GithubIcon size={12} /> Roman Kurakin
				</a>
			</p>
		</footer>
	{/snippet}
</SchedulerShell>
