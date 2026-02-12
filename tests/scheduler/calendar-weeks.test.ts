import { describe, expect, it } from 'vitest';
import { pickRollingWeeksForCalendar } from '../../src/lib/server/dku';
import type { WeekOption } from '../../src/lib/server/types';

const weeks: WeekOption[] = [
	{ value: '08', label: 'Week 8', startDateIso: '2026-02-23' },
	{ value: '06', label: 'Week 6', startDateIso: '2026-02-09' },
	{ value: '07', label: 'Week 7', startDateIso: '2026-02-16' },
	{ value: '09', label: 'Week 9', startDateIso: '2026-03-02' }
];

describe('dku pick rolling weeks for calendar', () => {
	it('use current week when anchor week is in the past', () => {
		const selected = pickRollingWeeksForCalendar(weeks, '06', {
			now: new Date('2026-02-19T12:00:00Z'),
			windowSize: 2
		});

		expect(selected.map((item) => item.value)).toEqual(['07', '08']);
	});

	it('respect a future anchor week', () => {
		const selected = pickRollingWeeksForCalendar(weeks, '09', {
			now: new Date('2026-02-19T12:00:00Z'),
			windowSize: 2
		});

		expect(selected.map((item) => item.value)).toEqual(['09']);
	});

	it('fall back to earliest week when current and anchor are unknown', () => {
		const selected = pickRollingWeeksForCalendar(weeks, '99', {
			now: new Date('2026-01-01T00:00:00Z'),
			windowSize: 2
		});

		expect(selected.map((item) => item.value)).toEqual(['06', '07']);
	});
});
