import { json } from '@sveltejs/kit';
import {
	buildMergedSchedule,
	getMeta,
	isUnknownEntityError,
	CLIENT_CACHE_HEADER
} from '$lib/server/dku';
import { parseCohortsCsv } from '$lib/server/cohorts';
import { badRequestProblem, notFoundProblem, serviceUnavailableProblem } from '$lib/server/problem';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const group = url.searchParams.get('group');
	if (!group) {
		return badRequestProblem('group query parameter is required', '/api/schedule');
	}

	const meta = await getMeta(locals?.dkuRequest);
	const week = url.searchParams.get('week') ?? meta.weeks[0]?.value;
	if (!week) {
		return serviceUnavailableProblem('No weeks available in source timetable', '/api/schedule');
	}

	const cohorts = parseCohortsCsv(url.searchParams.get('cohorts'));

	try {
		const schedule = await buildMergedSchedule(group, week, cohorts, {
			meta,
			request: locals?.dkuRequest
		});
		return json(
			{ cohorts: schedule.cohorts, events: schedule.events },
			{ headers: { 'cache-control': CLIENT_CACHE_HEADER } }
		);
	} catch (error) {
		if (isUnknownEntityError(error)) {
			return notFoundProblem('Requested schedule was not found', '/api/schedule');
		}
		return serviceUnavailableProblem('Unable to load schedule', '/api/schedule');
	}
};
