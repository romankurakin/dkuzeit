// See https://svelte.dev/docs/kit/types#app.d.ts

declare global {
	namespace App {
		interface Platform {
			env: {
				TOKEN_SECRET?: string;
			};
		}
	}

	// Cloudflare Workers exposes caches.default (not in standard CacheStorage)
	interface CacheStorage {
		default: Cache;
	}
}

export {};
