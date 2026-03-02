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
	const allowedNames = new Set(['dku_group', 'dku_week', 'dku_cohorts']);
	const cookies = await page.context().cookies();
	return cookies
		.filter((cookie) => allowedNames.has(cookie.name))
		.map((cookie) => `${cookie.name}=${encodeURIComponent(cookie.value)}`)
		.join('; ');
}

async function setSelectionCookies(
	page: Page,
	opts: { group: string; week: string; cohorts?: string }
): Promise<void> {
	const values: Array<{ name: string; value: string }> = [
		{ name: 'dku_group', value: opts.group },
		{ name: 'dku_week', value: opts.week }
	];
	if (opts.cohorts !== undefined) {
		values.push({ name: 'dku_cohorts', value: opts.cohorts });
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
			await expect(page).toHaveURL(/\/[^/?]+$/, { timeout: 5_000 });
		} else {
			await expect(groupTrigger).toHaveAttribute('aria-haspopup', 'listbox');
		}

		await expect(scheduleTable).toBeVisible({ timeout: 15_000 });
	});

	test('update schedule data on group and week selection cookies', async ({ page }) => {
		await page.goto('/');
		const scheduleTable = page.getByRole('table');
		await expect(scheduleTable).toBeVisible({ timeout: 15_000 });

		const firstDayHeader = page.getByRole('columnheader').nth(1);
		const tableBody = page.locator('table tbody');
		const initialHeader = ((await firstDayHeader.textContent()) ?? '').trim();
		const initialBodySignature = ((await tableBody.textContent()) ?? '').trim();

		const metaResponse = await page.request.get('/api/meta');
		expect(metaResponse.ok()).toBe(true);
		const meta = (await metaResponse.json()) as MetaPayload;
		expect(meta.groups.length).toBeGreaterThan(0);
		expect(meta.weeks.length).toBeGreaterThan(0);

		const currentPath = new URL(page.url()).pathname;
		const currentSlug = currentPath.replace(/^\/(?:de\/)?/, '');
		const currentGroupValue =
			meta.groups.find((group) => toSlug(group.codeRu) === currentSlug)?.codeRaw ??
			meta.groups[0]!.codeRaw;
		const currentWeekValue = meta.weeks[0]!.value;
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

		await setSelectionCookies(page, {
			group: targetGroup,
			week: targetWeek
		});
		const targetSlug = groupSlug(meta, targetGroup);
		await page.goto(`/${targetSlug}`);
		await expect(page).toHaveURL(new RegExp(`/${targetSlug}$`), {
			timeout: 5_000
		});
		await expect(scheduleTable).toBeVisible({ timeout: 15_000 });

		const updatedHeader = ((await firstDayHeader.textContent()) ?? '').trim();
		const updatedBodySignature = ((await tableBody.textContent()) ?? '').trim();
		expect(updatedHeader !== initialHeader || updatedBodySignature !== initialBodySignature).toBe(
			true
		);
	});

	test('strip state query params from URL', async ({ page }) => {
		const metaResponse = await page.request.get('/api/meta');
		expect(metaResponse.ok()).toBe(true);
		const meta = (await metaResponse.json()) as MetaPayload;
		const group = meta.groups[0]!;
		const week = meta.weeks[0]!;

		await page.goto(
			`/?group=${encodeURIComponent(group.codeRaw)}&week=${encodeURIComponent(week.value)}&cohorts=WPM1&probe=1`
		);
		const currentUrl = new URL(page.url());
		expect(currentUrl.searchParams.get('group')).toBeNull();
		expect(currentUrl.searchParams.get('week')).toBeNull();
		expect(currentUrl.searchParams.get('cohorts')).toBeNull();
		expect(currentUrl.searchParams.get('probe')).toBe('1');
	});

	test('return 404 for unknown group path', async ({ page }) => {
		const response = await page.goto('/unknown-group');
		expect(response).not.toBeNull();
		expect(response!.status()).toBe(404);
		await expect(page.getByRole('heading', { level: 2 })).toContainText(
			localizedMessageRegex('not_found_title')
		);
	});

	test('restore selected group from cookie on next root request', async ({ page }) => {
		const metaResponse = await page.request.get('/api/meta');
		expect(metaResponse.ok()).toBe(true);
		const meta = (await metaResponse.json()) as MetaPayload;
		const group = meta.groups[0];
		const week = meta.weeks[0];
		test.skip(!group || !week, 'No groups or weeks available in upstream meta');

		const slug = toSlug(group!.codeRu);
		await setSelectionCookies(page, {
			group: group!.codeRaw,
			week: week!.value
		});
		await page.goto(`/${slug}`);
		await expect(page).toHaveURL(new RegExp(`/${slug}$`), {
			timeout: 5_000
		});

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
