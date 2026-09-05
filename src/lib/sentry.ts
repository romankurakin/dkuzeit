import { dev } from '$app/environment';
import type { TransactionEvent } from '@sentry/core';

const sharedSentryConfig = {
	dsn: 'https://2b9222adeea60d9dbaef826f52937788@o4510862703722496.ingest.us.sentry.io/4510862792589312',
	enableMetrics: true,
	beforeSendTransaction: (event: TransactionEvent) => {
		const status = event.contexts?.trace?.data?.['http.response.status_code'];
		if (status === 404 || status === '404') return null;
		return event;
	},
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
