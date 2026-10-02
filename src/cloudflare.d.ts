// The subset of the Workers runtime module this app uses
// Bindings mirror wrangler.toml
declare module 'cloudflare:workers' {
	export const env: {
		CF_VERSION_METADATA?: { id: string; tag: string; timestamp: string };
	};
	export const tracing: import('#lib/server/tracing.ts').NativeTracing;
}
