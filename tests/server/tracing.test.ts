import { beforeEach, describe, expect, it, vi } from 'vitest';

const { cloudflareSetAttribute, countMetricMock, enterSpanMock } = vi.hoisted(() => ({
	cloudflareSetAttribute: vi.fn(),
	countMetricMock: vi.fn(),
	enterSpanMock: vi.fn()
}));

vi.mock('@sentry/sveltekit', () => ({
	metrics: { count: countMetricMock }
}));

import { traceCacheGet, traceSpan } from '../../src/lib/server/tracing';
import type { NativeTracing } from '../../src/lib/server/tracing';

const nativeTracing: NativeTracing = {
	enterSpan: (name, callback) => enterSpanMock(name, callback)
};

describe('tracing wrappers', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		enterSpanMock.mockImplementation((_name, fn) =>
			fn({
				setAttribute: cloudflareSetAttribute
			})
		);
	});

	it('emits generic spans to Cloudflare native tracing', async () => {
		await expect(
			traceSpan(
				'parse timetable page',
				'html.parse',
				{ week: '13' },
				async () => 'ok',
				nativeTracing
			)
		).resolves.toBe('ok');

		expect(enterSpanMock).toHaveBeenCalledWith('parse timetable page', expect.any(Function));
		expect(cloudflareSetAttribute).toHaveBeenCalledWith('week', '13');
		expect(cloudflareSetAttribute).toHaveBeenCalledWith('code.operation', 'html.parse');
	});

	it('runs normally when Cloudflare tracing is unavailable', async () => {
		const setAttribute = vi.fn();
		await expect(
			traceSpan('local work', 'test.work', {}, async (span) => {
				span.setAttribute('result', 'ok');
				setAttribute('completed', true);
				return 'ok';
			})
		).resolves.toBe('ok');

		expect(enterSpanMock).not.toHaveBeenCalled();
		expect(setAttribute).toHaveBeenCalledWith('completed', true);
	});

	it('sets cache hit attribute through callback', async () => {
		await expect(
			traceCacheGet(
				'meta',
				async (setHit) => {
					setHit(true);
					return 'cached';
				},
				nativeTracing
			)
		).resolves.toBe('cached');

		expect(cloudflareSetAttribute).toHaveBeenCalledWith('cache.key', 'meta');
		expect(cloudflareSetAttribute).toHaveBeenCalledWith('code.operation', 'cache.get');
		expect(cloudflareSetAttribute).toHaveBeenCalledWith('cache.hit', true);
		expect(countMetricMock).toHaveBeenCalledWith('dku.cache.access', 1, {
			attributes: { 'cache.kind': 'meta', 'cache.result': 'hit' }
		});
	});
});
