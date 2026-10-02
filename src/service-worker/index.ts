import { self } from '$app/service-worker';
import { version } from '$app/env';
import { immutable } from '$app/manifest';
import { resolve } from '$app/paths';

const CACHE = `cache-${version}`;

// Safe profile only precache build assets
// No runtime caching for api and html so fresh data comes from network
const ASSETS = new Set<string>(immutable.map((asset) => resolve(asset.path)));

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll([...ASSETS]))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
		await self.clients.claim();
	}

	event.waitUntil(deleteOldCaches());
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;
	const { pathname } = new URL(event.request.url);
	if (!ASSETS.has(pathname)) return;

	event.respondWith(
		caches
			.open(CACHE)
			.then((cache) => cache.match(pathname))
			.then((cached) => cached ?? fetch(event.request))
	);
});
