import { DomHandler, type Document } from 'domhandler';
import { WebWritableStream } from 'htmlparser2/WebWritableStream';
import { traceCacheGet, traceSpan, type NativeTracing } from './tracing';

const DEFAULT_BASE_URL = 'https://timetable.dku.kz';

// Runtime configuration: e2e points this at the committed fixture snapshot
// via wrangler.toml [env.e2e]; unset everywhere else.
export function upstreamBaseUrl(): string {
	return process.env.DKU_BASE_URL || DEFAULT_BASE_URL;
}
// Bump when the parsed payload or cache format changes, not on every deployment.
export const CACHE_NAMESPACE_VERSION = 'v3';
const CACHED_AT_HEADER = 'x-dku-cached-at';

export interface CachePolicy {
	edgeTtlSeconds: number;
	staleWhileRevalidateSeconds: number;
}

export interface DkuRequestContext {
	inflight: Map<string, Promise<unknown>>;
	tracing?: NativeTracing;
	waitUntil?: (promise: Promise<unknown>) => void;
}

export function createDkuRequestContext(
	options: Omit<DkuRequestContext, 'inflight'> = {}
): DkuRequestContext {
	return {
		inflight: new Map(),
		...options
	};
}

export const META_CACHE_POLICY: CachePolicy = {
	edgeTtlSeconds: 43_200,
	staleWhileRevalidateSeconds: 18_000
};

export const SCHEDULE_CACHE_POLICY: CachePolicy = {
	edgeTtlSeconds: 10_800,
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
	const url = `${upstreamBaseUrl()}/_cache/${CACHE_NAMESPACE_VERSION}/${encodeURIComponent(key)}`;
	const freshForMs = policy.edgeTtlSeconds * 1000;
	const retainedForSeconds = policy.edgeTtlSeconds + policy.staleWhileRevalidateSeconds;
	let hit: { value: T; cachedAt: number; stale: boolean } | undefined;

	if (cache) {
		hit = await traceCacheGet(
			key,
			async (setHit) => {
				try {
					const res = await cache.match(url);
					if (res?.headers.has(CACHED_AT_HEADER)) {
						const cachedAt = Number(res.headers.get(CACHED_AT_HEADER));
						const age = Date.now() - cachedAt;
						if (Number.isFinite(cachedAt) && age >= 0 && age < retainedForSeconds * 1000) {
							const value = (await res.json()) as T;
							const stale = age >= freshForMs;
							setHit(true, stale);
							return { value, cachedAt, stale };
						}
					}
				} catch {
					/* miss */
				}
				setHit(false);
				return undefined;
			},
			request?.tracing
		);
		if (hit && !hit.stale) return hit.value;
	}

	const inflight = request?.inflight;
	let pending = inflight?.get(key) as Promise<T> | undefined;
	if (!pending) {
		pending = (async () => {
			const value = await compute();
			if (cache) {
				const write = cache
					.put(
						url,
						new Response(JSON.stringify(value), {
							headers: {
								// Retain the body through the bounded stale window; freshness is checked above.
								'cache-control': `s-maxage=${retainedForSeconds}`,
								[CACHED_AT_HEADER]: String(Date.now())
							}
						})
					)
					.catch(() => {
						console.warn({ event: 'dku.cache.write_failed', key });
					});
				if (request?.waitUntil) request.waitUntil(write);
				else await write;
			}
			return value;
		})().catch((error: unknown) => {
			inflight?.delete(key);
			throw error;
		});
		inflight?.set(key, pending);
	}
	if (hit) {
		if (request?.waitUntil) {
			request.waitUntil(
				pending.catch(() => {
					console.warn({ event: 'dku.cache.refresh_failed', key });
				})
			);
			return hit.value;
		}
		// Non-Workers callers cannot extend the request lifetime, so finish refresh before returning.
		try {
			return await pending;
		} catch (error) {
			if (Date.now() - hit.cachedAt < retainedForSeconds * 1000) return hit.value;
			throw error;
		}
	}
	return pending;
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
