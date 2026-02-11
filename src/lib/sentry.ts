import { dev } from '$app/environment';
import type { TransactionEvent } from '@sentry/core';

export const sentryConfig = {
	dsn: 'https://2b9222adeea60d9dbaef826f52937788@o4510862703722496.ingest.us.sentry.io/4510862792589312',
	tracesSampleRate: 0.25,
	beforeSendTransaction: (event: TransactionEvent) => {
		const status = event.contexts?.trace?.data?.['http.response.status_code'];
		if (status === 404 || status === '404') return null;
		return event;
	},
	enabled: !dev && !import.meta.env.VITE_SENTRY_DISABLED
};
