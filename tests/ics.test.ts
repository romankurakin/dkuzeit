import { describe, expect, it } from 'vitest';
import { buildIcsCalendar } from '../src/lib/server/ics';
import type { LessonEvent } from '../src/lib/server/types';

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

describe('ics generation', () => {
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

	it('uses DE prodId for German calendar', () => {
		const ics = buildIcsCalendar('DKU 3-TM (E3)', [event], 'de');
		expect(ics).toContain('PRODID:-//DKUZeit//DKU Timetable//DE');
	});
});
