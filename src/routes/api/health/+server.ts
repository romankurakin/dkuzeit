import type { RequestHandler } from './$types';

export const GET: RequestHandler = () =>
	Response.json({ status: 'ok' }, { headers: { 'cache-control': 'no-store' } });
