import { dev } from '$app/env';
import type { ErrorEvent } from '@sentry/sveltekit';

const sharedSentryConfig = {
	dsn: 'https://2b9222adeea60d9dbaef826f52937788@o4510862703722496.ingest.us.sentry.io/4510862792589312',
	enabled: !dev && !import.meta.env.VITE_SENTRY_DISABLED
};

export const clientSentryConfig = {
	...sharedSentryConfig,
	tracesSampleRate: 1,
	beforeSend(event: ErrorEvent) {
		// Google WRS stubs service worker registration and rejects it with "Rejected".
		const isWrsServiceWorkerRejection = event.exception?.values?.some(
			(exception) =>
				exception.value === 'Rejected' &&
				exception.stacktrace?.frames?.some(
					(frame) =>
						frame.function?.includes('wrsParams') &&
						frame.function.includes('serviceWorker.register')
				)
		);
		return isWrsServiceWorkerRejection ? null : event;
	}
};

export const serverSentryConfig = {
	...sharedSentryConfig,
	// Cloudflare native tracing owns server performance spans.
	tracesSampleRate: 0
};
