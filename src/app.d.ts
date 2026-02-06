// See https://svelte.dev/docs/kit/types#app.d.ts

declare global {
	namespace App {
		interface Platform {
			env: {
				TOKEN_SECRET?: string;
				CACHE?: {
					get(key: string): Promise<string | null>;
					put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
				};
			};
		}
	}
}

export {};
