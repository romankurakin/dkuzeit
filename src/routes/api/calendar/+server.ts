import {
	buildCalendarTitle,
	buildMergedSchedule,
	getMeta,
	isUnknownEntityError,
	pickRollingWeeksForCalendar
} from '$lib/server/dku';
import { buildIcsCalendar } from '$lib/server/ics';
import {
	badRequestProblem,
	forbiddenProblem,
	internalErrorProblem,
	notFoundProblem,
	serviceUnavailableProblem
} from '$lib/server/problem';
import { traceSerialize } from '$lib/server/tracing';
import { verifyToken } from '$lib/server/token';
import type { RequestHandler } from './$types';

const CALENDAR_ROLLING_WEEKS = 4;

export const GET: RequestHandler = async ({ url, platform }) => {
	const token = url.searchParams.get('token');
	if (!token) {
		return badRequestProblem('Missing token', '/api/calendar');
	}

	const secret = platform?.env?.TOKEN_SECRET;
	if (!secret) {
		return internalErrorProblem('Server misconfigured', '/api/calendar');
	}
	const payload = await verifyToken(token, secret);
	if (!payload) {
		return forbiddenProblem('Invalid or expired token', '/api/calendar');
	}

	const lang = payload.l === 'de' ? 'de' : 'ru';
	const meta = await getMeta();
	const weeks = pickRollingWeeksForCalendar(meta.weeks, '', { windowSize: CALENDAR_ROLLING_WEEKS });
	let schedules;
	try {
		schedules = await Promise.all(
			weeks.map((week) => buildMergedSchedule(payload.g, week.value, payload.c, meta))
		);
	} catch (error) {
		if (isUnknownEntityError(error)) {
			return notFoundProblem('Requested calendar resource was not found', '/api/calendar');
		}
		return serviceUnavailableProblem('Unable to load schedule', '/api/calendar');
	}
	const events = schedules.flatMap((s) => s.events);
	const group = meta.groups.find((g) => g.codeRaw === payload.g);
	const calendarTitle = buildCalendarTitle(group?.codeRu ?? payload.g);
	const calendar = traceSerialize('buildIcsCalendar', { eventCount: events.length }, () =>
		buildIcsCalendar(calendarTitle, events, lang)
	);

	return new Response(calendar, {
		headers: {
			'content-type': 'text/calendar; charset=utf-8',
			'content-disposition': `inline; filename="dku-${payload.g}.ics"`,
			'cache-control': 'private, no-cache'
		}
	});
};
