import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChildNode, Element, Text } from 'domhandler';

const { traceCacheGetMock, traceSpanMock } = vi.hoisted(() => ({
	traceCacheGetMock: vi.fn(),
	traceSpanMock: vi.fn()
}));

vi.mock('../../src/lib/server/tracing', () => ({
	traceCacheGet: traceCacheGetMock,
	traceSpan: traceSpanMock
}));

import {
	BASE_URL,
	CACHE_NAMESPACE_VERSION,
	META_CACHE_POLICY,
	SCHEDULE_CACHE_POLICY,
	cached,
	createDkuRequestContext,
	fetchDocument
} from '../../src/lib/server/dku-fetch';

type CacheApi = {
	default: {
		match: ReturnType<typeof vi.fn>;
		put: ReturnType<typeof vi.fn>;
	};
};

const TEST_BUILD_ID = 'current-build';

describe('dku fetch cache helpers', () => {
	beforeEach(() => {
		traceSpanMock.mockImplementation(async (_name, _op, _attributes, fn) => fn());
	});

	afterEach(() => {
		vi.restoreAllMocks();
		delete (globalThis as unknown as { caches?: unknown }).caches;
	});

	it('returns cache hit without running compute', async () => {
		const match = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
		const put = vi.fn().mockResolvedValue(undefined);
		(globalThis as unknown as { caches?: CacheApi }).caches = { default: { match, put } };
		traceCacheGetMock.mockImplementation(async (_key, fn) => fn(() => {}));
		const request = createDkuRequestContext(TEST_BUILD_ID);

		const compute = vi.fn(async () => ({ ok: false }));
		await expect(cached('meta key', compute, request)).resolves.toEqual({ ok: true });

		expect(compute).not.toHaveBeenCalled();
		expect(match).toHaveBeenCalledWith(
			`${BASE_URL}/_cache/${CACHE_NAMESPACE_VERSION}-${TEST_BUILD_ID}/${encodeURIComponent('meta key')}`
		);
		expect(put).not.toHaveBeenCalled();
	});

	it('deduplicates inflight calls for same key and writes cache on miss', async () => {
		const match = vi.fn().mockResolvedValue(null);
		const put = vi.fn().mockResolvedValue(undefined);
		(globalThis as unknown as { caches?: CacheApi }).caches = { default: { match, put } };
		traceCacheGetMock.mockImplementation(async (_key, fn) => fn(() => {}));
		const request = createDkuRequestContext(TEST_BUILD_ID);

		const compute = vi.fn(async () => {
			await new Promise((resolve) => setTimeout(resolve, 5));
			return { value: 7 };
		});

		const [left, right] = await Promise.all([
			cached('same-key', compute, request),
			cached('same-key', compute, request)
		]);
		expect(left).toEqual({ value: 7 });
		expect(right).toEqual({ value: 7 });
		expect(compute).toHaveBeenCalledTimes(1);
		expect(match).toHaveBeenCalledWith(
			`${BASE_URL}/_cache/${CACHE_NAMESPACE_VERSION}-${TEST_BUILD_ID}/${encodeURIComponent('same-key')}`
		);
		expect(put).toHaveBeenCalledTimes(2);
		const response = put.mock.calls[0]?.[1] as Response;
		expect(response.headers.get('cache-control')).toBe(
			`s-maxage=${SCHEDULE_CACHE_POLICY.edgeTtlSeconds}`
		);
	});

	it('uses explicit cache policy when provided', async () => {
		const match = vi.fn().mockResolvedValue(null);
		const put = vi.fn().mockResolvedValue(undefined);
		(globalThis as unknown as { caches?: CacheApi }).caches = { default: { match, put } };
		traceCacheGetMock.mockImplementation(async (_key, fn) => fn(() => {}));

		await expect(
			cached('meta', async () => ({ ok: true }), undefined, META_CACHE_POLICY)
		).resolves.toEqual({
			ok: true
		});

		const response = put.mock.calls[0]?.[1] as Response;
		expect(response.headers.get('cache-control')).toBe(
			`s-maxage=${META_CACHE_POLICY.edgeTtlSeconds}`
		);
	});

	it('wraps AbortError with descriptive message on timeout', async () => {
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

		const promise = fetchDocument('slow/endpoint.htm');
		promise.catch(() => {});
		await vi.advanceTimersByTimeAsync(15_000);
		await expect(promise).rejects.toThrow(`Request to ${BASE_URL}/slow/endpoint.htm was aborted`);
		vi.useRealTimers();
	});

	it('re-throws non-AbortError network failures unchanged', async () => {
		const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
		(globalThis as unknown as { fetch?: typeof fetch }).fetch =
			fetchMock as unknown as typeof fetch;

		await expect(fetchDocument('broken/path.htm')).rejects.toThrow('Failed to fetch');
	});

	it('fetches document with no-cache header and fails on non-ok response', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response('<html><body>hello</body></html>', { status: 200 }))
			.mockResolvedValueOnce(new Response('nope', { status: 503 }));
		(globalThis as unknown as { fetch?: typeof fetch }).fetch =
			fetchMock as unknown as typeof fetch;

		const doc = await fetchDocument('frames/navbar.htm');
		expect(doc.type).toBe('root');
		expect(fetchMock).toHaveBeenNthCalledWith(
			1,
			`${BASE_URL}/frames/navbar.htm`,
			expect.objectContaining({ headers: { 'cache-control': 'no-cache' } })
		);
		await expect(fetchDocument('bad/path.htm')).rejects.toThrow(
			`Failed to fetch ${BASE_URL}/bad/path.htm (503)`
		);
	});
});

describe('fetchDocument streaming', () => {
	beforeEach(() => {
		traceSpanMock.mockImplementation(async (_name, _op, _attributes, fn) => fn());
	});

	function collectText(node: ChildNode): string {
		if (node.type === 'text') return (node as Text).data;
		if (!('children' in node)) return '';
		return node.children.map(collectText).join('');
	}

	function findByTag(node: ChildNode, name: string): Element | null {
		if (node.type === 'tag' && (node as Element).name === name) return node as Element;
		if (!('children' in node)) return null;
		for (const child of node.children) {
			const found = findByTag(child, name);
			if (found) return found;
		}
		return null;
	}

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('pipes HTML chunks through WebWritableStream and gets walkable Document', async () => {
		const html =
			'<html><body><select name="week"><option value="01">1.1.2026</option></select></body></html>';
		const chunks = [html.slice(0, 20), html.slice(20, 50), html.slice(50)];
		const encoder = new TextEncoder();

		(globalThis as unknown as { fetch?: typeof fetch }).fetch = vi.fn().mockResolvedValue(
			new Response(
				new ReadableStream({
					start(controller) {
						for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
						controller.close();
					}
				})
			)
		);

		const doc = await fetchDocument('frames/navbar.htm');
		expect(doc.type).toBe('root');
		const select = findByTag(doc, 'select');
		expect(select).not.toBeNull();
		expect(select!.attribs.name).toBe('week');
		const option = findByTag(doc, 'option');
		expect(option).not.toBeNull();
		expect(option!.attribs.value).toBe('01');
		expect(collectText(option!).trim()).toBe('1.1.2026');
	});

	it('decodes fragmented UTF-8 multi-byte characters across chunk boundaries', async () => {
		const text = 'Казахский язык';
		const bytes = new TextEncoder().encode(text);
		const mid = 5;
		const chunks = [bytes.slice(0, mid), bytes.slice(mid)];

		(globalThis as unknown as { fetch?: typeof fetch }).fetch = vi.fn().mockResolvedValue(
			new Response(
				new ReadableStream({
					start(controller) {
						for (const chunk of chunks) controller.enqueue(chunk);
						controller.close();
					}
				})
			)
		);

		const doc = await fetchDocument('test.htm');
		expect(collectText(doc).trim()).toBe(text);
	});

	it('parses empty stream without error', async () => {
		(globalThis as unknown as { fetch?: typeof fetch }).fetch = vi.fn().mockResolvedValue(
			new Response(
				new ReadableStream({
					start(controller) {
						controller.close();
					}
				})
			)
		);

		const doc = await fetchDocument('empty.htm');
		expect(doc.type).toBe('root');
		expect(doc.children).toHaveLength(0);
	});

	it('throws when response body is null', async () => {
		(globalThis as unknown as { fetch?: typeof fetch }).fetch = vi
			.fn()
			.mockResolvedValue(new Response(null));

		await expect(fetchDocument('no-body.htm')).rejects.toThrow(
			`Response body is null for ${BASE_URL}/no-body.htm`
		);
	});
});
