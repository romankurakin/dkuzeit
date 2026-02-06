import { json } from '@sveltejs/kit';
import { getMeta } from '$lib/server/dku';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform }) => {
	const meta = await getMeta(platform?.env ?? {});
	return json(meta);
};
