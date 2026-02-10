// https://svelte.dev/docs/kit/types#app.d.ts

declare global {
	namespace App {
		interface Platform {
			env: {
				TOKEN_SECRET?: string;
			};
		}
	}

	// CF Workers caches.default, not in standard CacheStorage
	interface CacheStorage {
		default: Cache;
	}
}

export {};
