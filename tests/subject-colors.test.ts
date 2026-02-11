import { describe, expect, it } from 'vitest';
import { buildSubjectColorMap, subjectColorKey, cv } from '../src/lib/scheduler/subject-colors';
import type { LessonEvent } from '../src/lib/server/types';

function fakeEvent(overrides: Partial<LessonEvent>): LessonEvent {
	return {
		id: 'e1',
		dateIso: '2026-02-09',
		dayIndex: 1,
		startTime: '08:00',
		endTime: '09:40',
		subjectShortRaw: '',
		subjectShortRu: '',
		subjectShortDe: '',
		subjectFullRaw: '',
		subjectFullRu: '',
		subjectFullDe: '',
		lessonType: '',
		room: '',
		groupCode: '1-CS',
		originGroupCode: '1-CS',
		track: 'none',
		cohortCode: null,
		scope: 'core_fixed',
		...overrides
	};
}

describe('subjectColorKey', () => {
	it('prefers subjectFullRu', () => {
		expect(subjectColorKey(fakeEvent({ subjectFullRu: 'Математика', subjectShortRu: 'Мат' }))).toBe(
			'Математика'
		);
	});

	it('falls back to subjectShortRu', () => {
		expect(subjectColorKey(fakeEvent({ subjectFullRu: '', subjectShortRu: 'Мат' }))).toBe('Мат');
	});
});

describe('buildSubjectColorMap', () => {
	it('is deterministic — same input always produces same mapping', () => {
		const events = [
			fakeEvent({ id: '1', subjectFullRu: 'Математика' }),
			fakeEvent({ id: '2', subjectFullRu: 'Физика' }),
			fakeEvent({ id: '3', subjectFullRu: 'Социология' })
		];
		const map1 = buildSubjectColorMap(events);
		const map2 = buildSubjectColorMap(events);
		expect([...map1.entries()]).toEqual([...map2.entries()]);
	});

	it('assigns unique colors when fewer subjects than palette size', () => {
		const events = [
			fakeEvent({ id: '1', subjectFullRu: 'А' }),
			fakeEvent({ id: '2', subjectFullRu: 'Б' }),
			fakeEvent({ id: '3', subjectFullRu: 'В' })
		];
		const map = buildSubjectColorMap(events);
		const colors = [...map.values()];
		expect(new Set(colors).size).toBe(3);
	});

	it('deduplicates events with the same subject', () => {
		const events = [
			fakeEvent({ id: '1', subjectFullRu: 'Математика' }),
			fakeEvent({ id: '2', subjectFullRu: 'Математика' })
		];
		const map = buildSubjectColorMap(events);
		expect(map.size).toBe(1);
	});

	it('skips events with empty color key', () => {
		const events = [fakeEvent({ subjectFullRu: '', subjectShortRu: '' })];
		const map = buildSubjectColorMap(events);
		expect(map.size).toBe(0);
	});
});

describe('cv', () => {
	it('returns a CSS variable reference', () => {
		expect(cv('blue', 400)).toBe('var(--color-blue-400)');
		expect(cv('pink', 950)).toBe('var(--color-pink-950)');
	});
});
