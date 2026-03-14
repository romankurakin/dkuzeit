import { json } from '@sveltejs/kit';
import { getMeta, API_RESPONSE_CACHE_HEADER } from '$lib/server/dku';
import { serviceUnavailableProblem } from '$lib/server/problem';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	let meta: Awaited<ReturnType<typeof getMeta>>;
	try {
		meta = await getMeta(locals?.dkuRequest);
	} catch {
		return serviceUnavailableProblem('Unable to load schedule metadata', '/api/meta');
	}
	return json(meta, { headers: { 'cache-control': API_RESPONSE_CACHE_HEADER } });
};
