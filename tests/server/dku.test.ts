import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LessonEvent, MetaPayload, WeekOption } from '../../src/lib/server/types';

const {
	cachedMock,
	fetchTextMock,
	parseNavHtmlMock,
	parseTimetablePageMock,
	traceFnMock,
	todayInAlmatyMock
} = vi.hoisted(() => ({
	cachedMock: vi.fn(),
	fetchTextMock: vi.fn(),
	parseNavHtmlMock: vi.fn(),
	parseTimetablePageMock: vi.fn(),
	traceFnMock: vi.fn(),
	todayInAlmatyMock: vi.fn()
}));

vi.mock('../../src/lib/server/dku-fetch', () => ({
	CLIENT_CACHE_HEADER: 'public, max-age=1800, stale-while-revalidate=1800',
	CLIENT_TTL_SECONDS: 1800,
	cached: cachedMock,
	fetchText: fetchTextMock
}));

vi.mock('../../src/lib/server/parser', () => ({
	parseNavHtml: parseNavHtmlMock,
	parseTimetablePage: parseTimetablePageMock
}));

vi.mock('../../src/lib/server/tracing', () => ({
	traceFn: traceFnMock
}));

vi.mock('../../src/lib/server/time', () => ({
	todayInAlmaty: todayInAlmatyMock
}));

import {
	buildCalendarTitle,
	buildMergedSchedule,
	getMeta,
	isUnknownEntityError,
	pickRollingWeeksForCalendar
} from '../../src/lib/server/dku';

function event(overrides: Partial<LessonEvent>): LessonEvent {
	return {
		id: overrides.id ?? 'e1',
		dateIso: overrides.dateIso ?? '2026-02-10',
		dayIndex: overrides.dayIndex ?? 1,
		startTime: overrides.startTime ?? '08:00',
		endTime: overrides.endTime ?? '09:30',
		subjectShortRaw: overrides.subjectShortRaw ?? 'subject',
		subjectShortRu: overrides.subjectShortRu ?? 'subject',
		subjectShortDe: overrides.subjectShortDe ?? 'subject',
		subjectFullRaw: overrides.subjectFullRaw ?? 'subject',
		subjectFullRu: overrides.subjectFullRu ?? 'subject',
		subjectFullDe: overrides.subjectFullDe ?? 'subject',
		lessonType: overrides.lessonType ?? '',
		room: overrides.room ?? 'A1',
		groupCode: overrides.groupCode ?? '1-CS',
		originGroupCode: overrides.originGroupCode ?? '1-CS',
		track: overrides.track ?? 'none',
		cohortCode: overrides.cohortCode ?? null,
		scope: overrides.scope ?? 'core_fixed'
	};
}

describe('dku helpers', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		cachedMock.mockImplementation(async (_key, compute) => compute());
		traceFnMock.mockImplementation(async (_name, _attrs, fn) => fn());
		todayInAlmatyMock.mockReturnValue('2026-02-10');
	});

	it('detect unknown entity errors', () => {
		expect(isUnknownEntityError(new Error('Unknown group: X'))).toBe(true);
		expect(isUnknownEntityError(new Error('Unknown week: 11'))).toBe(true);
		expect(isUnknownEntityError(new Error('Other error'))).toBe(false);
		expect(isUnknownEntityError('Unknown group: X')).toBe(false);
	});

	it('read and parse meta through cache', async () => {
		const meta: MetaPayload = {
			weeks: [{ value: '05', label: 'w5', startDateIso: '2026-02-09' }],
			groups: [{ id: 1, codeRaw: '1-CS', codeRu: '1-КС', codeDe: '1-KS' }]
		};
		fetchTextMock.mockResolvedValue('<html>nav</html>');
		parseNavHtmlMock.mockReturnValue(meta);

		await expect(getMeta()).resolves.toEqual(meta);
		expect(cachedMock).toHaveBeenCalledWith('meta', expect.any(Function));
		expect(fetchTextMock).toHaveBeenCalledWith('frames/navbar.htm');
		expect(parseNavHtmlMock).toHaveBeenCalledWith('<html>nav</html>');
	});

	it('build merged schedule and keep selected cohorts plus assessments', async () => {
		const meta: MetaPayload = {
			weeks: [{ value: '05', label: 'w5', startDateIso: '2026-02-09' }],
			groups: [{ id: 1, codeRaw: '1-CS', codeRu: '1-КС', codeDe: '1-KS' }]
		};
		fetchTextMock.mockResolvedValue('<html>schedule</html>');
		parseTimetablePageMock.mockResolvedValue({
			events: [
				event({ id: 'core', scope: 'core_fixed' }),
				event({ id: 'selected', scope: 'cohort_shared', cohortCode: 'WPM1', track: 'pe' }),
				event({ id: 'other', scope: 'cohort_shared', cohortCode: 'WPM2', track: 'pe' }),
				event({
					id: 'assess',
					scope: 'cohort_shared',
					cohortCode: 'WPM2',
					subjectShortRaw: 'midterm'
				})
			],
			cohorts: [
				{ code: 'WPM2', track: 'pe', label: 'wpm2', sourceGroups: ['1-CS'] },
				{ code: 'A1', track: 'de', label: 'a1', sourceGroups: ['1-CS'] }
			]
		});

		const merged = await buildMergedSchedule('1-CS', '05', [' WPM1 '], meta);
		expect(fetchTextMock).toHaveBeenCalledWith('05/c/c00001.htm');
		expect(merged.events.map((item) => item.id)).toEqual(['core', 'selected', 'assess']);
		expect(merged.cohorts.map((item) => item.code)).toEqual(['A1', 'WPM2']);
	});

	it('throw unknown week and group when schedule cannot be resolved', async () => {
		const meta: MetaPayload = {
			weeks: [{ value: '05', label: 'w5', startDateIso: '2026-02-09' }],
			groups: [{ id: 1, codeRaw: '1-CS', codeRu: '1-КС', codeDe: '1-KS' }]
		};

		await expect(buildMergedSchedule('1-CS', '99', [], meta)).rejects.toThrow('Unknown week: 99');
		await expect(buildMergedSchedule('404', '05', [], meta)).rejects.toThrow('Unknown group: 404');
	});

	it('build calendar title and pick rolling weeks', () => {
		expect(buildCalendarTitle('2-CS')).toBe('DKU 2-CS');

		const weeks: WeekOption[] = [
			{ value: '04', label: 'w4', startDateIso: '2026-02-23' },
			{ value: '01', label: 'w1', startDateIso: '2026-02-02' },
			{ value: '03', label: 'w3', startDateIso: '2026-02-16' },
			{ value: '02', label: 'w2', startDateIso: '2026-02-09' }
		];

		expect(pickRollingWeeksForCalendar([], '')).toEqual([]);
		expect(
			pickRollingWeeksForCalendar(weeks, '03', {
				windowSize: 2
			}).map((w) => w.value)
		).toEqual(['03', '04']);
		expect(
			pickRollingWeeksForCalendar(weeks, '', {
				windowSize: 0
			}).map((w) => w.value)
		).toEqual(['02']);
	});
});
