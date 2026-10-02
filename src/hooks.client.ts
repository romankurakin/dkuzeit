import type { HandleClientError } from '@sveltejs/kit/hooks';
import * as Sentry from '@sentry/sveltekit';
import { isNetworkFetchError, NETWORK_UNAVAILABLE_CODE } from '#lib/client/network-errors.ts';
import { clientSentryConfig } from '#lib/sentry.ts';

Sentry.init(clientSentryConfig);

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
