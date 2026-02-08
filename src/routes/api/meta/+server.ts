import { json } from '@sveltejs/kit';
import { getMeta, CLIENT_TTL_SECONDS } from '$lib/server/dku';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const meta = await getMeta();
	return json(meta, { headers: { 'cache-control': `public, max-age=${CLIENT_TTL_SECONDS}` } });
};
