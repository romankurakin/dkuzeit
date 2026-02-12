import { describe, expect, it } from 'vitest';
import { todayInAlmaty } from '../../src/lib/server/time';

describe('time today in almaty', () => {
	it('return almaty date when utc is still previous day', () => {
		// 2026-02-10 01:30 UTC → 2026-02-10 06:30 Almaty (UTC+5)
		expect(todayInAlmaty(new Date('2026-02-10T01:30:00Z'))).toBe('2026-02-10');
	});

	it('return next almaty day when utc is late evening', () => {
		// 2026-02-09 20:00 UTC → 2026-02-10 01:00 Almaty (UTC+5)
		expect(todayInAlmaty(new Date('2026-02-09T20:00:00Z'))).toBe('2026-02-10');
	});

	it('return same day when both utc and almaty agree', () => {
		// 2026-02-09 12:00 UTC → 2026-02-09 17:00 Almaty
		expect(todayInAlmaty(new Date('2026-02-09T12:00:00Z'))).toBe('2026-02-09');
	});

	it('handle almaty midnight boundary exactly', () => {
		// 2026-02-09 19:00 UTC → 2026-02-10 00:00 Almaty
		expect(todayInAlmaty(new Date('2026-02-09T19:00:00Z'))).toBe('2026-02-10');
	});

	it('return iso format yyyy mm dd with zero padded month and day', () => {
		expect(todayInAlmaty(new Date('2026-01-05T00:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});
