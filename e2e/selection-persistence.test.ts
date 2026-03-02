import { expect, test, type Page } from '@playwright/test';
import { toSlug } from '../src/lib/url-slug';

type MetaPayload = {
	groups: Array<{ codeRaw: string; codeRu: string }>;
	weeks: Array<{ value: string }>;
};
type SchedulePayload = {
	cohorts: Array<{ code: string; track: string }>;
};
type CohortScenario = {
	group: string;
	week: string;
	initialCode: string;
	targetCode: string;
};

function randomItem<T>(items: T[]): T | undefined {
	if (items.length === 0) return undefined;
	return items[Math.floor(Math.random() * items.length)];
}

function groupSlug(meta: MetaPayload, codeRaw: string): string {
	const group = meta.groups.find((g) => g.codeRaw === codeRaw);
	return group ? toSlug(group.codeRu) : toSlug(codeRaw);
}

function unique<T>(items: T[]): T[] {
	return [...new Set(items)];
}

async function addSelectionCookies(
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

async function findScenarioWithAlternativeCohorts(
	page: Page,
	meta: MetaPayload
): Promise<CohortScenario | null> {
	const candidateGroups = unique([
		meta.groups.at(-1)?.codeRaw ?? '',
		meta.groups[0]?.codeRaw ?? '',
		meta.groups[Math.floor(meta.groups.length / 2)]?.codeRaw ?? ''
	]).filter(Boolean);
	const candidateWeeks = unique([
		meta.weeks[0]?.value ?? '',
		meta.weeks[Math.floor(meta.weeks.length / 2)]?.value ?? ''
	]).filter(Boolean);

	for (const week of candidateWeeks) {
		for (const group of candidateGroups) {
			const response = await page.request.get(
				`/api/schedule?group=${encodeURIComponent(group)}&week=${encodeURIComponent(week)}`
			);
			if (!response.ok()) continue;
			const payload = (await response.json()) as SchedulePayload;
			const sorted = [...payload.cohorts].sort(
				(a, b) => a.track.localeCompare(b.track) || a.code.localeCompare(b.code)
			);
			if (sorted.length === 0) continue;

			const byTrack = new Map<string, string[]>();
			for (const cohort of sorted) {
				const codes = byTrack.get(cohort.track) ?? [];
				if (!codes.includes(cohort.code)) codes.push(cohort.code);
				byTrack.set(cohort.track, codes);
			}

			const tracks = [...byTrack.keys()];
			const track = tracks.find((t) => (byTrack.get(t)?.length ?? 0) > 1);
			if (!track) continue;
			const codes = byTrack.get(track)!;

			return {
				group,
				week,
				initialCode: codes[0]!,
				targetCode: codes[1]!
			};
		}
	}

	return null;
}

async function cookieHeader(page: Page): Promise<string> {
	const allowedNames = new Set(['dku_group', 'dku_week', 'dku_cohorts']);
	const cookies = await page.context().cookies();
	return cookies
		.filter((cookie) => allowedNames.has(cookie.name))
		.map((cookie) => `${cookie.name}=${encodeURIComponent(cookie.value)}`)
		.join('; ');
}

async function cookieValue(page: Page, name: string): Promise<string | undefined> {
	return (await page.context().cookies()).find((cookie) => cookie.name === name)?.value;
}

test.describe('selection persistence', () => {
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

		await addSelectionCookies(page, { group: group!.codeRaw, week: week!.value });
		const slug = toSlug(group!.codeRu);
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

		await addSelectionCookies(page, {
			group: initialGroup!.codeRaw,
			week: week!.value
		});

		const initialSlug = groupSlug(meta, initialGroup!.codeRaw);
		const initialPath = `/${initialSlug}`;

		await page.goto(`/${initialSlug}`);
		await expect(page).toHaveURL(new RegExp(`/${initialSlug}$`), {
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

	test('keep selected cohorts for next root request', async ({ page }) => {
		const metaResponse = await page.request.get('/api/meta');
		expect(metaResponse.ok()).toBe(true);
		const meta = (await metaResponse.json()) as MetaPayload;
		const scenario = await findScenarioWithAlternativeCohorts(page, meta);
		test.skip(!scenario, 'No group/week with at least two selectable cohorts in one track');

		const slug = groupSlug(meta, scenario!.group);
		await addSelectionCookies(page, {
			group: scenario!.group,
			week: scenario!.week,
			cohorts: scenario!.initialCode
		});
		await page.goto(`/${slug}`);
		await expect(page).toHaveURL(new RegExp(`/${slug}$`), {
			timeout: 5_000
		});
		await expect(await cookieValue(page, 'dku_cohorts')).toBe(scenario!.initialCode);

		const probe = Date.now();
		const rootResponse = await page.request.get(`/?persist_probe=${probe}`, {
			maxRedirects: 0,
			headers: { cookie: await cookieHeader(page) }
		});
		expect(rootResponse.status()).toBe(302);
		const location = rootResponse.headers()['location'];
		expect(location).toBeTruthy();

		const restoredUrl = new URL(location!, 'http://localhost');
		expect(restoredUrl.pathname).toBe(`/${slug}`);
		expect(restoredUrl.searchParams.get('cohorts')).toBeNull();
		expect(restoredUrl.searchParams.get('week')).toBeNull();
		expect(restoredUrl.searchParams.get('persist_probe')).toBe(String(probe));
	});

	test('update persisted cohorts after user changes selection', async ({ page }) => {
		const metaResponse = await page.request.get('/api/meta');
		expect(metaResponse.ok()).toBe(true);
		const meta = (await metaResponse.json()) as MetaPayload;
		const scenario = await findScenarioWithAlternativeCohorts(page, meta);
		test.skip(!scenario, 'No group/week with at least two selectable cohorts in one track');

		const slug = groupSlug(meta, scenario!.group);
		await addSelectionCookies(page, {
			group: scenario!.group,
			week: scenario!.week,
			cohorts: scenario!.initialCode
		});
		await page.goto(`/${slug}`);
		await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

		const toolbarButtons = page.getByRole('toolbar').locator('button[data-nav-select]');
		const buttonCount = await toolbarButtons.count();
		test.skip(buttonCount < 3, 'No cohort select controls available');
		let cohortTrigger = toolbarButtons.nth(2);
		for (let i = 2; i < buttonCount; i += 1) {
			const candidate = toolbarButtons.nth(i);
			const text = ((await candidate.textContent()) ?? '').trim();
			if (text.includes(scenario!.initialCode)) {
				cohortTrigger = candidate;
				break;
			}
		}
		await expect(cohortTrigger).toBeVisible({ timeout: 5_000 });
		const selectedLabel = ((await cohortTrigger.textContent()) ?? '').trim();
		await cohortTrigger.click();
		const options = page.getByRole('option');
		const optionCount = await options.count();
		test.skip(optionCount < 2, 'Need at least two selectable cohort options');
		let targetIndex: number | undefined;
		for (let i = 0; i < optionCount; i += 1) {
			const label = ((await options.nth(i).textContent()) ?? '').trim();
			if (!label || label === selectedLabel) continue;
			if (label.includes(scenario!.targetCode)) {
				targetIndex = i;
				break;
			}
			if (targetIndex === undefined) targetIndex = i;
		}
		test.skip(targetIndex === undefined, 'No alternative cohort option found');
		const targetOption = options.nth(targetIndex!);
		await expect(targetOption).toBeVisible({ timeout: 5_000 });
		await targetOption.click();

		await expect.poll(() => cookieValue(page, 'dku_cohorts')).not.toBe(scenario!.initialCode);

		const probe = Date.now();
		const rootResponse = await page.request.get(`/?persist_probe=${probe}`, {
			maxRedirects: 0,
			headers: { cookie: await cookieHeader(page) }
		});
		expect(rootResponse.status()).toBe(302);
		const location = rootResponse.headers()['location'];
		expect(location).toBeTruthy();

		const restoredUrl = new URL(location!, 'http://localhost');
		expect(restoredUrl.pathname).toBe(`/${slug}`);
		expect(restoredUrl.searchParams.get('cohorts')).toBeNull();
		expect(restoredUrl.searchParams.get('week')).toBeNull();
		expect(restoredUrl.searchParams.get('persist_probe')).toBe(String(probe));
	});
});
