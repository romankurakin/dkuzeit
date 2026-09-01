import * as Sentry from '@sentry/sveltekit';
import { sentryConfig } from '$lib/sentry';

Sentry.init(sentryConfig);

if ('serviceWorker' in navigator) {
	navigator.serviceWorker.register('/service-worker.js').catch(() => {});
}

const sentryHandleError = Sentry.handleErrorWithSentry();

function isNetworkFetchError(error: unknown): boolean {
	return (
		error instanceof TypeError &&
		(error.message === 'Load failed' || error.message === 'Failed to fetch')
	);
}

export const handleError: typeof sentryHandleError = async (input) => {
	if (isNetworkFetchError(input.error)) {
		return {
			message: 'Network connection lost — please check your connection and try again.'
		};
	}
	return sentryHandleError(input);
};
