import { afterEach, describe, expect, it, vi } from 'vitest';

const { traceCacheGetMock } = vi.hoisted(() => ({
	traceCacheGetMock: vi.fn()
}));

vi.mock('../../src/lib/server/tracing', () => ({
	traceCacheGet: traceCacheGetMock
}));

import { BASE_URL, cached, fetchText, setCacheVersion } from '../../src/lib/server/dku-fetch';

type CacheApi = {
	default: {
		match: ReturnType<typeof vi.fn>;
		put: ReturnType<typeof vi.fn>;
	};
};

describe('dku fetch cache helpers', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		delete (globalThis as unknown as { caches?: unknown }).caches;
		setCacheVersion('');
	});

	it('return cache hit without running compute', async () => {
		const match = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
		const put = vi.fn().mockResolvedValue(undefined);
		(globalThis as unknown as { caches?: CacheApi }).caches = { default: { match, put } };
		traceCacheGetMock.mockImplementation(async (_key, fn) => fn(() => {}));
		setCacheVersion('v1');

		const compute = vi.fn(async () => ({ ok: false }));
		await expect(cached('meta key', compute)).resolves.toEqual({ ok: true });

		expect(compute).not.toHaveBeenCalled();
		expect(match).toHaveBeenCalledWith(`${BASE_URL}/_cache/v1/${encodeURIComponent('meta key')}`);
		expect(put).not.toHaveBeenCalled();
	});

	it('deduplicate inflight calls for same key and write cache on miss', async () => {
		const match = vi.fn().mockResolvedValue(null);
		const put = vi.fn().mockResolvedValue(undefined);
		(globalThis as unknown as { caches?: CacheApi }).caches = { default: { match, put } };
		traceCacheGetMock.mockImplementation(async (_key, fn) => fn(() => {}));
		setCacheVersion('v2');

		const compute = vi.fn(async () => {
			await new Promise((resolve) => setTimeout(resolve, 5));
			return { value: 7 };
		});

		const [left, right] = await Promise.all([
			cached('same-key', compute),
			cached('same-key', compute)
		]);
		expect(left).toEqual({ value: 7 });
		expect(right).toEqual({ value: 7 });
		expect(compute).toHaveBeenCalledTimes(1);
		expect(match).toHaveBeenCalledWith(`${BASE_URL}/_cache/v2/${encodeURIComponent('same-key')}`);
		expect(put).toHaveBeenCalledTimes(2);
	});

	it('wrap AbortError with descriptive message on timeout', async () => {
		vi.useFakeTimers();
		const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
			return new Promise<Response>((_resolve, reject) => {
				init?.signal?.addEventListener('abort', () => {
					reject(new DOMException('The operation was aborted.', 'AbortError'));
				});
			});
		});
		(globalThis as unknown as { fetch?: typeof fetch }).fetch =
			fetchMock as unknown as typeof fetch;

		const promise = fetchText('slow/endpoint.htm');
		promise.catch(() => {});
		await vi.advanceTimersByTimeAsync(15_000);
		await expect(promise).rejects.toThrow(`Request to ${BASE_URL}/slow/endpoint.htm was aborted`);
		vi.useRealTimers();
	});

	it('re-throw non-AbortError network failures unchanged', async () => {
		const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
		(globalThis as unknown as { fetch?: typeof fetch }).fetch =
			fetchMock as unknown as typeof fetch;

		await expect(fetchText('broken/path.htm')).rejects.toThrow('Failed to fetch');
	});

	it('fetch text with no-cache header and fail on non-ok response', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response('hello', { status: 200 }))
			.mockResolvedValueOnce(new Response('nope', { status: 503 }));
		(globalThis as unknown as { fetch?: typeof fetch }).fetch =
			fetchMock as unknown as typeof fetch;

		await expect(fetchText('frames/navbar.htm')).resolves.toBe('hello');
		expect(fetchMock).toHaveBeenNthCalledWith(
			1,
			`${BASE_URL}/frames/navbar.htm`,
			expect.objectContaining({ headers: { 'cache-control': 'no-cache' } })
		);
		await expect(fetchText('bad/path.htm')).rejects.toThrow(
			`Failed to fetch ${BASE_URL}/bad/path.htm (503)`
		);
	});
});
