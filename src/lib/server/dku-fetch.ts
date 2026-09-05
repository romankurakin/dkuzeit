import { DomHandler, type Document } from 'domhandler';
import { WebWritableStream } from 'htmlparser2/WebWritableStream';
import { recordHtmlInputBytes } from './metrics';
import { traceCacheGet, traceSpan, type NativeTracing } from './tracing';

const DEFAULT_BASE_URL = 'https://timetable.dku.kz';

// Runtime configuration: e2e points this at the committed fixture snapshot
// via wrangler.toml [env.e2e]; unset everywhere else.
export function upstreamBaseUrl(): string {
	return process.env.DKU_BASE_URL || DEFAULT_BASE_URL;
}
export const CACHE_NAMESPACE_VERSION = 'v2';

export interface CachePolicy {
	edgeTtlSeconds: number;
	clientTtlSeconds: number;
	staleWhileRevalidateSeconds: number;
}

function buildCacheNamespace(buildId = ''): string {
	return buildId ? `${CACHE_NAMESPACE_VERSION}-${buildId}` : CACHE_NAMESPACE_VERSION;
}

export interface DkuRequestContext {
	cacheNamespace: string;
	inflight: Map<string, Promise<unknown>>;
	tracing?: NativeTracing;
}

export function createDkuRequestContext(buildId = '', tracing?: NativeTracing): DkuRequestContext {
	return {
		cacheNamespace: buildCacheNamespace(buildId),
		inflight: new Map(),
		tracing
	};
}

export const META_CACHE_POLICY: CachePolicy = {
	edgeTtlSeconds: 43_200,
	clientTtlSeconds: 3_600,
	staleWhileRevalidateSeconds: 18_000
};

export const SCHEDULE_CACHE_POLICY: CachePolicy = {
	edgeTtlSeconds: 10_800,
	clientTtlSeconds: 900,
	staleWhileRevalidateSeconds: 2_700
};

export const API_RESPONSE_CACHE_HEADER = 'no-store';

export async function cached<T>(
	key: string,
	compute: () => Promise<T>,
	request?: DkuRequestContext,
	policy: CachePolicy = SCHEDULE_CACHE_POLICY
): Promise<T> {
	const cache = typeof caches !== 'undefined' ? caches.default : null;
	const url = `${upstreamBaseUrl()}/_cache/${request?.cacheNamespace ?? CACHE_NAMESPACE_VERSION}/${encodeURIComponent(key)}`;

	if (cache) {
		const hit = await traceCacheGet(
			key,
			async (setHit) => {
				try {
					const res = await cache.match(url);
					if (res) {
						setHit(true);
						return (await res.json()) as T;
					}
				} catch {
					/* miss */
				}
				setHit(false);
				return undefined;
			},
			request?.tracing
		);
		if (hit !== undefined) return hit;
	}

	const inflight = request?.inflight;
	let pending = inflight?.get(key) as Promise<T> | undefined;
	if (!pending) {
		pending = compute().finally(() => inflight?.delete(key));
		inflight?.set(key, pending);
	}
	const value = await pending;

	cache
		?.put(
			url,
			new Response(JSON.stringify(value), {
				// Cloudflare Cache API honors Cache-Control for TTL, but not stale-while-revalidate.
				headers: { 'cache-control': `s-maxage=${policy.edgeTtlSeconds}` }
			})
		)
		.catch(() => {});
	return value;
}

export async function fetchDocument(
	path: string,
	nativeTracing?: NativeTracing
): Promise<Document> {
	const url = `${upstreamBaseUrl()}/${path}`;
	try {
		const res = await fetch(url, {
			signal: AbortSignal.timeout(15_000),
			headers: { 'cache-control': 'no-cache' }
		});
		if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`);
		if (!res.body) throw new Error(`Response body is null for ${url}`);
		const body = res.body;
		const handler = new DomHandler();
		const ws = new WebWritableStream(handler);
		const contentLength = Number(res.headers.get('content-length'));
		await traceSpan(
			'build DOM with htmlparser2',
			'html.parse',
			{
				'html.path': path,
				'html.phase': 'dom.build',
				'html.parser': 'htmlparser2',
				...(Number.isFinite(contentLength) && contentLength > 0
					? { 'html.content_length': contentLength }
					: {})
			},
			async (span) => {
				let inputBytes = 0;
				const countingStream = new TransformStream<Uint8Array, Uint8Array>({
					transform(chunk, controller) {
						inputBytes += chunk.byteLength;
						controller.enqueue(chunk);
					}
				});
				await body.pipeThrough(countingStream).pipeTo(ws);
				span.setAttribute('html.input_bytes', inputBytes);
				recordHtmlInputBytes(path, inputBytes);
			},
			nativeTracing
		);
		return handler.root;
	} catch (err) {
		if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
			throw new Error(`Request to ${url} was aborted`, { cause: err });
		}
		throw err;
	}
}
