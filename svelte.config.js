import adapter from '@sveltejs/adapter-cloudflare';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
		experimental: {
			instrumentation: {
				server: true
			},
			tracing: {
				server: true
			}
		}
	}
};

export default config;
