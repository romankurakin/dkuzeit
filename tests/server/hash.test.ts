import { describe, expect, it } from 'vitest';
import { fnv1aHex } from '../../src/lib/server/hash';

describe('hash fnv1a hex', () => {
	it('produce stable hex output for known inputs', () => {
		expect(fnv1aHex('hello')).toBe('4f9f2cab');
		expect(fnv1aHex('')).toBe('811c9dc5');
	});

	it('produce different hashes for different inputs', () => {
		expect(fnv1aHex('Математика')).not.toBe(fnv1aHex('Физика'));
	});

	it('handle cyrillic and mixed scripts', () => {
		const hash = fnv1aHex('2026-02-09|08:00|09:40|1-CS|Мат/Math|D1');
		expect(hash).toMatch(/^[0-9a-f]+$/);
	});
});
