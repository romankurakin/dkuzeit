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
	await expect(page.locator('text=Группа')).toBeVisible({ timeout: 15_000 });

	// Click the group select trigger
	const groupTrigger = page.locator('label:has-text("Группа") button');
	await groupTrigger.click();

	// Pick the second option if available
	const options = page.locator('[data-bits-select-item]');
	const count = await options.count();
	if (count > 1) {
		await options.nth(1).click();

		// URL should update with group param
		await expect(page).toHaveURL(/group=/, { timeout: 5_000 });

		// Page should still render without error
		await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });
	}
});
