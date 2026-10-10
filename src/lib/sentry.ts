import { dev } from '$app/env';
import type { ErrorEvent, EventHint } from '@sentry/sveltekit';
import { isNetworkFetchError } from '#lib/client/network-errors.ts';

const sharedSentryConfig = {
	dsn: 'https://2b9222adeea60d9dbaef826f52937788@o4510862703722496.ingest.us.sentry.io/4510862792589312',
	enabled: !dev && !import.meta.env.VITE_SENTRY_DISABLED
};

export const clientSentryConfig = {
	...sharedSentryConfig,
	tracesSampleRate: 1,
	// A script that fails to load because the connection dropped. The server-rendered
	// page is already on screen, and SvelteKit reloads by itself after a redeploy.
	ignoreErrors: [
		'Importing a module script failed', // Safari
		'Failed to fetch dynamically imported module', // Chromium
		'error loading dynamically imported module' // Firefox
	],
	beforeSend(event: ErrorEvent, hint: EventHint) {
		// hooks.client.ts has already turned this into the network-unavailable page.
		return isNetworkFetchError(hint.originalException) ? null : event;
	}
};

export const serverSentryConfig = {
	...sharedSentryConfig,
	// Cloudflare native tracing owns server performance spans.
	tracesSampleRate: 0
};
