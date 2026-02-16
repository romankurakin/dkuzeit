import * as Sentry from '@sentry/sveltekit';
import { sentryConfig } from '$lib/sentry';

Sentry.init(sentryConfig);

if ('serviceWorker' in navigator) {
	navigator.serviceWorker.register('/service-worker.js').catch(() => {});
}

export const handleError = Sentry.handleErrorWithSentry();
