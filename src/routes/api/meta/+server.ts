import { getMeta, API_RESPONSE_CACHE_HEADER } from '#lib/server/dku.ts';
import { serviceUnavailableProblem } from '#lib/server/problem.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	let meta: Awaited<ReturnType<typeof getMeta>>;
	try {
		meta = await getMeta(locals?.dkuRequest);
	} catch {
		return serviceUnavailableProblem('Unable to load schedule metadata', '/api/meta');
	}
	return Response.json(meta, { headers: { 'cache-control': API_RESPONSE_CACHE_HEADER } });
};
