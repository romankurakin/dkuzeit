import { expect, test, type Page } from '@playwright/test';
import { toSlug } from '../src/lib/url-slug';
import { localizedMessageRegex } from './i18n';

type MetaPayload = {
	groups: Array<{ codeRaw: string; codeRu: string }>;
	weeks: Array<{ value: string }>;
};
type SchedulePayload = { events: unknown[] };

function groupSlug(meta: MetaPayload, codeRaw: string): string {
	const group = meta.groups.find((g) => g.codeRaw === codeRaw);
	return group ? toSlug(group.codeRu) : toSlug(codeRaw);
}

async function hasEvents(page: Page, group: string, week: string): Promise<boolean> {
	const response = await page.request.get(
		`/api/schedule?group=${encodeURIComponent(group)}&week=${encodeURIComponent(week)}`
	);
	if (!response.ok()) return false;
	const payload = (await response.json()) as SchedulePayload;
	return payload.events.length > 0;
}

async function cookieHeader(page: Page): Promise<string> {
	const cookies = await page.context().cookies();
	return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

test.describe('schedule navigation', () => {
	test('navigate on group change without crash', async ({ page }) => {
		await page.goto('/');
		const scheduleTable = page.getByRole('table');
		await expect(scheduleTable).toBeVisible({ timeout: 15_000 });

		const metaResponse = await page.request.get('/api/meta');
		expect(metaResponse.ok()).toBe(true);
		const meta = (await metaResponse.json()) as MetaPayload;
		expect(meta.groups.length).toBeGreaterThan(1);

		const groupTrigger = page.getByRole('toolbar').getByRole('button').first();
		await expect(groupTrigger).toBeVisible({ timeout: 15_000 });
		await groupTrigger.click();

		const optionElements = page.getByRole('option');
		const optionCount = await optionElements.count();
		const targetOption = optionElements.nth(Math.min(1, Math.max(0, optionCount - 1)));
		const hasOptions =
			optionCount > 0 && (await targetOption.isVisible({ timeout: 3_000 }).catch(() => false));

		if (hasOptions) {
			await targetOption.click();
			await expect(page).toHaveURL(/\/[^/?]+\?/, { timeout: 5_000 });
		} else {
			await expect(groupTrigger).toHaveAttribute('aria-haspopup', 'listbox');
		}

		await expect(scheduleTable).toBeVisible({ timeout: 15_000 });
	});

	test('update schedule data on group and week change', async ({ page }) => {
		await page.goto('/');
		const scheduleTable = page.getByRole('table');
		await expect(scheduleTable).toBeVisible({ timeout: 15_000 });

		const firstDayHeader = page.getByRole('columnheader').nth(1);
		const tableBody = page.locator('table tbody');
		const groupTrigger = page.getByRole('toolbar').getByRole('button').first();

		const initialHeader = ((await firstDayHeader.textContent()) ?? '').trim();
		const initialBodySignature = ((await tableBody.textContent()) ?? '').trim();

		const metaResponse = await page.request.get('/api/meta');
		expect(metaResponse.ok()).toBe(true);
		const meta = (await metaResponse.json()) as MetaPayload;
		expect(meta.groups.length).toBeGreaterThan(1);
		expect(meta.weeks.length).toBeGreaterThan(1);

		const groupTriggerText = ((await groupTrigger.textContent()) ?? '').trim();
		const currentUrl = new URL(page.url());
		const pathSegments = currentUrl.pathname
			.replace(/^\/(?:de\/)?/, '')
			.split('/')
			.filter(Boolean);
		const currentGroupValue =
			meta.groups.find((group) => groupTriggerText.includes(group.codeRaw))?.codeRaw ??
			meta.groups.find((group) => toSlug(group.codeRu) === pathSegments[0])?.codeRaw ??
			meta.groups[0]!.codeRaw;
		const currentWeekValue = currentUrl.searchParams.get('week') ?? meta.weeks[0]!.value;
		let targetGroup = currentGroupValue;
		let targetWeek = currentWeekValue;
		outer: for (const week of [currentWeekValue, ...meta.weeks.map((item) => item.value)]) {
			for (const group of meta.groups) {
				if (group.codeRaw === currentGroupValue && week === currentWeekValue) continue;
				if (await hasEvents(page, group.codeRaw, week)) {
					targetGroup = group.codeRaw;
					targetWeek = week;
					break outer;
				}
			}
		}

		test.skip(
			targetGroup === currentGroupValue && targetWeek === currentWeekValue,
			'No alternative group/week with schedule events in available fixture set'
		);

		const targetSlug = groupSlug(meta, targetGroup);
		await page.goto(`/${targetSlug}?week=${targetWeek}`);
		await expect(page).toHaveURL(new RegExp(`/${targetSlug}\\?.*week=${targetWeek}`), {
			timeout: 5_000
		});
		await expect(scheduleTable).toBeVisible({ timeout: 15_000 });

		const updatedHeader = ((await firstDayHeader.textContent()) ?? '').trim();
		const updatedBodySignature = ((await tableBody.textContent()) ?? '').trim();
		expect(updatedHeader !== initialHeader || updatedBodySignature !== initialBodySignature).toBe(
			true
		);
	});

	test('redirect old query-param URLs to path-based URLs', async ({ page }) => {
		const metaResponse = await page.request.get('/api/meta');
		expect(metaResponse.ok()).toBe(true);
		const meta = (await metaResponse.json()) as MetaPayload;
		const group = meta.groups[0]!;
		const week = meta.weeks[0]!;
		const slug = toSlug(group.codeRu);

		await page.goto(
			`/?group=${encodeURIComponent(group.codeRaw)}&week=${encodeURIComponent(week.value)}`
		);
		await expect(page).toHaveURL(new RegExp(`/${slug}\\?.*week=${week.value}`), {
			timeout: 5_000
		});
		await expect(page).not.toHaveURL(/[?&]group=/, { timeout: 1_000 });
	});

	test('redirect old query-param URLs and preserve cohorts', async ({ page }) => {
		const metaResponse = await page.request.get('/api/meta');
		expect(metaResponse.ok()).toBe(true);
		const meta = (await metaResponse.json()) as MetaPayload;
		const group = meta.groups[0]!;
		const week = meta.weeks[0]!;
		const slug = toSlug(group.codeRu);

		await page.goto(
			`/?group=${encodeURIComponent(group.codeRaw)}&week=${encodeURIComponent(week.value)}&cohorts=WPM1`
		);
		await expect(page).toHaveURL(new RegExp(`/${slug}\\?.*week=${week.value}`), {
			timeout: 5_000
		});
		await expect(page).toHaveURL(/cohorts=WPM1/, { timeout: 1_000 });
	});

	test('return 404 for unknown legacy group query param', async ({ page }) => {
		const metaResponse = await page.request.get('/api/meta');
		expect(metaResponse.ok()).toBe(true);
		const meta = (await metaResponse.json()) as MetaPayload;
		const week = meta.weeks[0]?.value;
		test.skip(!week, 'No weeks available in upstream meta');

		const response = await page.goto(
			`/?group=unknown-group&week=${encodeURIComponent(week ?? '')}`
		);
		expect(response).not.toBeNull();
		expect(response!.status()).toBe(404);
		await expect(page.getByRole('heading', { level: 2 })).toContainText(
			localizedMessageRegex('not_found_title')
		);
	});

	test('keep selected group for next root request', async ({ page }) => {
		const metaResponse = await page.request.get('/api/meta');
		expect(metaResponse.ok()).toBe(true);
		const meta = (await metaResponse.json()) as MetaPayload;
		const group = meta.groups[1] ?? meta.groups[0];
		test.skip(!group, 'No groups available in upstream meta');

		const slug = toSlug(group!.codeRu);
		await page.context().addCookies([
			{
				name: 'dku_group',
				value: group!.codeRaw,
				domain: 'localhost',
				path: '/',
				sameSite: 'Lax'
			}
		]);

		const probe = Date.now();
		const rootResponse = await page.request.get(`/?persist_probe=${probe}`, {
			maxRedirects: 0,
			headers: { cookie: await cookieHeader(page) }
		});
		expect(rootResponse.status()).toBe(302);
		expect(rootResponse.headers()['location']).toMatch(
			new RegExp(`/${slug}\\?.*persist_probe=${probe}`)
		);
	});

	test('restore selected group from legacy query flow on next root request', async ({ page }) => {
		const metaResponse = await page.request.get('/api/meta');
		expect(metaResponse.ok()).toBe(true);
		const meta = (await metaResponse.json()) as MetaPayload;
		const group = meta.groups[0];
		const week = meta.weeks[0];
		test.skip(!group || !week, 'No groups or weeks available in upstream meta');

		const slug = toSlug(group!.codeRu);
		await page.goto(
			`/?group=${encodeURIComponent(group!.codeRaw)}&week=${encodeURIComponent(week!.value)}`
		);
		await expect(page).toHaveURL(new RegExp(`/${slug}\\?.*week=${week!.value}`), {
			timeout: 5_000
		});

		const cookies = await page.context().cookies();
		expect(cookies.some((c) => c.name === 'dku_group' && c.value === group!.codeRaw)).toBe(true);

		const probe = Date.now();
		const rootResponse = await page.request.get(`/?persist_probe=${probe}`, {
			maxRedirects: 0,
			headers: { cookie: await cookieHeader(page) }
		});
		expect(rootResponse.status()).toBe(302);
		expect(rootResponse.headers()['location']).toMatch(
			new RegExp(`/${slug}\\?.*persist_probe=${probe}`)
		);
	});
});
