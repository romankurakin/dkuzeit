import type { Handle } from '@sveltejs/kit';
import { sentryHandle, initCloudflareSentryHandle } from '@sentry/sveltekit';
import * as Sentry from '@sentry/sveltekit';
import { sequence } from '@sveltejs/kit/hooks';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { sentryConfig } from '$lib/sentry';

const paraglideHandle: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request: localizedRequest, locale }) => {
		event.request = localizedRequest;
		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%lang%', locale)
		});
	});

export const handle = sequence(
	initCloudflareSentryHandle(sentryConfig),
	sentryHandle(),
	paraglideHandle
);

export const handleError = Sentry.handleErrorWithSentry();
