import { describe, expect, it, vi } from 'vitest';
import { openCalendarSubscription, toWebcalLink } from '../../src/lib/scheduler/calendar-link';

describe('calendar link helpers', () => {
	it('convert http and https links to webcal', () => {
		expect(toWebcalLink('https://example.com/api/calendar?token=1')).toBe(
			'webcal://example.com/api/calendar?token=1'
		);
		expect(toWebcalLink('http://example.com/api/calendar?token=2')).toBe(
			'webcal://example.com/api/calendar?token=2'
		);
	});

	it('attempt opening calendar subscription through provided assign function', () => {
		const assign = vi.fn();
		const ok = openCalendarSubscription('webcal://example.com/calendar', assign);

		expect(ok).toBe(true);
		expect(assign).toHaveBeenCalledTimes(1);
		expect(assign).toHaveBeenCalledWith('webcal://example.com/calendar');
	});

	it('report failed opening when assign throws', () => {
		const assign = vi.fn(() => {
			throw new Error('blocked');
		});

		const ok = openCalendarSubscription('webcal://example.com/calendar', assign);
		expect(ok).toBe(false);
		expect(assign).toHaveBeenCalledTimes(1);
	});
});
