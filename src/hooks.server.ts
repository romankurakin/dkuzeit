import type { Handle } from '@sveltejs/kit';
import { sentryHandle, initCloudflareSentryHandle } from '@sentry/sveltekit';
import * as Sentry from '@sentry/sveltekit';
import { sequence } from '@sveltejs/kit/hooks';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { sentryConfig } from '$lib/sentry';
import { createDkuRequestContext } from '$lib/server/dku-fetch';

const SECURITY_HEADERS: Record<string, string> = {
	'X-Frame-Options': 'DENY',
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
	'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
	'X-XSS-Protection': '0'
};

const securityHeadersHandle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
		response.headers.set(key, value);
	}
	return response;
};

const requestContextHandle: Handle = ({ event, resolve }) => {
	event.locals.dkuRequest = createDkuRequestContext(
		event.platform?.env?.CF_VERSION_METADATA?.id ?? ''
	);
	return resolve(event);
};

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
	requestContextHandle,
	paraglideHandle,
	securityHeadersHandle
);

export const handleError = Sentry.handleErrorWithSentry();
