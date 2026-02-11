import type { Handle } from '@sveltejs/kit';
import { sentryHandle, initCloudflareSentryHandle } from '@sentry/sveltekit';
import * as Sentry from '@sentry/sveltekit';
import { sequence } from '@sveltejs/kit/hooks';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { sentryConfig } from '$lib/sentry';
import { setCacheVersion } from '$lib/server/dku-fetch';

let versionSet = false;
const versionHandle: Handle = ({ event, resolve }) => {
	if (!versionSet) {
		const id = event.platform?.env?.CF_VERSION_METADATA?.id;
		if (id) {
			setCacheVersion(id);
			versionSet = true;
		}
	}
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
	versionHandle,
	paraglideHandle
);

export const handleError = Sentry.handleErrorWithSentry();
