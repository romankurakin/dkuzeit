<script lang="ts">
	import BrutalSchedulerView from '$lib/components/BrutalSchedulerView.svelte';
	import BrutalSelect from '$lib/components/BrutalSelect.svelte';
	import type { PageProps } from './$types';
	import { cv, subjectColorKey } from '$lib/scheduler/subject-colors';
	import { m } from '$lib/paraglide/messages';
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
		goto(`/?${params.toString()}`, { replaceState: true, noScroll: true, keepFocus: true });
	}

	function handleWeekChange(value: string): void {
		const params = new URLSearchParams(page.url.searchParams);
		params.set('week', value);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- same-page query param change
		goto(`/?${params.toString()}`, { replaceState: true, noScroll: true, keepFocus: true });
	}

	function handleCohortChange(_trackLabel: string, code: string): void {
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
		goto(`/?${params.toString()}`, { replaceState: true, noScroll: true, keepFocus: true });
	}

	function handleToolbarKeydown(e: KeyboardEvent): void {
		const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
		if (!keys.includes(e.key)) return;
		const triggers = [
			...(e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[data-nav-select]')
		];
		const i = triggers.indexOf(document.activeElement as HTMLButtonElement);
		if (i === -1) return;
		let next = i;
		if (e.key === 'ArrowRight') next = i + 1;
		else if (e.key === 'ArrowLeft') next = i - 1;
		else if (e.key === 'Home') next = 0;
		else if (e.key === 'End') next = triggers.length - 1;
		const target = triggers[next];
		if (target && next !== i) {
			e.preventDefault();
			target.focus();
		}
	}
</script>

<svelte:head>
	<title>{m.app_title()}</title>
	<meta name="description" content={m.meta_description()} />
</svelte:head>

{#if schedule.error}
	<main
		class="bg-foreground text-background flex min-h-[calc(100dvh-8rem)] flex-col items-center justify-center p-8 text-center"
	>
		<h2 class="brutal-heading">
			{m.upstream_down_title()}
		</h2>
		<p class="brutal-micro mt-section max-w-md">
			{m.upstream_down_body()}
		</p>
	</main>
{:else}
	<div class="min-h-[calc(100dvh-8rem)]">
		<BrutalSchedulerView
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
			onCohortChange={handleCohortChange}
		>
			{#snippet children(ctx)}
				<main>
					<search
						role="toolbar"
						tabindex={-1}
						aria-orientation="horizontal"
						class="brutal-border-b pb-section flex flex-wrap gap-3"
						onkeydown={handleToolbarKeydown}
					>
						<BrutalSelect
							label={m.group_label()}
							value={ctx.selectedGroup}
							items={ctx.groupSelectItems}
							onValueChange={ctx.onGroupChange}
							autofocus
						/>
						<BrutalSelect
							label={m.week_label()}
							value={ctx.selectedWeek}
							items={ctx.weekSelectItems}
							onValueChange={ctx.onWeekChange}
						/>
						{#each ctx.cohortGroups as cg (cg.label)}
							<BrutalSelect
								label={cg.label}
								value={cg.value}
								empty={!cg.value}
								items={cg.items}
								onValueChange={(v) => ctx.onCohortChange(cg.label, v)}
							/>
						{/each}
					</search>

					{#if ctx.orderedDates.length === 0}
						<div
							class="text-muted-foreground py-20 text-center text-sm font-bold tracking-widest uppercase"
						>
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
												class="brutal-micro brutal-border-l p-3 text-left"
												class:bg-foreground={ctx.isToday(date)}
												class:text-background={ctx.isToday(date)}
												class:bg-muted={!ctx.isToday(date)}
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
													<span class="text-xs font-bold">{slot.start}</span>
													<span class="mt-0.5 text-xs font-bold">{slot.end}</span>
												</div>
											</td>
											{#each ctx.orderedDates as date (date)}
												{@const slotEvents = ctx.getSlotEvents(date, slot.key)}
												{@const firstColor =
													slotEvents.length === 1
														? ctx.subjectColorMap.get(subjectColorKey(slotEvents[0]!))
														: undefined}
												<td
													class="brutal-border-l p-0 {slotEvents.length === 0 ? 'bg-muted' : ''}"
													style={firstColor ? `background: ${cv(firstColor, 400)};` : ''}
												>
													{#each slotEvents as event, ei (event.id)}
														{@const color = ctx.subjectColorMap.get(subjectColorKey(event))}
														<div
															class="brutal-cell p-control {ei > 0
																? 'border-border border-t'
																: ''} {!color ? 'bg-muted text-muted-foreground' : ''}"
															style={slotEvents.length > 1 && color
																? `background: ${cv(color, 400)};`
																: ''}
														>
															<div class="text-xs leading-tight font-bold">
																{ctx.eventTitleLabel(event)}
															</div>
															{#if event.lessonType && ctx.uiLocale !== 'de'}
																<div class="brutal-micro text-foreground/70 mt-0.5">
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
							{#each ctx.orderedDates as date, i (date)}
								<div id="day-mobile-{date}" class={i > 0 ? 'brutal-border-t' : ''}>
									<div
										class="brutal-micro sticky top-0 z-10 p-3"
										class:bg-foreground={ctx.isToday(date)}
										class:text-background={ctx.isToday(date)}
										class:bg-muted={!ctx.isToday(date)}
									>
										{ctx.formatDateLabel(date)}
									</div>
									{#each ctx.groupedEvents[date] ?? [] as event (event.id)}
										{@const color = ctx.subjectColorMap.get(subjectColorKey(event))}
										<div
											class="brutal-cell-mobile border-border flex items-start gap-3 border-t p-3"
											style={color ? `background: ${cv(color, 400)};` : ''}
										>
											<div
												class="w-16 shrink-0 pt-0.5 text-xs font-bold {color
													? ''
													: 'text-muted-foreground'}"
											>
												{event.startTime}<br />{event.endTime}
											</div>
											<div class="min-w-0 flex-1">
												<div class="text-sm leading-tight font-bold">
													{ctx.eventTitleLabel(event)}
												</div>
												{#if event.lessonType && ctx.uiLocale !== 'de'}
													<div class="brutal-micro text-foreground/70 mt-0.5">
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

				<footer class="brutal-border-t pt-section">
					<div class="flex flex-wrap gap-3">
						<button
							type="button"
							data-active={ctx.cohortWarningActive || undefined}
							class="brutal-border brutal-hover brutal-focus brutal-micro p-control data-active:bg-foreground data-active:text-background inline-flex items-center gap-2"
							disabled={ctx.isGeneratingLinks || ctx.cohortWarningActive}
							onclick={ctx.onCopyCalendarLink}
						>
							{ctx.copiedField === 'calendar' ? m.copied() : m.copy_calendar_link()}
						</button>
					</div>
					<p class="mt-4 inline-flex items-center gap-1 text-xs leading-tight font-bold">
						{m.made_by()}
						<a
							href="https://github.com/romankurakin"
							target="_blank"
							rel="noopener noreferrer"
							class="brutal-focus inline-flex items-center gap-1 hover:underline"
						>
							Roman Kurakin
						</a>
					</p>
				</footer>
			{/snippet}
		</BrutalSchedulerView>
	</div>
{/if}
