import { describe, expect, it } from 'vitest';
import { parseCohortsCsv, normalizeCohortList } from '../../src/lib/server/cohorts';

describe('cohorts parse cohorts csv', () => {
	it('split comma separated codes', () => {
		expect(parseCohortsCsv('D1, E2, K3')).toEqual(['D1', 'E2', 'K3']);
	});

	it('strip html and whitespace from values', () => {
		expect(parseCohortsCsv('<b>D1</b>,  E2 ')).toEqual(['D1', 'E2']);
	});

	it('handle null undefined empty', () => {
		expect(parseCohortsCsv(null)).toEqual([]);
		expect(parseCohortsCsv(undefined)).toEqual([]);
		expect(parseCohortsCsv('')).toEqual([]);
	});

	it('filter out blank entries from trailing commas', () => {
		expect(parseCohortsCsv('D1,,,')).toEqual(['D1']);
	});
});

describe('cohorts normalize cohort list', () => {
	it('normalize array of strings', () => {
		expect(normalizeCohortList(['D1', ' E2 '])).toEqual(['D1', 'E2']);
	});

	it('return empty for non array input', () => {
		expect(normalizeCohortList('D1')).toEqual([]);
		expect(normalizeCohortList(null)).toEqual([]);
		expect(normalizeCohortList(42)).toEqual([]);
	});

	it('coerce non string items and filter blanks', () => {
		expect(normalizeCohortList([123, '', null])).toEqual(['123', 'null']);
	});
});
