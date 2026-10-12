import { expect, test } from '@playwright/test';

test.describe('app health', () => {
	test('serves uncached liveness for GET and HEAD', async ({ request }) => {
		const response = await request.get('/api/health');
		expect(response.status()).toBe(200);
		expect(await response.json()).toEqual({ status: 'ok' });
		expect(response.headers()['cache-control']).toBe('no-store');
		const head = await request.head('/api/health');
		expect(head.status()).toBe(200);
		expect(await head.text()).toBe('');
	});

	test('rejects a file probe on both localized routes', async ({ request }) => {
		for (const path of ['/wp-login.php', '/de/wp-login.php']) {
			const response = await request.get(path);
			expect(response.status()).toBe(404);
		}
	});

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
