import { describe, expect, it, vi } from 'vitest';

const { startSpanMock } = vi.hoisted(() => ({
	startSpanMock: vi.fn()
}));

vi.mock('@sentry/sveltekit', () => ({
	startSpan: startSpanMock
}));

import { traceCacheGet, traceFn, traceSerialize } from '../../src/lib/server/tracing';

describe('tracing wrappers', () => {
	it('trace function wrapper via sentry span', async () => {
		startSpanMock.mockImplementation((_ctx, fn: () => Promise<string>) => fn());
		await expect(traceFn('work', { size: 1 }, async () => 'ok')).resolves.toBe('ok');
		expect(startSpanMock).toHaveBeenCalledWith(
			{ name: 'work', op: 'function', attributes: { size: 1 } },
			expect.any(Function)
		);
	});

	it('trace serialize wrapper via sentry span', () => {
		startSpanMock.mockImplementation((_ctx, fn: () => string) => fn());
		expect(traceSerialize('serialize', { count: 2 }, () => 'payload')).toBe('payload');
		expect(startSpanMock).toHaveBeenCalledWith(
			{ name: 'serialize', op: 'serialize', attributes: { count: 2 } },
			expect.any(Function)
		);
	});

	it('trace cache get sets cache hit attribute through callback', async () => {
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
			{ name: 'meta', op: 'cache.get', attributes: { 'cache.key': ['meta'] } },
			expect.any(Function)
		);
		expect(setAttribute).toHaveBeenCalledWith('cache.hit', true);
	});
});
