import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fnv1aHex } from '../../src/lib/server/hash';
import { parseNavHtml, parseTimetablePage } from '../../src/lib/server/parser';

interface Manifest {
	weeks: string[];
}

const fixtureRoot = path.resolve(process.cwd(), 'tests/fixtures/live');
const manifestPath = path.join(fixtureRoot, 'manifest.json');
const fixtureReady = existsSync(manifestPath);

const suite = fixtureReady ? describe : describe.skip;

suite('parser conformance fixtures', () => {
	it('match known fixture signature and totals', async () => {
		const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
		const navbarHtml = readFileSync(path.join(fixtureRoot, 'frames/navbar.htm'), 'utf8');
		const meta = parseNavHtml(navbarHtml);

		const lines: string[] = [];
		let parsedPages = 0;
		let totalEvents = 0;
		let totalCohorts = 0;
		const parseFailures: string[] = [];

		for (const week of meta.weeks) {
			if (!manifest.weeks.includes(week.value)) continue;
			for (const group of meta.groups) {
				const rel = path.join(week.value, 'c', `c${String(group.id).padStart(5, '0')}.htm`);
				const filePath = path.join(fixtureRoot, rel);
				if (!existsSync(filePath)) continue;

				try {
					const html = readFileSync(filePath, 'utf8');
					const parsed = await parseTimetablePage(html, group, week);

					parsedPages += 1;
					totalEvents += parsed.events.length;
					totalCohorts += parsed.cohorts.length;

					lines.push(`P|${rel}|${parsed.events.length}|${parsed.cohorts.length}`);
					for (const event of parsed.events) {
						lines.push(
							`E|${rel}|${event.id}|${event.dateIso}|${event.startTime}|${event.endTime}|${event.subjectShortRaw}|${event.subjectFullRaw}|${event.room}|${event.track}|${event.cohortCode ?? ''}|${event.scope}`
						);
					}
					for (const cohort of parsed.cohorts) {
						lines.push(
							`C|${rel}|${cohort.code}|${cohort.track}|${cohort.label}|${cohort.sourceGroups.join(',')}`
						);
					}
				} catch (error) {
					parseFailures.push(`${rel}: ${String(error)}`);
				}
			}
		}

		lines.sort();
		const digest = fnv1aHex(lines.join('\n'));

		expect(parseFailures).toEqual([]);
		expect(parsedPages).toBe(780);
		expect(totalEvents).toBe(22452);
		expect(totalCohorts).toBe(8137);
		expect(digest).toBe('991d46b8');
	});
});

if (!fixtureReady) {
	describe('parser prerequisites', () => {
		it('require fixture snapshot for parser conformance', () => {
			expect(`Fixture snapshot missing at ${manifestPath}. Run: npm run fixtures:sync`).toBeTypeOf(
				'string'
			);
		});
	});
}
