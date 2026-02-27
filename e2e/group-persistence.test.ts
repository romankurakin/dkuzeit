import { expect, test, type Page } from '@playwright/test';
import { toSlug } from '../src/lib/url-slug';

type MetaPayload = {
	groups: Array<{ codeRaw: string; codeRu: string }>;
	weeks: Array<{ value: string }>;
};

function randomItem<T>(items: T[]): T | undefined {
	if (items.length === 0) return undefined;
	return items[Math.floor(Math.random() * items.length)];
}

function groupSlug(meta: MetaPayload, codeRaw: string): string {
	const group = meta.groups.find((g) => g.codeRaw === codeRaw);
	return group ? toSlug(group.codeRu) : toSlug(codeRaw);
}

async function cookieHeader(page: Page): Promise<string> {
	const cookies = await page.context().cookies();
	return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

test.describe('group persistence', () => {
	test('keep selected group for next root request', async ({ page }) => {
		const metaResponse = await page.request.get('/api/meta');
		expect(metaResponse.ok()).toBe(true);
		const meta = (await metaResponse.json()) as MetaPayload;
		const group =
			randomItem(meta.groups.slice(2)) ??
			randomItem(meta.groups.slice(1)) ??
			randomItem(meta.groups);
		const week = meta.weeks[0];
		test.skip(!group || !week, 'No groups or weeks available in upstream meta');

		const slug = toSlug(group!.codeRu);
		await page.goto(`/${slug}?week=${week!.value}&open_probe=${Date.now()}`);
		await expect(page).toHaveURL(new RegExp(`/${slug}\\?.*week=${week!.value}`), {
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

	test('update persisted group after user changes selection', async ({ page }) => {
		const metaResponse = await page.request.get('/api/meta');
		expect(metaResponse.ok()).toBe(true);
		const meta = (await metaResponse.json()) as MetaPayload;
		const week = meta.weeks[0];
		const initialGroup =
			randomItem(meta.groups.slice(2)) ??
			randomItem(meta.groups.slice(1)) ??
			randomItem(meta.groups);
		test.skip(
			!initialGroup || !week || meta.groups.length < 2,
			'Need at least two groups and one week'
		);

		await page.context().addCookies([
			{
				name: 'dku_group',
				value: initialGroup!.codeRaw,
				domain: 'localhost',
				path: '/',
				sameSite: 'Lax'
			}
		]);

		const initialSlug = groupSlug(meta, initialGroup!.codeRaw);
		const initialPath = `/${initialSlug}`;

		await page.goto(`/${initialSlug}?week=${week!.value}&change_probe=${Date.now()}`);
		await expect(page).toHaveURL(new RegExp(`/${initialSlug}\\?.*week=${week!.value}`), {
			timeout: 5_000
		});

		const groupTrigger = page.getByRole('toolbar').getByRole('button').first();
		const selectedLabel = ((await groupTrigger.textContent()) ?? '').trim();
		await groupTrigger.click();

		const options = page.getByRole('option');
		const optionCount = await options.count();
		test.skip(optionCount < 2, 'Need at least two selectable group options');

		const candidateIndexes: number[] = [];
		for (let i = 0; i < optionCount; i += 1) {
			const label = ((await options.nth(i).textContent()) ?? '').trim();
			if (!label || label === selectedLabel) continue;
			candidateIndexes.push(i);
		}
		test.skip(candidateIndexes.length === 0, 'No alternative group option found');

		const targetIndex =
			randomItem(candidateIndexes.filter((i) => i >= 2)) ?? randomItem(candidateIndexes);
		const resolvedTargetIndex = targetIndex ?? candidateIndexes[0];
		if (resolvedTargetIndex === undefined) {
			test.skip(true, 'No target option index available');
			return;
		}

		const targetOption = options.nth(resolvedTargetIndex);
		await expect(targetOption).toBeVisible({ timeout: 5_000 });
		await targetOption.click();

		await expect.poll(() => new URL(page.url()).pathname).not.toBe(initialPath);
		const selectedUrl = new URL(page.url());

		const probe = Date.now();
		const rootResponse = await page.request.get(`/?persist_probe=${probe}`, {
			maxRedirects: 0,
			headers: { cookie: await cookieHeader(page) }
		});
		expect(rootResponse.status()).toBe(302);
		const location = rootResponse.headers()['location'];
		expect(location).toBeTruthy();
		const restoredUrl = new URL(location!, 'http://localhost');
		expect(restoredUrl.pathname).toBe(selectedUrl.pathname);
		expect(restoredUrl.searchParams.get('persist_probe')).toBe(String(probe));
	});
});
