import { env, tracing } from 'cloudflare:workers';
import { sentryHandle, initCloudflareSentryHandle } from '@sentry/sveltekit';
import * as Sentry from '@sentry/sveltekit';
import { sequence, type Handle } from '@sveltejs/kit/hooks';
import { paraglideMiddleware } from '#lib/paraglide/server.js';
import { serverSentryConfig } from '#lib/sentry.ts';
import { createDkuRequestContext } from '#lib/server/dku-fetch.ts';

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
	event.locals.dkuRequest = createDkuRequestContext(env.CF_VERSION_METADATA?.id ?? '', tracing);
	return resolve(event);
};

const paraglideHandle: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ locale }) =>
		resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%lang%', locale)
		})
	);

export const handle = sequence(
	initCloudflareSentryHandle(serverSentryConfig),
	sentryHandle(),
	requestContextHandle,
	paraglideHandle,
	securityHeadersHandle
);

export const handleError = Sentry.handleErrorWithSentry();
