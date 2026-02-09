import { describe, expect, it } from 'vitest';
import { parseCohortsCsv, normalizeCohortList } from '../src/lib/server/cohorts';

describe('parseCohortsCsv', () => {
	it('splits comma-separated codes', () => {
		expect(parseCohortsCsv('D1, E2, K3')).toEqual(['D1', 'E2', 'K3']);
	});

	it('strips HTML and whitespace from values', () => {
		expect(parseCohortsCsv('<b>D1</b>,  E2 ')).toEqual(['D1', 'E2']);
	});

	it('handles null/undefined/empty', () => {
		expect(parseCohortsCsv(null)).toEqual([]);
		expect(parseCohortsCsv(undefined)).toEqual([]);
		expect(parseCohortsCsv('')).toEqual([]);
	});

	it('filters out blank entries from trailing commas', () => {
		expect(parseCohortsCsv('D1,,,')).toEqual(['D1']);
	});
});

describe('normalizeCohortList', () => {
	it('normalizes array of strings', () => {
		expect(normalizeCohortList(['D1', ' E2 '])).toEqual(['D1', 'E2']);
	});

	it('returns empty for non-array input', () => {
		expect(normalizeCohortList('D1')).toEqual([]);
		expect(normalizeCohortList(null)).toEqual([]);
		expect(normalizeCohortList(42)).toEqual([]);
	});

	it('coerces non-string items and filters blanks', () => {
		expect(normalizeCohortList([123, '', null])).toEqual(['123', 'null']);
	});
});
