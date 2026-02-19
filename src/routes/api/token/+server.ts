import { json } from '@sveltejs/kit';
import { normalizeCohortList } from '$lib/server/cohorts';
import { getMeta } from '$lib/server/dku';
import { badRequestProblem, internalErrorProblem, notFoundProblem } from '$lib/server/problem';
import { signToken } from '$lib/server/token';
import type { UiLanguage } from '$lib/server/types';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform }) => {
	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return badRequestProblem('Invalid JSON body', '/api/token');
	}

	const body = payload as { group?: string; week?: string; cohorts?: string[]; lang?: string };
	if (!body.group) {
		return badRequestProblem('group is required', '/api/token');
	}

	const meta = await getMeta();
	const week = body.week ?? meta.weeks[0]?.value;
	if (!week) {
		return badRequestProblem('week is required and source has no defaults', '/api/token');
	}

	const groupExists = meta.groups.some((g) => g.codeRaw === body.group || g.codeRu === body.group);
	if (!groupExists) {
		return notFoundProblem('Requested group was not found', '/api/token');
	}

	const weekExists = meta.weeks.some((w) => w.value === week);
	if (!weekExists) {
		return notFoundProblem('Requested week was not found', '/api/token');
	}

	const lang: UiLanguage = body.lang === 'de' ? 'de' : 'ru';
	const cohorts = normalizeCohortList(body.cohorts);

	const secret = platform?.env?.TOKEN_SECRET;
	if (!secret) {
		return internalErrorProblem('Server misconfigured', '/api/token');
	}

	const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 180;
	const token = await signToken({ g: body.group, w: week, c: cohorts, l: lang, exp }, secret);

	return json({ token });
};
