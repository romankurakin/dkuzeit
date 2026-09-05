import { beforeEach, describe, expect, it, vi } from 'vitest';

const { countMock, distributionMock } = vi.hoisted(() => ({
	countMock: vi.fn(),
	distributionMock: vi.fn()
}));

vi.mock('@sentry/sveltekit', () => ({
	metrics: {
		count: countMock,
		distribution: distributionMock
	}
}));

import {
	recordCacheAccess,
	recordCalendarSubscription,
	recordHtmlInputBytes,
	recordTimetableOutput
} from '../../src/lib/server/metrics';

describe('application metrics', () => {
	beforeEach(() => vi.clearAllMocks());

	it('records cache access without the high-cardinality cache key', () => {
		recordCacheAccess('schedule:05:123', false);

		expect(countMock).toHaveBeenCalledWith('dku.cache.access', 1, {
			attributes: { 'cache.kind': 'schedule', 'cache.result': 'miss' }
		});
	});

	it('records HTML input size with a low-cardinality source kind', () => {
		recordHtmlInputBytes('05/c/c00123.htm', 4096);

		expect(distributionMock).toHaveBeenCalledWith('dku.html.input_bytes', 4096, {
			unit: 'byte',
			attributes: { 'html.parser': 'htmlparser2', 'source.kind': 'schedule' }
		});
	});

	it('records parser output counts', () => {
		recordTimetableOutput(42, 3);

		expect(distributionMock).toHaveBeenNthCalledWith(1, 'dku.timetable.events', 42, {
			attributes: { 'source.kind': 'schedule' }
		});
		expect(distributionMock).toHaveBeenNthCalledWith(2, 'dku.timetable.cohorts', 3, {
			attributes: { 'source.kind': 'schedule' }
		});
	});

	it('records a calendar subscription with locale only', () => {
		recordCalendarSubscription('ru');

		expect(countMock).toHaveBeenCalledWith('dku.calendar.subscription', 1, {
			attributes: { 'ui.locale': 'ru' }
		});
	});
});
