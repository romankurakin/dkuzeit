import { expect, test, type Page } from '@playwright/test';
import { BUTTON_ACTIVATION_DURATION_MS } from '../src/lib/ui-timing';
import { localizedMessageRegex } from './i18n';

type ClipboardMode = 'normal' | 'write-fails';
type MetaPayload = {
	groups: Array<{ codeRaw: string }>;
	weeks: Array<{ value: string }>;
};
type SchedulePayload = {
	cohorts: Array<{ code: string; track: string }>;
	events: unknown[];
};
const exportButtonNameRe = localizedMessageRegex('copy_calendar_link');
const copiedStatusRe = localizedMessageRegex('copied');

function splitCohortsFromUrl(url: string): string[] {
	const value = new URL(url).searchParams.get('cohorts') ?? '';
	return value
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean);
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

async function fetchRequiredCohorts(page: Page, group: string, week: string): Promise<string[]> {
	const scheduleResponse = await page.request.get(
		`/api/schedule?group=${encodeURIComponent(group)}&week=${encodeURIComponent(week)}`
	);
	expect(scheduleResponse.ok()).toBe(true);
	const schedule = (await scheduleResponse.json()) as SchedulePayload;
	if (schedule.events.length === 0) return [];

	const sorted = [...schedule.cohorts].sort(
		(a, b) => a.track.localeCompare(b.track) || a.code.localeCompare(b.code)
	);
	const onePerTrack = new Map<string, string>();
	for (const cohort of sorted) {
		if (!onePerTrack.has(cohort.track)) onePerTrack.set(cohort.track, cohort.code);
	}

	return [...onePerTrack.values()];
}

async function readRenderedScheduleSignature(page: Page): Promise<string> {
	const scheduleTable = page.getByRole('table');
	if ((await scheduleTable.count()) > 0) {
		return ((await scheduleTable.locator('tbody').textContent()) ?? '').trim();
	}

	return `main:${((await page.getByRole('main').textContent()) ?? '').trim()}`;
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
			const cohorts = await fetchRequiredCohorts(page, group, week);
			if (cohorts.length > 0) {
				return { group, week, cohorts };
			}
		}
	}

	return null;
}

function buildScheduleUrl(group: string, week: string, cohorts: string[] = []): string {
	const params = new URLSearchParams({
		group,
		week
	});
	if (cohorts.length > 0) {
		params.set('cohorts', cohorts.join(','));
	}
	return `/?${params.toString()}`;
}

test.describe('calendar export', () => {
	test('change rendered schedule and persist cohorts in url', async ({ page }) => {
		const meta = await fetchMeta(page);
		const scenario = await findScenarioWithRequiredCohorts(page, meta);
		test.skip(!scenario, 'No group/week with required cohorts in available fixture set');
		const { group, week, cohorts } = scenario!;

		await page.goto(buildScheduleUrl(group, week));
		const initialSignature = await readRenderedScheduleSignature(page);

		await page.goto(buildScheduleUrl(group, week, cohorts));
		await expect(page).toHaveURL(/cohorts=/, { timeout: 5000 });

		const filteredSignature = await readRenderedScheduleSignature(page);
		expect(filteredSignature).not.toBe(initialSignature);
		expect(splitCohortsFromUrl(page.url())).toEqual(cohorts);
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

		await page.goto(buildScheduleUrl(targetGroup, targetWeek, selectedCohorts));
		expect(splitCohortsFromUrl(page.url())).toEqual(selectedCohorts);

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

		await page.goto(buildScheduleUrl(group, week, cohorts));

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
