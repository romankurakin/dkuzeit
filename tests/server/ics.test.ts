import { describe, expect, it } from 'vitest';
import { buildIcsCalendar } from '../../src/lib/server/ics';
import type { LessonEvent } from '../../src/lib/server/types';

const event: LessonEvent = {
	id: 'e-test',
	dateIso: '2026-02-09',
	dayIndex: 1,
	startTime: '12:20',
	endTime: '14:00',
	subjectShortRaw: 'ENG',
	subjectShortRu: 'Английский',
	subjectShortDe: 'Englisch',
	subjectFullRaw: 'Academic Writing',
	subjectFullRu: 'Академическое письмо',
	subjectFullDe: 'Akademisches Schreiben',
	lessonType: 'пр.',
	room: '305',
	groupCode: '3-ТМ',
	originGroupCode: '3-ТМ',
	track: 'en',
	cohortCode: 'E3',
	scope: 'cohort_shared'
};

describe('buildIcsCalendar', () => {
	it('builds valid calendar envelope and event fields', () => {
		const ics = buildIcsCalendar('DKU 3-ТМ (E3)', [event]);

		expect(ics).toContain('BEGIN:VCALENDAR');
		expect(ics).toContain('END:VCALENDAR');
		expect(ics).toContain('PRODID:-//DKUZeit//DKU Timetable//RU');
		expect(ics).toContain('BEGIN:VTIMEZONE');
		expect(ics).toContain('Asia/Almaty');
		expect(ics).toContain('BEGIN:VEVENT');
		expect(ics).toContain('DTSTART;TZID=Asia/Almaty:20260209T122000');
		expect(ics).toContain('DTEND;TZID=Asia/Almaty:20260209T140000');
		expect(ics).toContain('LOCATION:305');
		expect(ics).not.toContain('DESCRIPTION');
	});

	it('uses de prod id for german calendar', () => {
		const ics = buildIcsCalendar('DKU 3-TM (E3)', [event], 'de');
		expect(ics).toContain('PRODID:-//DKUZeit//DKU Timetable//DE');
	});

	it('uses subjectFullDe as summary for de locale', () => {
		const ics = buildIcsCalendar('DKU', [event], 'de');
		expect(ics).toContain('Akademisches Schreiben');
	});

	it('falls back through de summary chain when fields are empty', () => {
		const sparse = {
			...event,
			subjectFullDe: '',
			subjectShortDe: '',
			subjectFullRu: '',
			subjectShortRu: ''
		};
		const ics = buildIcsCalendar('DKU', [sparse], 'de');
		expect(ics).toContain('ENG');
	});

	it('falls back to shortDe when fullDe is empty for de locale', () => {
		const sparse = { ...event, subjectFullDe: '' };
		const ics = buildIcsCalendar('DKU', [sparse], 'de');
		expect(ics).toContain('Englisch');
	});

	it('falls back to fullRu when both de fields are empty for de locale', () => {
		const sparse = { ...event, subjectFullDe: '', subjectShortDe: '' };
		const ics = buildIcsCalendar('DKU', [sparse], 'de');
		expect(ics).toContain('Академическое письмо');
	});

	it('falls back through ru summary chain when fields are empty', () => {
		const sparse = {
			...event,
			subjectFullRu: '',
			subjectShortRu: '',
			subjectFullDe: '',
			subjectShortDe: ''
		};
		const ics = buildIcsCalendar('DKU', [sparse]);
		expect(ics).toContain('ENG');
	});

	it('falls back to shortRu when fullRu is empty for ru locale', () => {
		const sparse = { ...event, subjectFullRu: '' };
		const ics = buildIcsCalendar('DKU', [sparse]);
		expect(ics).toContain('Английский');
	});

	it('falls back to fullDe when both ru fields are empty for ru locale', () => {
		const sparse = { ...event, subjectFullRu: '', subjectShortRu: '' };
		const ics = buildIcsCalendar('DKU', [sparse]);
		expect(ics).toContain('Akademisches Schreiben');
	});

	it('omits LOCATION when room is empty', () => {
		const noRoom = { ...event, room: '' };
		const ics = buildIcsCalendar('DKU', [noRoom]);
		expect(ics).not.toContain('LOCATION');
	});

	it('includes X-PUBLISHED-TTL header', () => {
		const ics = buildIcsCalendar('DKU', [event]);
		expect(ics).toContain('X-PUBLISHED-TTL:PT1D');
	});
});
