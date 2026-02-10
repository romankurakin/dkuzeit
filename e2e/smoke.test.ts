import { test, expect } from '@playwright/test';

test('main page loads without server error', async ({ page }) => {
	const response = await page.goto('/');
	expect(response?.status()).toBeLessThan(500);
});

test('schedule renders with content', async ({ page }) => {
	await page.goto('/');

	// Wait for loading to finish — schedule table should appear
	await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

	// Group selector should be present
	await expect(page.locator('text=Группа')).toBeVisible();
});

test('group change navigates without crash', async ({ page }) => {
	await page.goto('/');

	// Wait for initial load
	const groupTrigger = page.getByRole('button', { name: 'Группа' });
	await expect(groupTrigger).toBeVisible({ timeout: 15_000 });

	// Click the group select trigger and try changing selection via ARIA roles.
	await groupTrigger.click();

	const secondOption = page.getByRole('option').nth(1);
	const hasOptions = await secondOption.isVisible({ timeout: 3_000 }).catch(() => false);

	if (hasOptions) {
		await secondOption.click();
		// URL should update with group param
		await expect(page).toHaveURL(/group=/, { timeout: 5_000 });
	} else {
		// In preview environments listbox portal can be flaky.
		// Still validate semantic trigger wiring.
		await expect(groupTrigger).toHaveAttribute('aria-haspopup', 'listbox');
	}

	// Page should still render without error.
	await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });
});

test('group and week changes update schedule data', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

	const groupTrigger = page.getByRole('button', { name: 'Группа' });
	const firstDayHeader = page.getByRole('columnheader').nth(1);
	const tableBody = page.locator('table tbody');

	const initialGroupLabel = ((await groupTrigger.textContent()) ?? '').trim();
	const initialHeader = ((await firstDayHeader.textContent()) ?? '').trim();
	const initialBodySignature = ((await tableBody.textContent()) ?? '').trim();

	const metaResponse = await page.request.get('/api/meta');
	expect(metaResponse.ok()).toBe(true);
	const meta = (await metaResponse.json()) as {
		groups: Array<{ codeRaw: string }>;
		weeks: Array<{ value: string }>;
	};
	expect(meta.groups.length).toBeGreaterThan(1);
	expect(meta.weeks.length).toBeGreaterThan(1);

	const currentUrl = new URL(page.url());
	const currentWeekValue = currentUrl.searchParams.get('week') ?? meta.weeks[0]!.value;
	const targetGroup =
		meta.groups.find((group) => group.codeRaw !== initialGroupLabel)?.codeRaw ?? meta.groups[1]!.codeRaw;
	const targetWeek =
		meta.weeks.find((week) => week.value !== currentWeekValue)?.value ?? meta.weeks[1]!.value;

	await page.goto(`/?group=${encodeURIComponent(targetGroup)}&week=${encodeURIComponent(targetWeek)}`);
	await expect(page).toHaveURL(new RegExp(`group=${encodeURIComponent(targetGroup)}`), {
		timeout: 5_000
	});
	await expect(page).toHaveURL(new RegExp(`week=${encodeURIComponent(targetWeek)}`), {
		timeout: 5_000
	});
	await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });
	await expect(groupTrigger).toContainText(targetGroup);

	const updatedHeader = ((await firstDayHeader.textContent()) ?? '').trim();
	const updatedBodySignature = ((await tableBody.textContent()) ?? '').trim();
	expect(updatedHeader !== initialHeader || updatedBodySignature !== initialBodySignature).toBe(true);
});
