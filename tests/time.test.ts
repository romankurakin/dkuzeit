import { describe, expect, it } from 'vitest';
import { todayInAlmaty } from '../src/lib/server/time';

describe('todayInAlmaty', () => {
	it('returns Almaty date when UTC is still previous day', () => {
		// 2026-02-10 01:30 UTC → 2026-02-10 06:30 Almaty (UTC+5)
		expect(todayInAlmaty(new Date('2026-02-10T01:30:00Z'))).toBe('2026-02-10');
	});

	it('returns next Almaty day when UTC is late evening', () => {
		// 2026-02-09 20:00 UTC → 2026-02-10 01:00 Almaty (UTC+5)
		expect(todayInAlmaty(new Date('2026-02-09T20:00:00Z'))).toBe('2026-02-10');
	});

	it('returns same day when both UTC and Almaty agree', () => {
		// 2026-02-09 12:00 UTC → 2026-02-09 17:00 Almaty
		expect(todayInAlmaty(new Date('2026-02-09T12:00:00Z'))).toBe('2026-02-09');
	});

	it('handles Almaty midnight boundary exactly', () => {
		// 2026-02-09 19:00 UTC → 2026-02-10 00:00 Almaty
		expect(todayInAlmaty(new Date('2026-02-09T19:00:00Z'))).toBe('2026-02-10');
	});

	it('returns ISO format YYYY-MM-DD with zero-padded month and day', () => {
		expect(todayInAlmaty(new Date('2026-01-05T00:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});
