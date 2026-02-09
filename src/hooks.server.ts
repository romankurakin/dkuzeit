import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { CLIENT_CACHE_HEADER } from '$lib/server/dku';

const cacheRemoteFunctions: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	if (event.isRemoteRequest) {
		response.headers.set('cache-control', CLIENT_CACHE_HEADER);
	}
	return response;
};

const paraglideHandle: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request: localizedRequest, locale }) => {
		event.request = localizedRequest;
		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%lang%', locale)
		});
	});

export const handle: Handle = sequence(cacheRemoteFunctions, paraglideHandle);
