import { json } from '@sveltejs/kit';
import { normalizeCohortList } from '$lib/server/cohorts';
import { getMeta } from '$lib/server/dku';
import { signToken } from '$lib/server/token';
import type { UiLanguage } from '$lib/server/types';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform }) => {
	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const body = payload as { group?: string; week?: string; cohorts?: string[]; lang?: string };
	if (!body.group) {
		return json({ error: 'group is required' }, { status: 400 });
	}

	const meta = await getMeta();
	const week = body.week ?? meta.weeks[0]?.value;
	if (!week) {
		return json({ error: 'week is required and source has no defaults' }, { status: 400 });
	}

	const lang: UiLanguage = body.lang === 'de' ? 'de' : 'ru';
	const cohorts = normalizeCohortList(body.cohorts);

	const secret = platform?.env?.TOKEN_SECRET;
	if (!secret) {
		return json({ error: 'Server misconfigured' }, { status: 500 });
	}

	const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 180;
	const token = await signToken({ g: body.group, w: week, c: cohorts, l: lang, exp }, secret);

	return json({ token });
};
