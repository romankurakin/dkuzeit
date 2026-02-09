import { afterEach, describe, expect, it } from 'vitest';
import { formatDateLabel } from '../src/lib/scheduler/date-format';

const originalTz = process.env.TZ;

describe('formatDateLabel', () => {
	afterEach(() => {
		if (originalTz === undefined) {
			delete process.env.TZ;
		} else {
			process.env.TZ = originalTz;
		}
	});

	it('formats dates in Almaty timezone even when runtime TZ is UTC', () => {
		process.env.TZ = 'UTC';
		const label = formatDateLabel('2026-02-10', 'ru').toLowerCase();
		expect(label).toContain('10');
		expect(label).toContain('втор');
	});
});
