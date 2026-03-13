import 'vite-plugin-pwa/info';
import type { DkuRequestContext } from '$lib/server/dku-fetch';

declare global {
	namespace App {
		interface Platform {
			env: {
				TOKEN_SECRET?: string;
				CF_VERSION_METADATA?: { id: string; tag: string; timestamp: string };
			};
		}

		interface Locals {
			dkuRequest?: DkuRequestContext;
		}
	}

	// CF Workers caches default not in standard CacheStorage
	interface CacheStorage {
		default: Cache;
	}
}

export {};
