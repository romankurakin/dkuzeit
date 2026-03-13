import { json } from '@sveltejs/kit';
import { getMeta, CLIENT_CACHE_HEADER } from '$lib/server/dku';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const meta = await getMeta(locals?.dkuRequest);
	return json(meta, { headers: { 'cache-control': CLIENT_CACHE_HEADER } });
};
