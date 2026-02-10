import { traceCacheGet } from './tracing';

export const BASE_URL = 'https://timetable.dku.kz';

// Worst case staleness is EDGE_TTL + CLIENT_TTL
export const EDGE_TTL_SECONDS = 3600;
export const CLIENT_TTL_SECONDS = 1800;
const SWR_SECONDS = EDGE_TTL_SECONDS - CLIENT_TTL_SECONDS;
export const CLIENT_CACHE_HEADER = `public, max-age=${CLIENT_TTL_SECONDS}, stale-while-revalidate=${SWR_SECONDS}`;

const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, compute: () => Promise<T>): Promise<T> {
	const cache = typeof caches !== 'undefined' ? caches.default : null;
	const url = `${BASE_URL}/_cache/${encodeURIComponent(key)}`;

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

	let pending = inflight.get(key) as Promise<T> | undefined;
	if (!pending) {
		pending = compute().finally(() => inflight.delete(key));
		inflight.set(key, pending);
	}
	const value = await pending;

	cache
		?.put(
			url,
			new Response(JSON.stringify(value), {
				headers: { 'cache-control': `s-maxage=${EDGE_TTL_SECONDS}` }
			})
		)
		.catch(() => {});
	return value;
}

export async function fetchText(path: string): Promise<string> {
	const url = `${BASE_URL}/${path}`;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 15_000);
	try {
		const res = await fetch(url, {
			signal: controller.signal,
			headers: { 'cache-control': 'no-cache' }
		});
		if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`);
		return await res.text();
	} finally {
		clearTimeout(timeout);
	}
}
