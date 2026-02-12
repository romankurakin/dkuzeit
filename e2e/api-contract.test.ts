import { expect, test } from '@playwright/test';

test.describe('api contract', () => {
	test('return 404 for unknown group on api schedule', async ({ page }) => {
		const response = await page.request.get('/api/schedule?group=__unknown_group__');
		expect(response.status()).toBe(404);
	});

	test('return 404 for unknown group on api token', async ({ page }) => {
		const metaResponse = await page.request.get('/api/meta');
		expect(metaResponse.ok()).toBe(true);
		const meta = (await metaResponse.json()) as { weeks: Array<{ value: string }> };
		const week = meta.weeks[0]?.value ?? '';
		expect(week).not.toBe('');

		const response = await page.request.post('/api/token', {
			data: {
				group: '__unknown_group__',
				week,
				cohorts: [],
				lang: 'ru'
			}
		});

		expect(response.status()).toBe(404);
	});

	test('reject invalid token on api calendar', async ({ page }) => {
		const response = await page.request.get('/api/calendar?token=invalid-token');
		expect([403, 500]).toContain(response.status());
	});
});
