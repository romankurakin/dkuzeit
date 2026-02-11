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
	const todayIso = $derived(data.todayIso);
	let githubArmed = $state(false);
	let githubArmTimer: ReturnType<typeof setTimeout> | null = null;

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

	function handleGithubClick(e: MouseEvent): void {
		if (!githubArmed) {
			e.preventDefault();
			githubArmed = true;
			if (githubArmTimer) clearTimeout(githubArmTimer);
			githubArmTimer = setTimeout(() => {
				githubArmed = false;
				githubArmTimer = null;
			}, 1240);
			return;
		}

		if (githubArmTimer) {
			clearTimeout(githubArmTimer);
			githubArmTimer = null;
		}
		githubArmed = false;
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
					<div
						role="toolbar"
						tabindex={-1}
						aria-orientation="horizontal"
						aria-label={`${m.group_label()}, ${m.week_label()}`}
						class="controls-toolbar brutal-border-b pb-section brutal-shell-inset"
						style={`--grid-days:${Math.max(ctx.orderedDates.length, 1)};`}
						onkeydown={handleToolbarKeydown}
					>
						<BrutalSelect
							label={m.group_label()}
							value={ctx.selectedGroup}
							items={ctx.groupSelectItems}
							onValueChange={ctx.onGroupChange}
							autofocus={!page.url.searchParams.has('group')}
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
					</div>

					{#if ctx.orderedDates.length === 0}
						<div
							class="text-muted-text py-20 text-center text-sm font-bold tracking-widest uppercase"
						>
							{m.no_events()}
						</div>
					{:else}
						<div class="-mb-0.75 hidden overflow-x-auto lg:block">
							<table class="w-full table-fixed border-collapse">
								<thead>
									<tr>
										<th class="bg-muted-surface w-18 min-w-18 p-0">
											<span class="sr-only">{m.week_label()}</span>
										</th>
										{#each ctx.orderedDates as date (date)}
											<th
												id="day-{date}"
												class="brutal-micro brutal-border-l p-3 text-left"
												class:bg-foreground={ctx.isToday(date)}
												class:text-background={ctx.isToday(date)}
												class:bg-muted-surface={!ctx.isToday(date)}
											>
												{ctx.formatDateLabel(date)}
											</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#each ctx.timeSlots as slot (slot.key)}
										<tr class="brutal-border-t">
											<th scope="row" class="bg-muted-surface p-0 align-top">
												<div class="flex flex-col items-end px-2 py-3 leading-none">
													<span class="text-xs font-bold">{slot.start}</span>
													<span class="mt-0.5 text-xs font-bold">{slot.end}</span>
												</div>
											</th>
											{#each ctx.orderedDates as date (date)}
												{@const slotEvents = ctx.getSlotEvents(date, slot.key)}
												{@const firstColor =
													slotEvents.length === 1
														? ctx.subjectColorMap.get(subjectColorKey(slotEvents[0]!))
														: undefined}
												<td
													class="brutal-border-l p-0 {slotEvents.length === 0
														? 'bg-muted-surface'
														: ''}"
													style={firstColor ? `background: ${cv(firstColor)};` : ''}
												>
													{#each slotEvents as event, ei (event.id)}
														{@const color = ctx.subjectColorMap.get(subjectColorKey(event))}
														<div
															class="brutal-cell p-control {ei > 0
																? 'border-border border-t'
																: ''} {!color ? 'bg-muted-surface text-muted-text' : ''}"
															style={slotEvents.length > 1 && color
																? `background: ${cv(color)};`
																: ''}
														>
															<div class="text-xs leading-tight font-bold">
																{ctx.eventTitleLabel(event)}
															</div>
															{#if event.lessonType && ctx.uiLocale !== 'de'}
																<div class="brutal-micro text-subtle-text mt-0.5">
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
										class:bg-muted-surface={!ctx.isToday(date)}
									>
										{ctx.formatDateLabel(date)}
									</div>
									{#each ctx.groupedEvents[date] ?? [] as event (event.id)}
										{@const color = ctx.subjectColorMap.get(subjectColorKey(event))}
										<div
											class="brutal-cell-mobile border-border flex items-start gap-3 border-t p-3"
											style={color ? `background: ${cv(color)};` : ''}
										>
											<div
												class="w-16 shrink-0 pt-0.5 text-xs font-bold {color
													? ''
													: 'text-muted-text'}"
											>
												{event.startTime}<br />{event.endTime}
											</div>
											<div class="min-w-0 flex-1">
												<div class="text-sm leading-tight font-bold">
													{ctx.eventTitleLabel(event)}
												</div>
												{#if event.lessonType && ctx.uiLocale !== 'de'}
													<div class="brutal-micro text-subtle-text mt-0.5">
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

				<footer class="brutal-border-t py-section">
					<div
						class="footer-shell brutal-shell-inset flex flex-wrap items-center justify-between gap-3"
					>
						<div class="flex flex-wrap gap-3">
							<a
								href="https://github.com/romankurakin/dkuzeit"
								target="_blank"
								rel="noopener noreferrer"
								title={githubArmed ? m.source_code() : `${m.source_code()} ×2`}
								class="brutal-link brutal-control brutal-control-icon brutal-focus relative overflow-hidden"
								class:brutal-hover={!githubArmed}
								class:brutal-arm-shell={githubArmed}
								onclick={handleGithubClick}
							>
								<span class="sr-only">{m.source_code()}</span>
								<span
									aria-hidden="true"
									class="pixel-icon pixel-icon-mask"
									class:brutal-arm-icon={githubArmed}
									style="--pixel-icon: url('/icons/pixel-github.svg')"
								></span>
								<span
									aria-hidden="true"
									class="pointer-events-none absolute inset-0 block"
									class:brutal-arm-scan={githubArmed}
								></span>
							</a>
							<button
								type="button"
								class="brutal-link brutal-control brutal-control-icon brutal-focus relative overflow-hidden"
								class:calendar-copy-hover={ctx.calendarCopyState === 'idle'}
								class:calendar-copy-shell-pending={ctx.calendarCopyState === 'pending'}
								disabled={ctx.isGeneratingLinks || ctx.cohortWarningActive}
								onclick={ctx.onCopyCalendarLink}
								onpointerleave={ctx.onClearCalendarCopyState}
							>
								<span class="sr-only">{m.copy_calendar_link()}</span>
								<span
									aria-hidden="true"
									class="pixel-icon pixel-icon-mask"
									class:text-poison={ctx.calendarCopyState === 'success'}
									class:calendar-copy-icon-pending={ctx.calendarCopyState === 'pending'}
									class:calendar-copy-icon-rock={ctx.calendarCopyState === 'success'}
									style="--pixel-icon: url('/icons/pixel-apple.svg')"
								></span>
								<span
									aria-hidden="true"
									class="calendar-copy-sync pointer-events-none absolute inset-0 block"
									class:calendar-copy-sync-flash={ctx.calendarCopyState === 'success'}
								></span>
							</button>
							<span class="sr-only" role="status" aria-live="polite">
								{#if ctx.calendarCopyState === 'success'}
									{m.copied()}
								{/if}
							</span>
						</div>
						<a
							href="https://github.com/romankurakin"
							target="_blank"
							rel="noopener noreferrer"
							class="brutal-signature brutal-focus inline-flex items-center gap-1 hover:underline"
						>
							<span>{m.made_by()} Roman Kurakin</span>
						</a>
					</div>
				</footer>
			{/snippet}
		</BrutalSchedulerView>
	</div>
{/if}

<style>
	.controls-toolbar {
		container-type: inline-size;
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: flex-end;
	}

	@keyframes brutal-arm-shell-kf {
		0% {
			transform: scale(1);
			background-color: var(--color-background);
			color: var(--color-foreground);
			box-shadow: 0 0 0 0 oklch(from var(--color-poison) l c h / 0);
		}
		8% {
			transform: scale(0.9);
			background-color: var(--color-background);
			color: var(--color-foreground);
			box-shadow: 0 0 0 1px oklch(from var(--color-poison) l c h / 0.24);
		}
		18% {
			transform: scale(1.72);
			background-color: var(--color-muted-surface);
			color: var(--color-foreground);
			box-shadow: 0 0 0 3px oklch(from var(--color-poison) l c h / 0.5);
		}
		30% {
			transform: scale(1.6);
			background-color: var(--color-muted-surface);
			color: var(--color-foreground);
			box-shadow: 0 0 0 3px oklch(from var(--color-poison) l c h / 0.68);
		}
		44% {
			transform: scale(0.76);
			background-color: var(--color-background);
			color: var(--color-foreground);
			box-shadow: 0 0 0 1px oklch(from var(--color-poison) l c h / 0.36);
		}
		58% {
			transform: scale(1.38);
			background-color: var(--color-muted-surface);
			color: var(--color-foreground);
			box-shadow: 0 0 0 2px oklch(from var(--color-poison) l c h / 0.44);
		}
		74% {
			transform: scale(0.92);
			background-color: var(--color-background);
			color: var(--color-foreground);
			box-shadow: 0 0 0 1px oklch(from var(--color-poison) l c h / 0.3);
		}
		88% {
			transform: scale(1.08);
			background-color: var(--color-muted-surface);
			color: var(--color-foreground);
			box-shadow: 0 0 0 2px oklch(from var(--color-poison) l c h / 0.36);
		}
		100% {
			transform: scale(1);
			background-color: var(--color-background);
			color: var(--color-foreground);
			box-shadow: 0 0 0 0 oklch(from var(--color-poison) l c h / 0);
		}
	}

	@keyframes brutal-arm-icon-kf {
		0% {
			transform: translate(0, 0) scale(1);
			filter: brightness(1) contrast(1) drop-shadow(0 0 0 oklch(from var(--color-poison) l c h / 0));
		}
		8% {
			transform: translate(0, 1px) scale(0.92);
			filter: brightness(0.96) contrast(1.04)
				drop-shadow(1px 0 0 oklch(from var(--color-poison) l c h / 0.22));
		}
		18% {
			transform: translate(2px, -2px) scale(2.08);
			filter: brightness(1.14) contrast(1.18)
				drop-shadow(2px 0 0 oklch(from var(--color-poison) l c h / 0.62));
		}
		30% {
			transform: translate(1px, -1px) scale(1.94);
			filter: brightness(1.1) contrast(1.14)
				drop-shadow(2px 0 0 oklch(from var(--color-poison) l c h / 0.52));
		}
		42% {
			transform: translate(-2px, 1px) scale(0.66);
			filter: brightness(0.88) contrast(1.1)
				drop-shadow(1px 0 0 oklch(from var(--color-poison) l c h / 0.4));
		}
		56% {
			transform: translate(2px, 0) scale(1.66);
			filter: brightness(1.08) contrast(1.12)
				drop-shadow(2px 0 0 oklch(from var(--color-poison) l c h / 0.48));
		}
		70% {
			transform: translate(-2px, 1px) scale(0.82);
			filter: brightness(0.96) contrast(1.04)
				drop-shadow(1px 0 0 oklch(from var(--color-poison) l c h / 0.34));
		}
		84% {
			transform: translate(1px, -1px) scale(1.2);
			filter: brightness(1.02) contrast(1.06)
				drop-shadow(2px 0 0 oklch(from var(--color-poison) l c h / 0.42));
		}
		94% {
			transform: translate(0, 0) scale(1.06);
			filter: brightness(1.01) contrast(1.03)
				drop-shadow(1px 0 0 oklch(from var(--color-poison) l c h / 0.22));
		}
		100% {
			transform: translate(0, 0) scale(1);
			filter: brightness(1) contrast(1) drop-shadow(0 0 0 oklch(from var(--color-poison) l c h / 0));
		}
	}

	@keyframes brutal-arm-scan-kf {
		0% {
			transform: translateX(-260%);
			opacity: 0;
		}
		6% {
			opacity: 1;
		}
		24% {
			transform: translateX(-120%);
			opacity: 1;
		}
		40% {
			transform: translateX(-20%);
			opacity: 1;
		}
		58% {
			transform: translateX(56%);
			opacity: 1;
		}
		76% {
			transform: translateX(138%);
			opacity: 1;
		}
		92% {
			transform: translateX(206%);
			opacity: 1;
		}
		100% {
			transform: translateX(252%);
			opacity: 0;
		}
	}

	.brutal-arm-shell {
		transform-origin: center;
		will-change: transform, background-color, box-shadow;
		animation: brutal-arm-shell-kf 1240ms steps(14, end) 1;
	}

	.brutal-arm-icon {
		transform-origin: center;
		will-change: transform, filter;
		animation: brutal-arm-icon-kf 1180ms steps(13, end) 1;
	}

	.brutal-arm-scan {
		position: absolute;
		inset: 0;
		pointer-events: none;
		filter: saturate(1.35) contrast(1.18);
		background-color: oklch(from var(--color-poison) l c h / 0.82);
		-webkit-mask-image: url('/icons/pixel-scan-bolt.svg');
		mask-image: url('/icons/pixel-scan-bolt.svg');
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: auto 88%;
		mask-size: auto 88%;
		-webkit-mask-position: center;
		mask-position: center;
		animation: brutal-arm-scan-kf 1180ms steps(13, end) 1;
	}

	@keyframes calendar-copy-shell-pending-kf {
		0% {
			background-color: var(--color-background);
			color: var(--color-foreground);
			box-shadow: 0 0 0 0 oklch(from var(--color-poison) l c h / 0);
		}
		50% {
			background-color: var(--color-muted-surface);
			color: var(--color-foreground);
			box-shadow: 0 0 0 1px oklch(from var(--color-poison) calc(l * 0.9) calc(c * 0.62) h / 0.16);
		}
		100% {
			background-color: var(--color-background);
			color: var(--color-foreground);
			box-shadow: 0 0 0 0 oklch(from var(--color-poison) l c h / 0);
		}
	}

	@keyframes calendar-copy-icon-pending-kf {
		0% {
			transform: translate(0, 0) rotate(-1deg) scale(1);
			filter: brightness(0.98) contrast(1)
				drop-shadow(0 0 0 oklch(from var(--color-poison) l c h / 0));
		}
		50% {
			transform: translate(0, -0.5px) rotate(2deg) scale(1.02);
			filter: brightness(1.02) contrast(1.02)
				drop-shadow(0 1px 0 oklch(from var(--color-poison) calc(l * 0.88) calc(c * 0.62) h / 0.12));
		}
		100% {
			transform: translate(0, 0) rotate(-1deg) scale(1);
			filter: brightness(0.98) contrast(1)
				drop-shadow(0 0 0 oklch(from var(--color-poison) l c h / 0));
		}
	}

	@keyframes calendar-copy-icon-rock-kf {
		0% {
			transform: translate(0, 0) rotate(0deg) scale(1);
			filter: brightness(1) contrast(1) drop-shadow(0 0 0 oklch(from var(--color-poison) l c h / 0));
		}
		24% {
			transform: translate(-0.5px, -1px) rotate(-6deg) scale(1.08);
			filter: brightness(1.05) contrast(1.05)
				drop-shadow(0 1px 0 oklch(from var(--color-poison) calc(l * 0.9) calc(c * 0.64) h / 0.18));
		}
		54% {
			transform: translate(0.5px, 0) rotate(3deg) scale(1.03);
			filter: brightness(1.02) contrast(1.03)
				drop-shadow(0 1px 0 oklch(from var(--color-poison) calc(l * 0.88) calc(c * 0.62) h / 0.14));
		}
		100% {
			transform: translate(0, 0) rotate(-1deg) scale(1);
			filter: brightness(1) contrast(1) drop-shadow(0 0 0 oklch(from var(--color-poison) l c h / 0));
		}
	}

	@keyframes calendar-copy-sync-kf {
		0% {
			opacity: 0;
			transform: scale(0.8) rotate(-6deg);
			box-shadow: inset 0 0 0 0 oklch(from var(--color-poison) l c h / 0);
		}
		18% {
			opacity: 1;
			transform: scale(1.02) rotate(0deg);
			box-shadow: inset 0 0 0 2px
				oklch(from var(--color-poison) calc(l * 0.92) calc(c * 0.66) h / 0.24);
		}
		58% {
			opacity: 0.78;
			transform: scale(1.16) rotate(0deg);
			box-shadow: inset 0 0 0 1px
				oklch(from var(--color-poison) calc(l * 0.9) calc(c * 0.64) h / 0.18);
		}
		100% {
			opacity: 0;
			transform: scale(1.26) rotate(0deg);
			box-shadow: inset 0 0 0 0 oklch(from var(--color-poison) l c h / 0);
		}
	}

	.calendar-copy-shell-pending {
		animation: calendar-copy-shell-pending-kf 820ms ease-in-out infinite;
	}

	.calendar-copy-hover {
		transition:
			background-color 120ms ease-out,
			color 120ms ease-out;
	}

	.calendar-copy-hover:hover {
		background-color: var(--color-muted-surface);
		color: var(--color-foreground);
	}

	.calendar-copy-icon-pending {
		animation: calendar-copy-icon-pending-kf 820ms ease-in-out infinite;
	}

	.calendar-copy-icon-rock {
		animation: calendar-copy-icon-rock-kf 300ms cubic-bezier(0.2, 0.9, 0.24, 1.08) 1;
	}

	.calendar-copy-sync {
		opacity: 0;
		transform-origin: center;
	}

	.calendar-copy-sync-flash {
		animation: calendar-copy-sync-kf 260ms steps(7, end) 1;
	}

	@media (prefers-reduced-motion: reduce) {
		.calendar-copy-shell-pending,
		.calendar-copy-icon-pending,
		.calendar-copy-icon-rock,
		.calendar-copy-sync-flash {
			animation: none;
		}
	}
</style>
