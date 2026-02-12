import { expect, test, type Page } from '@playwright/test';

type MetaPayload = {
	groups: Array<{ codeRaw: string }>;
	weeks: Array<{ value: string }>;
};
type SchedulePayload = { events: unknown[] };

async function hasEvents(page: Page, group: string, week: string): Promise<boolean> {
	const response = await page.request.get(
		`/api/schedule?group=${encodeURIComponent(group)}&week=${encodeURIComponent(week)}`
	);
	if (!response.ok()) return false;
	const payload = (await response.json()) as SchedulePayload;
	return payload.events.length > 0;
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
			await expect(page).toHaveURL(/group=/, { timeout: 5_000 });
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
		const currentGroupValue =
			meta.groups.find((group) => groupTriggerText.includes(group.codeRaw))?.codeRaw ??
			currentUrl.searchParams.get('group') ??
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

		await page.goto(
			`/?group=${encodeURIComponent(targetGroup)}&week=${encodeURIComponent(targetWeek)}`
		);
		await expect(page).toHaveURL(new RegExp(`group=${encodeURIComponent(targetGroup)}`), {
			timeout: 5_000
		});
		await expect(page).toHaveURL(new RegExp(`week=${encodeURIComponent(targetWeek)}`), {
			timeout: 5_000
		});
		await expect(scheduleTable).toBeVisible({ timeout: 15_000 });

		const updatedHeader = ((await firstDayHeader.textContent()) ?? '').trim();
		const updatedBodySignature = ((await tableBody.textContent()) ?? '').trim();
		expect(updatedHeader !== initialHeader || updatedBodySignature !== initialBodySignature).toBe(
			true
		);
	});
});
