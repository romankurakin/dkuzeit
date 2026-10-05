import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { sentrySvelteKit } from '@sentry/sveltekit/vite';
import { defineConfig } from 'vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	environments: {
		// SvelteKit rewrites the worker entry without a sourcemap, so an emitted map would be wrong
		serviceWorker: { build: { sourcemap: false } }
	},
	plugins: [
		tailwindcss(),
		sentrySvelteKit({
			org: 'kurakindev',
			project: 'dkuzeit',
			authToken: process.env.SENTRY_AUTH_TOKEN
		}),
		sveltekit({
			adapter: adapter(),
			tracing: { server: true },
			// Registered manually in hooks.client.ts so rejected registrations are handled
			serviceWorker: { register: false }
		}),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			strategy: ['url', 'cookie', 'baseLocale'],
			disableAsyncLocalStorage: true
		})
	]
});
