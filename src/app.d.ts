import type { NETWORK_UNAVAILABLE_CODE } from '#lib/client/network-errors.ts';
import type { DkuRequestContext } from '#lib/server/dku-fetch.ts';

declare global {
	namespace App {
		interface Error {
			code?: typeof NETWORK_UNAVAILABLE_CODE;
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
