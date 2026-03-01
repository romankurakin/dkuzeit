import { expect, test, type Page } from '@playwright/test';
import { BUTTON_ACTIVATION_DURATION_MS } from '../src/lib/ui-timing';
import { toSlug } from '../src/lib/url-slug';
import { filterDisplayEvents } from '../src/lib/scheduler/event-filter';
import type { Cohort, LessonEvent } from '../src/lib/server/types';
import { localizedMessageRegex } from './i18n';

type ClipboardMode = 'normal' | 'write-fails';
type MetaPayload = {
	groups: Array<{ codeRaw: string; codeRu: string }>;
	weeks: Array<{ value: string }>;
};
type SchedulePayload = {
	cohorts: Cohort[];
	events: LessonEvent[];
};
const exportButtonNameRe = localizedMessageRegex('copy_calendar_link');
const copiedStatusRe = localizedMessageRegex('copied');

function groupSlug(meta: MetaPayload, codeRaw: string): string {
	const group = meta.groups.find((g) => g.codeRaw === codeRaw);
	return group ? toSlug(group.codeRu) : toSlug(codeRaw);
}

async function installClipboardMock(page: Page, mode: ClipboardMode = 'normal'): Promise<void> {
	await page.addInitScript(
		({ mode }) => {
			class MockClipboardItem {
				constructor(parts) {
					this.parts = parts;
				}
			}
			window.ClipboardItem = MockClipboardItem;
			window.__clipboardState = { writeCalls: 0, writeTextCalls: 0, lastText: '' };

			Object.defineProperty(navigator, 'clipboard', {
				configurable: true,
				value: {
					write: async (items) => {
						window.__clipboardState.writeCalls += 1;
						if (mode === 'write-fails') throw new Error('write blocked');
						for (const item of items ?? []) {
							const textPart = item?.parts?.['text/plain'];
							if (!textPart) continue;
							const blob = typeof textPart.then === 'function' ? await textPart : textPart;
							if (blob && typeof blob.text === 'function') {
								window.__clipboardState.lastText = await blob.text();
							}
						}
					},
					writeText: async (text) => {
						window.__clipboardState.writeTextCalls += 1;
						window.__clipboardState.lastText = String(text ?? '');
					}
				}
			});
		},
		{ mode }
	);
}

async function fetchMeta(page: Page): Promise<MetaPayload> {
	const metaResponse = await page.request.get('/api/meta');
	expect(metaResponse.ok()).toBe(true);
	return (await metaResponse.json()) as MetaPayload;
}

function unique(values: string[]): string[] {
	return [...new Set(values.filter(Boolean))];
}

function pickOnePerTrack(cohorts: Cohort[]): string[] {
	if (cohorts.length === 0) return [];
	const sorted = [...cohorts].sort(
		(a, b) => a.track.localeCompare(b.track) || a.code.localeCompare(b.code)
	);
	const onePerTrack = new Map<string, string>();
	for (const cohort of sorted) {
		if (!onePerTrack.has(cohort.track)) onePerTrack.set(cohort.track, cohort.code);
	}

	return [...onePerTrack.values()];
}

function signatureForEvents(events: LessonEvent[]): string {
	return JSON.stringify(
		events.map((event) => [
			event.dateIso,
			event.startTime,
			event.endTime,
			event.subjectFullRu,
			event.subjectFullDe,
			event.cohortCode
		])
	);
}

async function findScenarioWithRequiredCohorts(
	page: Page,
	meta: MetaPayload
): Promise<{ group: string; week: string; cohorts: string[] } | null> {
	const candidateGroups = unique([
		meta.groups.at(-1)?.codeRaw ?? '',
		meta.groups[0]?.codeRaw ?? '',
		meta.groups[Math.floor(meta.groups.length / 2)]?.codeRaw ?? ''
	]);
	const candidateWeeks = unique([
		meta.weeks.at(-1)?.value ?? '',
		meta.weeks[0]?.value ?? '',
		meta.weeks[Math.floor(meta.weeks.length / 2)]?.value ?? ''
	]);

	for (const group of candidateGroups) {
		for (const week of candidateWeeks) {
			const scheduleResponse = await page.request.get(
				`/api/schedule?group=${encodeURIComponent(group)}&week=${encodeURIComponent(week)}`
			);
			if (!scheduleResponse.ok()) continue;
			const schedule = (await scheduleResponse.json()) as SchedulePayload;
			const cohorts = pickOnePerTrack(schedule.cohorts);
			if (cohorts.length === 0) continue;

			const categoryLabels = { de: 'de', en: 'en', kz: 'kz', pe: 'pe' };
			const base = filterDisplayEvents(schedule.events, schedule.cohorts, [], categoryLabels);
			const filtered = filterDisplayEvents(
				schedule.events,
				schedule.cohorts,
				cohorts,
				categoryLabels
			);
			if (signatureForEvents(base) !== signatureForEvents(filtered)) {
				return { group, week, cohorts };
			}
		}
	}

	return null;
}

function buildScheduleUrl(
	meta: MetaPayload,
	group: string,
	week: string,
	cohorts: string[] = []
): string {
	const slug = groupSlug(meta, group);
	void week;
	void cohorts;
	return `/${slug}`;
}

async function setSelectionCookies(
	page: Page,
	opts: { group: string; week: string; cohorts?: string[] }
): Promise<void> {
	const values: Array<{ name: string; value: string }> = [
		{ name: 'dku_group', value: encodeURIComponent(opts.group) },
		{ name: 'dku_week', value: encodeURIComponent(opts.week) },
		{ name: 'dku_cohorts', value: encodeURIComponent((opts.cohorts ?? []).join(',')) }
	];
	if (opts.cohorts === undefined) {
		values.pop();
	}
	await page.context().addCookies(
		values.map((entry) => ({
			...entry,
			domain: 'localhost',
			path: '/',
			sameSite: 'Lax' as const
		}))
	);
}

test.describe('calendar export', () => {
	test('change rendered schedule and persist cohorts in cookie', async ({ page }) => {
		const meta = await fetchMeta(page);
		const scenario = await findScenarioWithRequiredCohorts(page, meta);
		test.skip(!scenario, 'No group/week with required cohorts in available fixture set');
		const { group, week, cohorts } = scenario!;

		await page.context().clearCookies();
		await setSelectionCookies(page, { group, week });
		await page.goto(buildScheduleUrl(meta, group, week));

		await page.evaluate((csv) => {
			const secure = location.protocol === 'https:' ? '; Secure' : '';
			document.cookie = `dku_cohorts=${encodeURIComponent(csv)}; Path=/; SameSite=Lax${secure}`;
		}, cohorts.join(','));
		await page.reload();
		await expect(page).toHaveURL(new RegExp(`/${groupSlug(meta, group)}$`), { timeout: 5_000 });

		await expect
			.poll(async () => {
				const value = (await page.context().cookies()).find((c) => c.name === 'dku_cohorts')?.value;
				return value ? decodeURIComponent(value) : undefined;
			})
			.toBe(cohorts.join(','));
	});

	test('not run when required cohorts are not selected', async ({ page }) => {
		let tokenRequestCount = 0;
		await page.route('**/api/token', async (route) => {
			tokenRequestCount += 1;
			await route.fulfill({ status: 500, body: 'should not be called' });
		});

		await page.goto('/');
		const firstEmptyCohort = page.getByRole('toolbar').locator('button[data-cohort-empty]').first();
		test.skip(
			(await firstEmptyCohort.count()) === 0,
			'No required cohort filters on this fixture set'
		);

		const exportButton = page
			.getByRole('contentinfo')
			.getByRole('button', { name: exportButtonNameRe });
		await exportButton.click();

		await expect(firstEmptyCohort).toBeFocused({ timeout: 2500 });
		await expect.poll(() => tokenRequestCount).toBe(0);
	});

	test('send selected group week and cohorts and reset visual state', async ({ page }) => {
		await installClipboardMock(page, 'normal');

		const meta = await fetchMeta(page);
		const scenario = await findScenarioWithRequiredCohorts(page, meta);
		test.skip(!scenario, 'No group/week with required cohorts in available fixture set');
		const { group: targetGroup, week: targetWeek, cohorts: selectedCohorts } = scenario!;

		let payload: { group: string; week: string; cohorts: string[]; lang: string } | undefined;
		await page.route('**/api/token', async (route) => {
			payload = route.request().postDataJSON() as {
				group: string;
				week: string;
				cohorts: string[];
				lang: string;
			};
			await new Promise((resolve) => setTimeout(resolve, 200));
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ token: 'calendar-token-e2e' })
			});
		});

		await setSelectionCookies(page, {
			group: targetGroup,
			week: targetWeek,
			cohorts: selectedCohorts
		});
		await page.goto(buildScheduleUrl(meta, targetGroup, targetWeek, selectedCohorts));

		const exportButton = page
			.getByRole('contentinfo')
			.getByRole('button', { name: exportButtonNameRe });
		const exportStatus = page.getByRole('status');

		await exportButton.click();
		await expect(exportButton).toBeDisabled({ timeout: 500 });
		await expect(exportButton).toHaveClass(/calendar-copy-shell-pending/, { timeout: 500 });

		await expect(exportButton).toBeEnabled({ timeout: 5000 });
		await expect(exportStatus).toContainText(copiedStatusRe, { timeout: 5000 });
		await expect(payload).toBeDefined();
		expect(payload?.group).toBe(targetGroup);
		expect(payload?.week).toBe(targetWeek);
		expect(payload?.cohorts).toEqual(selectedCohorts);
		expect(payload?.lang).toBeTruthy();
		const clipboardState = await page.evaluate(
			() =>
				(
					window as unknown as {
						__clipboardState: { writeCalls: number; writeTextCalls: number; lastText: string };
					}
				).__clipboardState
		);
		expect(clipboardState.lastText).toContain('token=');
		const copiedCalendarUrl = new URL(clipboardState.lastText);
		expect(copiedCalendarUrl.pathname).toMatch(/\/api\/calendar$/);
		expect(copiedCalendarUrl.searchParams.get('token')).toBeTruthy();

		await page.waitForTimeout(BUTTON_ACTIVATION_DURATION_MS + 150);
		await expect(exportStatus).toHaveText('', { timeout: 1500 });
	});

	test('fall back to clipboard write text when clipboard write fails', async ({ page }) => {
		await installClipboardMock(page, 'write-fails');
		const meta = await fetchMeta(page);
		const scenario = await findScenarioWithRequiredCohorts(page, meta);
		test.skip(!scenario, 'No group/week with required cohorts in available fixture set');
		const { group, week, cohorts } = scenario!;

		let tokenRequestCount = 0;
		await page.route('**/api/token', async (route) => {
			tokenRequestCount += 1;
			await new Promise((resolve) => setTimeout(resolve, 220));
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ token: 'calendar-token-fallback' })
			});
		});

		await setSelectionCookies(page, { group, week, cohorts });
		await page.goto(buildScheduleUrl(meta, group, week, cohorts));

		const exportButton = page
			.getByRole('contentinfo')
			.getByRole('button', { name: exportButtonNameRe });
		await exportButton.click();

		await expect.poll(() => tokenRequestCount).toBe(1);
		await expect(exportButton).toBeEnabled({ timeout: 5000 });
		await expect
			.poll(async () =>
				page.evaluate(
					() =>
						(
							window as unknown as {
								__clipboardState: {
									writeCalls: number;
									writeTextCalls: number;
									lastText: string;
								};
							}
						).__clipboardState
				)
			)
			.toMatchObject({ writeCalls: 1, writeTextCalls: 1 });
		const fallbackState = await page.evaluate(
			() =>
				(
					window as unknown as {
						__clipboardState: { writeCalls: number; writeTextCalls: number; lastText: string };
					}
				).__clipboardState
		);
		expect(fallbackState.lastText).toContain('token=calendar-token-fallback');
	});
});
