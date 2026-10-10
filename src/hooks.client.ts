import type { HandleClientError } from '@sveltejs/kit/hooks';
import * as Sentry from '@sentry/sveltekit';
import { isNetworkFetchError, NETWORK_UNAVAILABLE_CODE } from '#lib/client/network-errors.ts';
import { clientSentryConfig } from '#lib/sentry.ts';

Sentry.init(clientSentryConfig);

// Registered here instead of by SvelteKit (see vite.config.ts) so that a failed
// registration is caught rather than reported as an unhandled rejection.
if ('serviceWorker' in navigator) {
	addEventListener('load', () => {
		navigator.serviceWorker.register('/service-worker.js', { type: 'module' }).catch((reason) => {
			Sentry.addBreadcrumb({
				category: 'service-worker',
				level: 'warning',
				message: `Service worker registration failed: ${String(reason)}`
			});
		});
	});
}

// Runs after Sentry has captured the error. is-network-error only recognizes
// Safari's "Load failed" once Sentry has marked the error as captured, because
// Sentry's fetch instrumentation has given it a stack trace by then. The
// captured event is dropped again by beforeSend in #lib/sentry.ts.
const recoverFromNetworkError: HandleClientError = ({ error, kind }) => {
	if (!isNetworkFetchError(error)) {
		if (!kind || kind === 'unknown') console.error(error);
		return;
	}
	Sentry.addBreadcrumb({
		category: 'network',
		level: 'warning',
		message: 'Client navigation failed because a fetch request lost its connection'
	});
	return {
		code: NETWORK_UNAVAILABLE_CODE,
		message: 'Network unavailable'
	};
};

export const handleError = Sentry.handleErrorWithSentry(recoverFromNetworkError);
