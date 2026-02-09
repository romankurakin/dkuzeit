import {
	generateIcsCalendar,
	type IcsCalendar,
	type IcsEvent,
	type IcsDateObject,
	type IcsTimezone
} from 'ts-ics';
import type { LessonEvent, UiLanguage } from './types';

const ALMATY_TZ: IcsTimezone = {
	id: 'Asia/Almaty',
	props: [
		{
			type: 'STANDARD',
			start: new Date('1970-01-01T00:00:00'),
			offsetTo: '+0500',
			offsetFrom: '+0500',
			name: '+05'
		}
	]
};

function toDateObject(dateIso: string, hhmm: string): IcsDateObject {
	const [year, month, day] = dateIso.split('-').map(Number) as [number, number, number];
	const [hours, minutes] = hhmm.split(':').map(Number) as [number, number];
	// ts-ics uses getUTC* on date, so encode local Almaty time in UTC slots
	const date = new Date(Date.UTC(year, month - 1, day, hours, minutes));
	return {
		date,
		local: { date, timezone: 'Asia/Almaty', tzoffset: '+0500' }
	};
}

function stableHash(input: string): string {
	let hash = 2166136261;
	for (let i = 0; i < input.length; i += 1) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(16);
}

function buildUid(event: LessonEvent): string {
	// Room is excluded so that room changes don't create a new calendar event
	const base = `${event.dateIso}|${event.startTime}|${event.endTime}|${event.groupCode}|${event.subjectShortRaw}|${event.cohortCode ?? ''}`;
	return `${stableHash(base)}@dku-timetable`;
}

export function buildIcsCalendar(
	title: string,
	events: LessonEvent[],
	lang: UiLanguage = 'ru'
): string {
	const now = new Date();
	const stamp: IcsDateObject = { date: now };

	const icsEvents: IcsEvent[] = events.map((event) => {
		const summary =
			lang === 'de'
				? event.subjectFullDe ||
					event.subjectShortDe ||
					event.subjectFullRu ||
					event.subjectShortRu ||
					event.subjectShortRaw
				: event.subjectFullRu ||
					event.subjectShortRu ||
					event.subjectFullDe ||
					event.subjectShortDe ||
					event.subjectShortRaw;

		return {
			summary,
			uid: buildUid(event),
			stamp,
			start: toDateObject(event.dateIso, event.startTime),
			end: toDateObject(event.dateIso, event.endTime),
			location: event.room || undefined,
			sequence: 0
		};
	});

	const calendar: IcsCalendar = {
		version: '2.0',
		prodId: '-//DKU Timetable//EN',
		method: 'PUBLISH',
		name: title,
		timezones: [ALMATY_TZ],
		events: icsEvents
	};

	return generateIcsCalendar(calendar);
}
