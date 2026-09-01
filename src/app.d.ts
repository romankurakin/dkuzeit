import 'vite-plugin-pwa/info';
import type { NETWORK_UNAVAILABLE_CODE } from '$lib/client/network-errors';
import type { DkuRequestContext } from '$lib/server/dku-fetch';

declare global {
	namespace App {
		interface Error {
			code?: typeof NETWORK_UNAVAILABLE_CODE;
			message: string;
		}

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
