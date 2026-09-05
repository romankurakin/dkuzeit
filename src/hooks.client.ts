import * as Sentry from '@sentry/sveltekit';
import type { HandleClientError } from '@sveltejs/kit';
import { isNetworkFetchError, NETWORK_UNAVAILABLE_CODE } from '$lib/client/network-errors';
import { clientSentryConfig } from '$lib/sentry';

Sentry.init(clientSentryConfig);

if ('serviceWorker' in navigator) {
	navigator.serviceWorker.register('/service-worker.js').catch(() => {});
}

const sentryHandleError = Sentry.handleErrorWithSentry<HandleClientError>();

export const handleError: HandleClientError = async (input) => {
	if (isNetworkFetchError(input.error)) {
		Sentry.addBreadcrumb({
			category: 'network',
			level: 'warning',
			message: 'Client navigation failed because a fetch request lost its connection'
		});
		return {
			code: NETWORK_UNAVAILABLE_CODE,
			message: 'Network unavailable'
		};
	}
	return sentryHandleError(input);
};
