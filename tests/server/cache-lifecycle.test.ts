import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cached, createDkuRequestContext, type CachePolicy } from '../../src/lib/server/dku-fetch';

const policy: CachePolicy = { edgeTtlSeconds: 60, staleWhileRevalidateSeconds: 30 };
const START = Date.parse('2026-10-12T00:00:00Z');

describe('cache lifecycle', () => {
	const entries = new Map<string, Response>();
	const put = vi.fn(async (key: string, response: Response) => {
		entries.set(key, response.clone());
	});
	const match = vi.fn(async (key: string) => entries.get(key)?.clone());
	const compute = vi.fn(async () => ({ revision: 1 }));

	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(START);
		vi.clearAllMocks();
		entries.clear();
		vi.stubGlobal('caches', { default: { match, put } });
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	const read = (request = createDkuRequestContext(), loader = compute) =>
		cached('schedule:42:1', loader, request, policy);

	it('shares fresh entries between requests without a deployment-specific namespace', async () => {
		await read();
		vi.setSystemTime(START + 59_999);
		await expect(read()).resolves.toEqual({ revision: 1 });
		expect(compute).toHaveBeenCalledTimes(1);
	});

	it('serves stale data immediately and refreshes once per request in the background', async () => {
		await read();
		vi.setSystemTime(START + 60_000);
		const next = Promise.withResolvers<{ revision: number }>();
		const refresh = vi.fn(() => next.promise);
		const background: Promise<unknown>[] = [];
		const request = createDkuRequestContext({ waitUntil: (work) => background.push(work) });

		await expect(Promise.all([read(request, refresh), read(request, refresh)])).resolves.toEqual([
			{ revision: 1 },
			{ revision: 1 }
		]);
		expect(refresh).toHaveBeenCalledTimes(1);
		expect(background.length).toBeGreaterThan(0);
		next.resolve({ revision: 2 });
		await Promise.all(background);
		await expect(read()).resolves.toEqual({ revision: 2 });
		expect(put).toHaveBeenCalledTimes(2);
	}, 2000);

	it('retains stale data after a failed refresh without extending its hard expiry', async () => {
		await read();
		vi.setSystemTime(START + 60_000);
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const fail = vi.fn(async () => {
			throw new Error('upstream unavailable');
		});
		const background: Promise<unknown>[] = [];
		await expect(
			read(createDkuRequestContext({ waitUntil: (work) => background.push(work) }), fail)
		).resolves.toEqual({ revision: 1 });
		await Promise.all(background);
		expect(warn).toHaveBeenCalledWith({ event: 'dku.cache.refresh_failed', key: 'schedule:42:1' });
		expect(put).toHaveBeenCalledTimes(1);

		vi.setSystemTime(START + 90_000);
		await expect(read(createDkuRequestContext(), fail)).rejects.toThrow('upstream unavailable');
	});

	it('waits for refresh without waitUntil and falls back only inside the stale window', async () => {
		await read();
		vi.setSystemTime(START + 60_000);
		const fail = vi.fn(async () => {
			throw new Error('upstream unavailable');
		});
		await expect(read(createDkuRequestContext(), fail)).resolves.toEqual({ revision: 1 });
		const expireDuringRefresh = vi.fn(async () => {
			vi.setSystemTime(START + 90_000);
			throw new Error('upstream timeout');
		});
		await expect(read(createDkuRequestContext(), expireDuringRefresh)).rejects.toThrow(
			'upstream timeout'
		);
	});

	it('keeps a cold cache write alive without delaying the response', async () => {
		const write = Promise.withResolvers<void>();
		put.mockImplementationOnce(() => write.promise);
		const waitUntil = vi.fn();
		await expect(read(createDkuRequestContext({ waitUntil }))).resolves.toEqual({ revision: 1 });
		expect(waitUntil).toHaveBeenCalledExactlyOnceWith(expect.any(Promise));
		write.resolve();
		await waitUntil.mock.calls[0]![0];
	}, 2000);

	it('returns computed data and reports cache write failures', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		put.mockRejectedValueOnce(new Error('cache unavailable'));
		await expect(read()).resolves.toEqual({ revision: 1 });
		expect(warn).toHaveBeenCalledWith({ event: 'dku.cache.write_failed', key: 'schedule:42:1' });
	});

	it.each([
		new Response('{broken json', { headers: { 'x-dku-cached-at': String(START) } }),
		Response.json({ revision: 0 }),
		Response.json({ revision: 0 }, { headers: { 'x-dku-cached-at': 'invalid' } }),
		Response.json({ revision: 0 }, { headers: { 'x-dku-cached-at': String(START + 1000) } })
	])('recomputes entries with an invalid body or timestamp (%#)', async (response) => {
		match.mockResolvedValueOnce(response);
		await expect(read()).resolves.toEqual({ revision: 1 });
		expect(compute).toHaveBeenCalledTimes(1);
	});

	it('allows a request to retry after a failed cold load', async () => {
		compute.mockRejectedValueOnce(new Error('temporary failure'));
		const request = createDkuRequestContext();
		await expect(read(request)).rejects.toThrow('temporary failure');
		await expect(read(request)).resolves.toEqual({ revision: 1 });
	});
});
