import { dev } from '$app/env';

const sharedSentryConfig = {
	dsn: 'https://2b9222adeea60d9dbaef826f52937788@o4510862703722496.ingest.us.sentry.io/4510862792589312',
	enabled: !dev && !import.meta.env.VITE_SENTRY_DISABLED
};

export const clientSentryConfig = {
	...sharedSentryConfig,
	tracesSampleRate: 1
};

export const serverSentryConfig = {
	...sharedSentryConfig,
	// Cloudflare native tracing owns server performance spans.
	tracesSampleRate: 0
};
