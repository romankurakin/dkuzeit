import { beforeEach, describe, expect, it, vi } from 'vitest';

const { countMock } = vi.hoisted(() => ({
	countMock: vi.fn()
}));

vi.mock('@sentry/sveltekit', () => ({
	metrics: {
		count: countMock
	}
}));

import {
	recordCacheAccess,
	recordCalendarSubscription,
	recordUpstreamUnavailable
} from '../../src/lib/server/metrics';

describe('application metrics', () => {
	beforeEach(() => vi.clearAllMocks());

	it('records cache access without the high-cardinality cache key', () => {
		recordCacheAccess('schedule:05:123', false);

		expect(countMock).toHaveBeenCalledWith('dku.cache.access', 1, {
			attributes: { 'cache.kind': 'schedule', 'cache.result': 'miss' }
		});
	});

	it('distinguishes served stale cache entries from fresh hits', () => {
		recordCacheAccess('meta', true, true);
		expect(countMock).toHaveBeenCalledWith('dku.cache.access', 1, {
			attributes: { 'cache.kind': 'meta', 'cache.result': 'stale' }
		});
	});

	it('records a calendar subscription with locale only', () => {
		recordCalendarSubscription('ru');

		expect(countMock).toHaveBeenCalledWith('dku.calendar.subscription', 1, {
			attributes: { 'ui.locale': 'ru' }
		});
	});

	it('records an upstream outage with the source kind only', () => {
		recordUpstreamUnavailable('meta');

		expect(countMock).toHaveBeenCalledWith('dku.upstream.unavailable', 1, {
			attributes: { 'source.kind': 'meta' }
		});
	});
});
