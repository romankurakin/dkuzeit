import { json } from '@sveltejs/kit';
import { buildMergedSchedule, getMeta } from '$lib/server/dku';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, platform }) => {
	const group = url.searchParams.get('group');
	if (!group) {
		return json({ error: 'group query parameter is required' }, { status: 400 });
	}

	const meta = await getMeta(platform?.env ?? {});
	const week = url.searchParams.get('week') ?? meta.weeks[0]?.value;
	if (!week) {
		return json({ error: 'No weeks available in source timetable' }, { status: 503 });
	}

	const cohorts = (url.searchParams.get('cohorts') ?? '')
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean);

	try {
		const schedule = await buildMergedSchedule(platform?.env ?? {}, group, week, cohorts);
		return json({
			cohorts: schedule.cohorts,
			events: schedule.events
		});
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Unable to load schedule' },
			{ status: 400 }
		);
	}
};
