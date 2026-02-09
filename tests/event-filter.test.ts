import { describe, expect, it } from 'vitest';
import {
	filterDisplayEvents,
	extractTimeSlots,
	eventTitleLabel,
	buildCohortGroups
} from '../src/lib/scheduler/event-filter';
import type { Cohort, LessonEvent } from '../src/lib/server/types';

function makeEvent(overrides: Partial<LessonEvent> = {}): LessonEvent {
	return {
		id: 'e1',
		dateIso: '2025-01-06',
		dayIndex: 0,
		startTime: '09:00',
		endTime: '10:30',
		subjectShortRaw: 'МАТ1',
		subjectShortRu: 'Математика 1',
		subjectShortDe: 'Mathematik 1',
		subjectFullRaw: 'Математика 1/Mathematik 1 лекция',
		subjectFullRu: 'Математика 1',
		subjectFullDe: 'Mathematik 1',
		lessonType: 'лекция',
		room: '101',
		groupCode: 'GRP1',
		originGroupCode: 'GRP1',
		track: 'none',
		cohortCode: null,
		scope: 'core_fixed',
		...overrides
	};
}

const categoryLabels: Record<string, string> = {
	de: 'German',
	en: 'English',
	kz: 'Kazakh',
	pe: 'PE'
};

describe('filterDisplayEvents', () => {
	it('always passes core_fixed events', () => {
		const events = [makeEvent({ scope: 'core_fixed' })];
		const result = filterDisplayEvents(events, [], [], categoryLabels);
		expect(result).toHaveLength(1);
	});

	it('filters by cohort selection', () => {
		const cohorts: Cohort[] = [
			{ code: 'DE1', track: 'de', label: 'German 1', sourceGroups: ['GRP1'] },
			{ code: 'DE2', track: 'de', label: 'German 2', sourceGroups: ['GRP1'] }
		];
		const events = [
			makeEvent({ id: 'e1', cohortCode: 'DE1', scope: 'cohort_shared', track: 'de' }),
			makeEvent({ id: 'e2', cohortCode: 'DE2', scope: 'cohort_shared', track: 'de' })
		];
		const result = filterDisplayEvents(events, cohorts, ['DE1'], categoryLabels);
		expect(result.filter((e) => !e.id.endsWith('_merged'))).toHaveLength(1);
		expect(result.find((e) => e.id === 'e1')).toBeDefined();
	});

	it('collapses unselected categories into merged events', () => {
		const cohorts: Cohort[] = [
			{ code: 'EN1', track: 'en', label: 'English 1', sourceGroups: ['GRP1'] },
			{ code: 'EN2', track: 'en', label: 'English 2', sourceGroups: ['GRP1'] }
		];
		const events = [
			makeEvent({ id: 'e1', cohortCode: 'EN1', scope: 'cohort_shared', track: 'en' }),
			makeEvent({ id: 'e2', cohortCode: 'EN2', scope: 'cohort_shared', track: 'en' })
		];
		const result = filterDisplayEvents(events, cohorts, [], categoryLabels);
		const merged = result.filter((e) => e.id.endsWith('_merged'));
		expect(merged).toHaveLength(1);
		expect(merged[0]!.subjectFullRu).toBe('English');
	});

	it('returns all events when urlCohorts is empty (core + merged)', () => {
		const cohorts: Cohort[] = [
			{ code: 'DE1', track: 'de', label: 'German 1', sourceGroups: ['GRP1'] }
		];
		const events = [
			makeEvent({ id: 'e1', scope: 'core_fixed' }),
			makeEvent({ id: 'e2', cohortCode: 'DE1', scope: 'cohort_shared', track: 'de' })
		];
		const result = filterDisplayEvents(events, cohorts, [], categoryLabels);
		expect(result).toHaveLength(2);
	});
});

describe('extractTimeSlots', () => {
	it('deduplicates and sorts time slots', () => {
		const events = [
			makeEvent({ startTime: '11:00', endTime: '12:30' }),
			makeEvent({ startTime: '09:00', endTime: '10:30' }),
			makeEvent({ startTime: '11:00', endTime: '12:30' })
		];
		const slots = extractTimeSlots(events);
		expect(slots).toHaveLength(2);
		expect(slots[0]!.start).toBe('09:00');
		expect(slots[1]!.start).toBe('11:00');
	});
});

describe('eventTitleLabel', () => {
	it('prefers subjectFullRu for ru locale', () => {
		const event = makeEvent({ subjectFullRu: 'Математика', subjectFullDe: 'Mathematik' });
		expect(eventTitleLabel(event, 'ru')).toBe('Математика');
	});

	it('prefers subjectFullDe for de locale', () => {
		const event = makeEvent({ subjectFullRu: 'Математика', subjectFullDe: 'Mathematik' });
		expect(eventTitleLabel(event, 'de')).toBe('Mathematik');
	});

	it('appends cohortCode when present', () => {
		const event = makeEvent({ subjectFullRu: 'Немецкий', cohortCode: 'DE1' });
		expect(eventTitleLabel(event, 'ru')).toBe('Немецкий DE1');
	});
});

describe('buildCohortGroups', () => {
	it('groups cohorts by track', () => {
		const cohorts: Cohort[] = [
			{ code: 'DE1', track: 'de', label: 'German 1', sourceGroups: ['GRP1'] },
			{ code: 'DE2', track: 'de', label: 'German 2', sourceGroups: ['GRP1'] },
			{ code: 'EN1', track: 'en', label: 'English 1', sourceGroups: ['GRP1'] }
		];
		const groups = buildCohortGroups(cohorts, categoryLabels, []);
		expect(groups).toHaveLength(2);
		const deGroup = groups.find((g) => g.label === 'German');
		expect(deGroup?.items).toHaveLength(2);
	});

	it('tracks selected value', () => {
		const cohorts: Cohort[] = [
			{ code: 'DE1', track: 'de', label: 'German 1', sourceGroups: ['GRP1'] },
			{ code: 'DE2', track: 'de', label: 'German 2', sourceGroups: ['GRP1'] }
		];
		const groups = buildCohortGroups(cohorts, categoryLabels, ['DE2']);
		expect(groups[0]!.value).toBe('DE2');
	});
});
