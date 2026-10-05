import type { HandleClientError } from '@sveltejs/kit/hooks';
import * as Sentry from '@sentry/sveltekit';
import { isNetworkFetchError, NETWORK_UNAVAILABLE_CODE } from '#lib/client/network-errors.ts';
import { clientSentryConfig } from '#lib/sentry.ts';

Sentry.init(clientSentryConfig);

// Some environments (e.g. Google's Web Rendering Service) stub register() to always reject.
// SvelteKit's auto-registration leaves that rejection unhandled, so register here instead.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker
			.register('/service-worker.js', { type: 'module' })
			.catch((error: unknown) => {
				Sentry.addBreadcrumb({
					category: 'service-worker',
					level: 'warning',
					message: `Service worker registration failed: ${error instanceof Error ? error.message : String(error)}`
				});
			});
	});
}

const sentryHandleError = Sentry.handleErrorWithSentry<HandleClientError>();

export const handleError: HandleClientError = (input) => {
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
