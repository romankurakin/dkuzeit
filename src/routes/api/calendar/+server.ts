import { buildCalendarTitle, buildMergedSchedule, getMeta, pickRollingWeeksForCalendar } from '$lib/server/dku';
import { buildIcsCalendar } from '$lib/server/ics';
import { verifyToken } from '$lib/server/token';
import type { RequestHandler } from './$types';

const CALENDAR_ROLLING_WEEKS = 4;

export const GET: RequestHandler = async ({ url, platform }) => {
	const token = url.searchParams.get('token');
	if (!token) {
		return new Response('Missing token', { status: 400 });
	}

	const secret = platform?.env?.TOKEN_SECRET ?? '';
	const payload = await verifyToken(token, secret);
	if (!payload) {
		return new Response('Invalid or expired token', { status: 403 });
	}

	const lang = payload.l === 'de' ? 'de' : 'ru';
	const env = platform?.env ?? {};
	const meta = await getMeta(env);
	const weeks = pickRollingWeeksForCalendar(meta.weeks, '', { windowSize: CALENDAR_ROLLING_WEEKS });

	const events = [];
	for (const week of weeks) {
		const schedule = await buildMergedSchedule(env, payload.g, week.value, payload.c);
		events.push(...schedule.events);
	}

	const calendarTitle = buildCalendarTitle(payload.g, payload.c);
	const calendar = buildIcsCalendar(calendarTitle, events, lang);

	return new Response(calendar, {
		headers: {
			'content-type': 'text/calendar; charset=utf-8',
			'content-disposition': `inline; filename="dku-${payload.g}.ics"`,
			'cache-control': 'no-cache'
		}
	});
};
