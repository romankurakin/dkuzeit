import { beforeEach, describe, expect, it, vi } from 'vitest';

const { startSpanMock } = vi.hoisted(() => ({
	startSpanMock: vi.fn()
}));

vi.mock('@sentry/sveltekit', () => ({
	startSpan: startSpanMock
}));

import { traceCacheGet, traceSpan } from '../../src/lib/server/tracing';

describe('tracing wrappers', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('wraps generic spans', async () => {
		startSpanMock.mockImplementation((_ctx, fn: () => Promise<string>) => fn());

		await expect(
			traceSpan('parse timetable page', 'html.parse', { week: '13' }, async () => 'ok')
		).resolves.toBe('ok');

		expect(startSpanMock).toHaveBeenCalledWith(
			{ name: 'parse timetable page', op: 'html.parse', attributes: { week: '13' } },
			expect.any(Function)
		);
	});

	it('sets cache hit attribute through callback', async () => {
		const setAttribute = vi.fn();
		startSpanMock.mockImplementation(
			(_ctx, fn: (span: { setAttribute: typeof setAttribute }) => Promise<string>) =>
				fn({ setAttribute })
		);

		await expect(
			traceCacheGet('meta', async (setHit) => {
				setHit(true);
				return 'cached';
			})
		).resolves.toBe('cached');

		expect(startSpanMock).toHaveBeenCalledWith(
			{ name: 'meta cache', op: 'cache.get', attributes: { 'cache.key': ['meta'] } },
			expect.any(Function)
		);
		expect(setAttribute).toHaveBeenCalledWith('cache.hit', true);
	});
});
