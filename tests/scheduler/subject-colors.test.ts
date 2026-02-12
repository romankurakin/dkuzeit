import { describe, expect, it } from 'vitest';
import { buildSubjectColorMap, subjectColorKey, cv } from '../../src/lib/scheduler/subject-colors';
import type { LessonEvent } from '../../src/lib/server/types';

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

describe('subject colors subject color key', () => {
	it('prefer subject full ru', () => {
		expect(subjectColorKey(fakeEvent({ subjectFullRu: 'Математика', subjectShortRu: 'Мат' }))).toBe(
			'Математика'
		);
	});

	it('fall back to subject short ru', () => {
		expect(subjectColorKey(fakeEvent({ subjectFullRu: '', subjectShortRu: 'Мат' }))).toBe('Мат');
	});
});

describe('subject colors build subject color map', () => {
	it('keep deterministic mapping for same input', () => {
		const events = [
			fakeEvent({ id: '1', subjectFullRu: 'Математика' }),
			fakeEvent({ id: '2', subjectFullRu: 'Физика' }),
			fakeEvent({ id: '3', subjectFullRu: 'Социология' })
		];
		const map1 = buildSubjectColorMap(events);
		const map2 = buildSubjectColorMap(events);
		expect([...map1.entries()]).toEqual([...map2.entries()]);
	});

	it('assign unique colors when fewer subjects than palette size', () => {
		const events = [
			fakeEvent({ id: '1', subjectFullRu: 'А' }),
			fakeEvent({ id: '2', subjectFullRu: 'Б' }),
			fakeEvent({ id: '3', subjectFullRu: 'В' })
		];
		const map = buildSubjectColorMap(events);
		const colors = [...map.values()];
		expect(new Set(colors).size).toBe(3);
	});

	it('deduplicate events with the same subject', () => {
		const events = [
			fakeEvent({ id: '1', subjectFullRu: 'Математика' }),
			fakeEvent({ id: '2', subjectFullRu: 'Математика' })
		];
		const map = buildSubjectColorMap(events);
		expect(map.size).toBe(1);
	});

	it('skip events with empty color key', () => {
		const events = [fakeEvent({ subjectFullRu: '', subjectShortRu: '' })];
		const map = buildSubjectColorMap(events);
		expect(map.size).toBe(0);
	});
});

describe('subject colors cv', () => {
	it('return a css variable reference', () => {
		expect(cv({ name: 'blue', shade: 300 })).toBe('var(--color-blue-300)');
		expect(cv({ name: 'pink', shade: 300 })).toBe('var(--color-pink-300)');
	});
});
