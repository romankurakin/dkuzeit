import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	groupSlug,
	resolveGroup,
	resolveWeek,
	resolveWeekByDate
} from '../../src/lib/server/resolve';
import type { GroupOption, WeekOption } from '../../src/lib/server/types';

const groups: GroupOption[] = [
	{ id: 1, codeRaw: '1-CS', codeRu: '1-КС', codeDe: '1-KS' },
	{ id: 2, codeRaw: '2-IS', codeRu: '2-ИС', codeDe: '2-IS' }
];

const weeks: WeekOption[] = [
	{ value: '01', label: 'w1', startDateIso: '2026-02-02' },
	{ value: '02', label: 'w2', startDateIso: '2026-02-09' },
	{ value: '03', label: 'w3', startDateIso: '2026-02-16' }
];

describe('resolve helpers', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('resolve group by different forms and reject unknown values', () => {
		expect(resolveGroup(groups, '')).toBe('1-CS');
		expect(resolveGroup(groups, '2-ИС')).toBe('2-IS');
		expect(resolveGroup(groups, '2-IS')).toBe('2-IS');
		expect(resolveGroup(groups, 'unknown')).toBe('');
	});

	it('resolve week by explicit value or by date', () => {
		vi.setSystemTime(new Date('2026-02-10T10:00:00Z'));
		expect(resolveWeek(weeks, '03')).toBe('03');
		expect(resolveWeek(weeks, '')).toBe('02');
		expect(resolveWeek(weeks, '99')).toBe('02');
	});

	it('advance to next day when current almaty day is sunday', () => {
		// Sunday in Almaty; helper should evaluate using Monday date.
		vi.setSystemTime(new Date('2026-02-15T12:00:00Z'));
		expect(resolveWeekByDate(weeks)).toBe('03');
	});

	it('build group slug from localized label', () => {
		expect(groupSlug(groups, '1-CS')).toBe('1-ks');
		expect(groupSlug(groups, 'UNKNOWN')).toBe('unknown');
	});
});
