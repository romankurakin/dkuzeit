import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/node';
import { GET as getMeta } from '../../src/routes/api/meta/+server';
import { GET as getSchedule } from '../../src/routes/api/schedule/+server';
import { POST as postToken } from '../../src/routes/api/token/+server';
import { GET as getCalendar } from '../../src/routes/api/calendar/+server';
import { load as loadPage } from '../../src/routes/[[group]]/+page.server';
import { signToken, verifyToken } from '../../src/lib/server/token';

const SECRET = 'routes-test-secret';

const NAVBAR_HTML_WITH_WEEK = `
<html>
	<body>
		<select name="week">
			<option value="5">05.02.2026 - 11.02.2026</option>
		</select>
		<script>
			var classes = ["1-CS"];
		</script>
	</body>
</html>
`;

const NAVBAR_HTML_NO_WEEKS = `
<html>
	<body>
		<select name="week"></select>
		<script>
			var classes = ["1-CS"];
		</script>
	</body>
</html>
`;

const SCHEDULE_HTML = `
<html>
	<body>
		<center>
			<table>
				<tbody>
					<tr>
						<td rowspan="2">08:00 - 09:40</td>
						<td colspan="12" rowspan="2">
							<table>
								<tr><td>MATH</td></tr>
								<tr><td>Teacher</td></tr>
								<tr><td>A101</td></tr>
							</table>
						</td>
					</tr>
					<tr></tr>
				</tbody>
			</table>
		</center>
		<b>Пн 05.02.</b>
		<b>Вт 06.02.</b>
		<b>Ср 07.02.</b>
		<b>Чт 08.02.</b>
		<b>Пт 09.02.</b>
		<b>Сб 10.02.</b>
		<b>Дисциплины</b>
		<table>
			<tr><td>MATH</td><td>Математика/Mathematik лекция</td></tr>
		</table>
	</body>
</html>
`;

function useUpstreamStubs(
	opts: {
		navbar?: string;
		scheduleStatus?: number;
		scheduleBody?: string;
	} = {}
) {
	const navbar = opts.navbar ?? NAVBAR_HTML_WITH_WEEK;
	const scheduleStatus = opts.scheduleStatus ?? 200;
	const scheduleBody = opts.scheduleBody ?? SCHEDULE_HTML;
	server.use(
		http.get('https://timetable.dku.kz/frames/navbar.htm', () => HttpResponse.text(navbar)),
		http.get(
			'https://timetable.dku.kz/05/c/c00001.htm',
			() => new HttpResponse(scheduleBody, { status: scheduleStatus })
		)
	);
}

function useNavbarUpstreamFailure() {
	server.use(
		http.get(
			'https://timetable.dku.kz/frames/navbar.htm',
			() => new HttpResponse(null, { status: 503 })
		)
	);
}

describe('routes via msw', () => {
	it('serves meta and schedule from real parsing pipeline', async () => {
		useUpstreamStubs();

		const metaResponse = await getMeta({} as never);
		expect(metaResponse.status).toBe(200);
		const meta = (await metaResponse.json()) as {
			weeks: Array<{ value: string }>;
			groups: Array<{ codeRaw: string }>;
		};
		expect(metaResponse.headers.get('cache-control')).toBe('no-store');
		expect(meta.weeks.map((w) => w.value)).toEqual(['05']);
		expect(meta.groups.map((g) => g.codeRaw)).toEqual(['1-CS']);

		const scheduleResponse = await getSchedule({
			url: new URL('http://localhost/api/schedule?group=1-CS&week=05')
		} as never);
		expect(scheduleResponse.status).toBe(200);
		const schedule = (await scheduleResponse.json()) as {
			events: Array<{ subjectShortRaw: string; room: string }>;
		};
		expect(scheduleResponse.headers.get('cache-control')).toBe('no-store');
		expect(schedule.events).toHaveLength(1);
		expect(schedule.events[0]).toMatchObject({ subjectShortRaw: 'MATH', room: 'A101' });
	});

	it('handles schedule endpoint error branches', async () => {
		useUpstreamStubs();

		const missingGroup = await getSchedule({
			url: new URL('http://localhost/api/schedule?week=05')
		} as never);
		expect(missingGroup.status).toBe(400);

		const unknownGroup = await getSchedule({
			url: new URL('http://localhost/api/schedule?group=404&week=05')
		} as never);
		expect(unknownGroup.status).toBe(404);

		useUpstreamStubs({ navbar: NAVBAR_HTML_NO_WEEKS });
		const noWeeks = await getSchedule({
			url: new URL('http://localhost/api/schedule?group=1-CS')
		} as never);
		expect(noWeeks.status).toBe(503);

		useUpstreamStubs({ scheduleStatus: 503 });
		const upstreamFailure = await getSchedule({
			url: new URL('http://localhost/api/schedule?group=1-CS&week=05')
		} as never);
		expect(upstreamFailure.status).toBe(503);
	});

	it('issues and validates token from real token route', async () => {
		useUpstreamStubs();

		const request = new Request('http://localhost/api/token', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				group: '1-CS',
				week: '05',
				cohorts: ['WPM1', 'WPM1'],
				lang: 'de'
			})
		});
		const response = await postToken({
			request,
			platform: { env: { TOKEN_SECRET: SECRET } }
		} as never);
		expect(response.status).toBe(200);
		const { token } = (await response.json()) as { token: string };
		expect(token).toBeTruthy();

		const payload = await verifyToken(token, SECRET);
		expect(payload).toMatchObject({
			g: '1-CS',
			w: '05',
			c: ['WPM1', 'WPM1'],
			l: 'de'
		});
	});

	it('handles token endpoint error branches', async () => {
		useUpstreamStubs();

		const invalidJson = await postToken({
			request: new Request('http://localhost/api/token', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: '{bad-json'
			}),
			platform: { env: { TOKEN_SECRET: SECRET } }
		} as never);
		expect(invalidJson.status).toBe(400);

		const missingGroup = await postToken({
			request: new Request('http://localhost/api/token', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ week: '05' })
			}),
			platform: { env: { TOKEN_SECRET: SECRET } }
		} as never);
		expect(missingGroup.status).toBe(400);

		const unknownWeek = await postToken({
			request: new Request('http://localhost/api/token', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ group: '1-CS', week: '99' })
			}),
			platform: { env: { TOKEN_SECRET: SECRET } }
		} as never);
		expect(unknownWeek.status).toBe(404);

		const missingSecret = await postToken({
			request: new Request('http://localhost/api/token', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ group: '1-CS', week: '05' })
			}),
			platform: { env: {} }
		} as never);
		expect(missingSecret.status).toBe(500);

		useUpstreamStubs({ navbar: NAVBAR_HTML_NO_WEEKS });
		const noSourceWeek = await postToken({
			request: new Request('http://localhost/api/token', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ group: '1-CS' })
			}),
			platform: { env: { TOKEN_SECRET: SECRET } }
		} as never);
		expect(noSourceWeek.status).toBe(400);
	});

	it('builds calendar and loads server page through real server stack', async () => {
		useUpstreamStubs();

		const token = await signToken(
			{
				g: '1-CS',
				w: '05',
				c: [],
				l: 'ru',
				exp: Math.floor(Date.now() / 1000) + 3600
			},
			SECRET
		);

		const calendarResponse = await getCalendar({
			url: new URL(`http://localhost/api/calendar?token=${token}`),
			platform: { env: { TOKEN_SECRET: SECRET } }
		} as never);
		expect(calendarResponse.status).toBe(200);
		expect(calendarResponse.headers.get('content-type')).toContain('text/calendar');
		await expect(calendarResponse.text()).resolves.toContain('BEGIN:VCALENDAR');

		const setHeaders = vi.fn();
		const cookies = {
			get: vi.fn(() => undefined),
			set: vi.fn()
		};
		const pageData = (await loadPage({
			params: { group: '1-cs' },
			url: new URL('http://localhost/1-cs'),
			setHeaders,
			cookies
		} as never)) as { schedule: { events: unknown[]; error?: boolean; resolvedWeek: string } };
		expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': 'private, no-store' });
		expect(pageData.schedule.events).toHaveLength(1);
		expect(pageData.schedule.resolvedWeek).toBe('05');
		expect(pageData.schedule.error).toBe(false);
		expect(cookies.set).toHaveBeenCalledWith(
			'dku_group',
			'1-CS',
			expect.objectContaining({
				path: '/',
				sameSite: 'lax',
				httpOnly: false
			})
		);
	});

	it('avoids rewriting group cookie when already up to date', async () => {
		useUpstreamStubs();

		const setHeaders = vi.fn();
		const cookies = {
			get: vi.fn((name: string) => {
				if (name === 'dku_group') return '1-CS';
				if (name === 'dku_week') return '05';
				return undefined;
			}),
			set: vi.fn()
		};
		const pageData = (await loadPage({
			params: { group: '1-cs' },
			url: new URL('http://localhost/1-cs'),
			setHeaders,
			cookies
		} as never)) as { schedule: { events: unknown[]; error?: boolean; resolvedGroup: string } };

		expect(pageData.schedule.error).toBe(false);
		expect(pageData.schedule.resolvedGroup).toBe('1-CS');
		expect(cookies.set).not.toHaveBeenCalled();
	});

	it('ignores invalid remembered group cookie and continues with default group', async () => {
		useUpstreamStubs();

		const setHeaders = vi.fn();
		const cookies = {
			get: vi.fn((name: string) => (name === 'dku_group' ? 'unknown-group' : undefined)),
			set: vi.fn()
		};

		const pageData = (await loadPage({
			params: {},
			url: new URL('http://localhost/'),
			setHeaders,
			cookies
		} as never)) as { schedule: { error?: boolean; resolvedGroup: string; resolvedWeek: string } };

		expect(pageData.schedule.error).toBe(false);
		expect(pageData.schedule.resolvedGroup).toBe('1-CS');
		expect(pageData.schedule.resolvedWeek).toBe('05');
		expect(cookies.set).not.toHaveBeenCalled();
	});

	it('repairs invalid remembered week cookie by falling back to automatic week', async () => {
		useUpstreamStubs();

		const cookies = {
			get: vi.fn((name: string) => {
				if (name === 'dku_group') return '1-CS';
				if (name === 'dku_week') return '99';
				return undefined;
			}),
			set: vi.fn()
		};
		const pageData = (await loadPage({
			params: { group: '1-cs' },
			url: new URL('http://localhost/1-cs'),
			setHeaders: vi.fn(),
			cookies
		} as never)) as { schedule: { resolvedWeek: string; error?: boolean } };

		expect(pageData.schedule.error).toBe(false);
		expect(pageData.schedule.resolvedWeek).toBe('05');
		expect(cookies.set).toHaveBeenCalledWith(
			'dku_week',
			'05',
			expect.objectContaining({
				path: '/',
				sameSite: 'lax',
				httpOnly: false
			})
		);
	});

	it('preserves valid past week cookie without overwriting it', async () => {
		const twoWeekNavbar = `
<html>
	<body>
		<select name="week">
			<option value="4">29.01.2026 - 04.02.2026</option>
			<option value="5">05.02.2026 - 11.02.2026</option>
		</select>
		<script>
			var classes = ["1-CS"];
		</script>
	</body>
</html>
`;
		useUpstreamStubs({ navbar: twoWeekNavbar });
		server.use(
			http.get('https://timetable.dku.kz/04/c/c00001.htm', () => HttpResponse.text(SCHEDULE_HTML))
		);

		const cookies = {
			get: vi.fn((name: string) => {
				if (name === 'dku_group') return '1-CS';
				if (name === 'dku_week') return '04';
				return undefined;
			}),
			set: vi.fn()
		};
		const pageData = (await loadPage({
			params: { group: '1-cs' },
			url: new URL('http://localhost/1-cs'),
			setHeaders: vi.fn(),
			cookies
		} as never)) as { schedule: { resolvedWeek: string; error?: boolean } };

		expect(pageData.schedule.error).toBe(false);
		expect(pageData.schedule.resolvedWeek).toBe('04');
		expect(cookies.set).not.toHaveBeenCalledWith('dku_week', expect.anything(), expect.anything());
	});

	it('ignores invalid remembered cohorts cookie and continues rendering', async () => {
		useUpstreamStubs();

		const cookies = {
			get: vi.fn((name: string) => {
				if (name === 'dku_group') return '1-CS';
				if (name === 'dku_week') return '05';
				if (name === 'dku_cohorts') return '<script>,UNKNOWN,   ';
				return undefined;
			}),
			set: vi.fn()
		};
		const pageData = (await loadPage({
			params: { group: '1-cs' },
			url: new URL('http://localhost/1-cs'),
			setHeaders: vi.fn(),
			cookies
		} as never)) as {
			schedule: { events: unknown[]; selectedCohortsCsv: string; error?: boolean };
		};

		expect(pageData.schedule.error).toBe(false);
		expect(pageData.schedule.events.length).toBeGreaterThan(0);
		expect(pageData.schedule.selectedCohortsCsv).toContain('UNKNOWN');
	});

	it('strips state query params from incoming requests', async () => {
		useUpstreamStubs();

		const redirectResult = loadPage({
			params: {},
			url: new URL('http://localhost/?group=1-CS&week=05&cohorts=WPM1&probe=1'),
			setHeaders: vi.fn(),
			cookies: {
				get: vi.fn(() => undefined),
				set: vi.fn()
			}
		} as never);
		await expect(redirectResult).rejects.toMatchObject({
			status: 301,
			location: '/?probe=1'
		});
	});

	it('restores remembered group and keeps state params out of redirected URL', async () => {
		useUpstreamStubs();

		const rememberedGroupResult = loadPage({
			params: {},
			url: new URL('http://localhost/?persist_probe=1'),
			setHeaders: vi.fn(),
			cookies: {
				get: vi.fn((name: string) => {
					if (name === 'dku_group') return '1-CS';
					if (name === 'dku_cohorts') return 'WPM1';
					if (name === 'dku_week') return '05';
					return undefined;
				}),
				set: vi.fn()
			}
		} as never);
		await expect(rememberedGroupResult).rejects.toMatchObject({
			status: 302,
			location: '/1-cs?persist_probe=1'
		});
	});

	it('handles calendar and page redirect branches', async () => {
		useUpstreamStubs();

		const missingToken = await getCalendar({
			url: new URL('http://localhost/api/calendar'),
			platform: { env: { TOKEN_SECRET: SECRET } }
		} as never);
		expect(missingToken.status).toBe(400);

		const invalidToken = await getCalendar({
			url: new URL('http://localhost/api/calendar?token=bad-token'),
			platform: { env: { TOKEN_SECRET: SECRET } }
		} as never);
		expect(invalidToken.status).toBe(403);

		const missingSecret = await getCalendar({
			url: new URL('http://localhost/api/calendar?token=t'),
			platform: { env: {} }
		} as never);
		expect(missingSecret.status).toBe(500);

		const unknownGroupToken = await signToken(
			{
				g: '404',
				w: '05',
				c: [],
				l: 'ru',
				exp: Math.floor(Date.now() / 1000) + 3600
			},
			SECRET
		);
		const unknownGroup = await getCalendar({
			url: new URL(`http://localhost/api/calendar?token=${unknownGroupToken}`),
			platform: { env: { TOKEN_SECRET: SECRET } }
		} as never);
		expect(unknownGroup.status).toBe(404);

		useUpstreamStubs({ scheduleStatus: 503 });
		const scheduleFailureToken = await signToken(
			{
				g: '1-CS',
				w: '05',
				c: [],
				l: 'ru',
				exp: Math.floor(Date.now() / 1000) + 3600
			},
			SECRET
		);
		const scheduleFailure = await getCalendar({
			url: new URL(`http://localhost/api/calendar?token=${scheduleFailureToken}`),
			platform: { env: { TOKEN_SECRET: SECRET } }
		} as never);
		expect(scheduleFailure.status).toBe(503);

		useUpstreamStubs();
		const stripStateRedirect = loadPage({
			params: {},
			url: new URL('http://localhost/?group=1-CS&week=05'),
			setHeaders: vi.fn(),
			cookies: {
				get: vi.fn(() => undefined),
				set: vi.fn()
			}
		} as never);
		await expect(stripStateRedirect).rejects.toMatchObject({
			status: 301,
			location: '/'
		});

		const unknownGroupResult = loadPage({
			params: { group: 'unknown-group' },
			url: new URL('http://localhost/unknown-group'),
			setHeaders: vi.fn(),
			cookies: {
				get: vi.fn(() => undefined),
				set: vi.fn()
			}
		} as never);
		await expect(unknownGroupResult).rejects.toMatchObject({ status: 404 });

		const rememberedGroupResult = loadPage({
			params: {},
			url: new URL('http://localhost/'),
			setHeaders: vi.fn(),
			cookies: {
				get: vi.fn((name: string) => (name === 'dku_group' ? '1-CS' : undefined)),
				set: vi.fn()
			}
		} as never);
		await expect(rememberedGroupResult).rejects.toMatchObject({
			status: 302,
			location: '/1-cs'
		});
	});

	it('degrades gracefully when loading metadata fails upstream', async () => {
		useNavbarUpstreamFailure();

		const token = await signToken(
			{
				g: '1-CS',
				w: '05',
				c: [],
				l: 'ru',
				exp: Math.floor(Date.now() / 1000) + 3600
			},
			SECRET
		);

		const metaResponse = await getMeta({} as never);
		expect(metaResponse.status).toBe(503);

		const scheduleResponse = await getSchedule({
			url: new URL('http://localhost/api/schedule?group=1-CS&week=05')
		} as never);
		expect(scheduleResponse.status).toBe(503);

		const tokenResponse = await postToken({
			request: new Request('http://localhost/api/token', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ group: '1-CS' })
			}),
			platform: { env: { TOKEN_SECRET: SECRET } }
		} as never);
		expect(tokenResponse.status).toBe(503);

		const calendarResponse = await getCalendar({
			url: new URL(`http://localhost/api/calendar?token=${token}`),
			platform: { env: { TOKEN_SECRET: SECRET } }
		} as never);
		expect(calendarResponse.status).toBe(503);

		const setHeaders = vi.fn();
		const pageData = (await loadPage({
			params: { group: '1-cs' },
			url: new URL('http://localhost/1-cs'),
			setHeaders,
			cookies: {
				get: vi.fn(() => undefined),
				set: vi.fn()
			}
		} as never)) as {
			meta: { groups: unknown[]; weeks: unknown[]; resolvedWeek: string };
			schedule: { error?: boolean; resolvedGroup: string; resolvedWeek: string };
		};
		expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': 'private, no-store' });
		expect(pageData.meta).toEqual({ groups: [], weeks: [], resolvedWeek: '' });
		expect(pageData.schedule).toMatchObject({
			error: true,
			resolvedGroup: '',
			resolvedWeek: ''
		});
	});
});
