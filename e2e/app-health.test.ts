import { expect, test } from '@playwright/test';

test.describe('app health', () => {
	test('load main page without server error', async ({ page }) => {
		const response = await page.goto('/');
		expect(response?.status()).toBeLessThan(500);
	});

	test('render schedule with content', async ({ page }) => {
		await page.goto('/');
		const scheduleTable = page.getByRole('table');

		await expect(scheduleTable).toBeVisible({ timeout: 15_000 });
		await expect(page.getByRole('toolbar').getByRole('button').first()).toBeVisible();
	});
});
