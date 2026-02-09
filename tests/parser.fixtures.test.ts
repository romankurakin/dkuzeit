import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseNavHtml, parseTimetablePage } from '../src/lib/server/parser';

interface Manifest {
	weeks: string[];
	classCount: number;
	downloadedPages: number;
	expectedPages: number;
	failures: Array<{ path: string; error: string }>;
}

const fixtureRoot = path.resolve(process.cwd(), 'tests/fixtures/live');
const manifestPath = path.join(fixtureRoot, 'manifest.json');
const fixtureReady = existsSync(manifestPath);

const suite = fixtureReady ? describe : describe.skip;

suite('DKU parser (fixtures)', () => {
	it('parses navbar fixture and validates shape', async () => {
		const navbarHtml = await readFile(path.join(fixtureRoot, 'frames/navbar.htm'), 'utf8');
		const meta = parseNavHtml(navbarHtml);

		expect(meta.weeks.length).toBeGreaterThan(0);
		expect(meta.groups.length).toBeGreaterThan(10);
		expect(meta.groups[0]?.id).toBe(1);
	});

	it('parses all downloaded class-week pages with zero hard failures', async () => {
		const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest;
		const navbarHtml = await readFile(path.join(fixtureRoot, 'frames/navbar.htm'), 'utf8');
		const meta = parseNavHtml(navbarHtml);

		expect(meta.groups.length).toBe(manifest.classCount);
		expect(manifest.downloadedPages).toBeGreaterThan(0);
		expect(manifest.downloadedPages).toBe(manifest.expectedPages - manifest.failures.length);

		let parsedPages = 0;
		let totalEvents = 0;
		let kzTracks = 0;
		let deTracks = 0;
		let enTracks = 0;
		const parseFailures: string[] = [];

		for (const week of meta.weeks) {
			if (!manifest.weeks.includes(week.value)) continue;
			for (const group of meta.groups) {
				const rel = path.join(week.value, 'c', `c${String(group.id).padStart(5, '0')}.htm`);
				const filePath = path.join(fixtureRoot, rel);
				if (!existsSync(filePath)) continue;

				try {
					const html = await readFile(filePath, 'utf8');
					const parsed = parseTimetablePage(html, group, week);
					parsedPages += 1;
					totalEvents += parsed.events.length;
					kzTracks += parsed.events.filter((event) => event.track === 'kz').length;
					deTracks += parsed.events.filter((event) => event.track === 'de').length;
					enTracks += parsed.events.filter((event) => event.track === 'en').length;

					for (const event of parsed.events) {
						expect(event.dateIso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
						expect(event.startTime).toMatch(/^\d{1,2}:\d{2}$/);
						expect(event.endTime).toMatch(/^\d{1,2}:\d{2}$/);
						expect(event.groupCode.length).toBeGreaterThan(0);
						expect(event.scope === 'core_fixed' || event.scope === 'cohort_shared').toBe(true);
					}
				} catch (error) {
					parseFailures.push(`${rel}: ${String(error)}`);
				}
			}
		}

		expect(parseFailures).toEqual([]);
		expect(parsedPages).toBeGreaterThan(50);
		expect(totalEvents).toBeGreaterThan(500);
		expect(deTracks).toBeGreaterThan(0);
		expect(enTracks).toBeGreaterThan(0);
		expect(kzTracks).toBeGreaterThan(0);
	});
});

if (!fixtureReady) {
	describe('DKU parser fixture prerequisites', () => {
		it('requires fixture snapshot', () => {
			expect(`Fixture snapshot missing at ${manifestPath}. Run: npm run fixtures:sync`).toBeTypeOf(
				'string'
			);
		});
	});
}
