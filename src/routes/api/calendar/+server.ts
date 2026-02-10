import {
	buildCalendarTitle,
	buildMergedSchedule,
	getMeta,
	pickRollingWeeksForCalendar
} from '$lib/server/dku';
import { buildIcsCalendar } from '$lib/server/ics';
import { traceSerialize } from '$lib/server/tracing';
import { verifyToken } from '$lib/server/token';
import type { RequestHandler } from './$types';

const CALENDAR_ROLLING_WEEKS = 4;

export const GET: RequestHandler = async ({ url, platform }) => {
	const token = url.searchParams.get('token');
	if (!token) {
		return new Response('Missing token', { status: 400 });
	}

	const secret = platform?.env?.TOKEN_SECRET;
	if (!secret) {
		return new Response('Server misconfigured', { status: 500 });
	}
	const payload = await verifyToken(token, secret);
	if (!payload) {
		return new Response('Invalid or expired token', { status: 403 });
	}

	const lang = payload.l === 'de' ? 'de' : 'ru';
	const meta = await getMeta();
	const weeks = pickRollingWeeksForCalendar(meta.weeks, '', { windowSize: CALENDAR_ROLLING_WEEKS });

	const schedules = await Promise.all(
		weeks.map((week) => buildMergedSchedule(payload.g, week.value, payload.c, meta))
	);
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
