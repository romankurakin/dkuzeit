import { traceCacheGet } from './tracing';

export const BASE_URL = 'https://timetable.dku.kz';
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
}

export function createDkuRequestContext(buildId = ''): DkuRequestContext {
	return {
		cacheNamespace: buildCacheNamespace(buildId),
		inflight: new Map()
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
	const url = `${BASE_URL}/_cache/${request?.cacheNamespace ?? CACHE_NAMESPACE_VERSION}/${encodeURIComponent(key)}`;

	if (cache) {
		const hit = await traceCacheGet(key, async (setHit) => {
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
		});
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

export async function fetchText(path: string): Promise<string> {
	const url = `${BASE_URL}/${path}`;
	try {
		const res = await fetch(url, {
			signal: AbortSignal.timeout(15_000),
			headers: { 'cache-control': 'no-cache' }
		});
		if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`);
		return await res.text();
	} catch (err) {
		if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
			throw new Error(`Request to ${url} was aborted`, { cause: err });
		}
		throw err;
	}
}
