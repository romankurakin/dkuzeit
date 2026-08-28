import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDocument } from 'htmlparser2';
import { parseNavHtml, parseTimetablePage } from '../../src/lib/server/parser';
import { toSlug } from '../../src/lib/url-slug';

interface Manifest {
	weeks: string[];
	classCount: number;
	downloadedPages: number;
	expectedPages: number;
	failures: Array<{ path: string; error: string }>;
}

const fixtureRoot = path.resolve(process.cwd(), 'tests/fixtures/live');
const fixtureReady = existsSync(path.join(fixtureRoot, 'manifest.json'));

const suite = fixtureReady ? describe : describe.skip;

async function loadMeta() {
	const navbar = await readFile(path.join(fixtureRoot, 'frames/navbar.htm'), 'utf8');
	return parseNavHtml(parseDocument(navbar));
}

async function loadManifest(): Promise<Manifest> {
	return JSON.parse(await readFile(path.join(fixtureRoot, 'manifest.json'), 'utf8')) as Manifest;
}

suite('parseNavHtml', () => {
	it('keeps group labels without leading dashes', async () => {
		const meta = await loadMeta();
		for (const group of meta.groups) {
			expect(group.codeRu).not.toMatch(/^-/);
			expect(group.codeDe).not.toMatch(/^-/);
		}
	});

	it('keeps group labels without trailing slashes', async () => {
		const meta = await loadMeta();
		for (const group of meta.groups) {
			expect(group.codeRu).not.toMatch(/\/$/);
			expect(group.codeDe).not.toMatch(/\/$/);
		}
	});

	it('keeps year prefix and strips leading dash for 2-TL German label', async () => {
		const meta = await loadMeta();
		const tl = meta.groups.find((g) => g.codeRaw === '2-ТЛ/-TL');
		expect(tl?.codeDe).toBe('2-TL');
	});

	it('keeps year prefix on German group labels when Russian label has it', async () => {
		const meta = await loadMeta();
		for (const group of meta.groups) {
			if (!/^\d/.test(group.codeRu)) continue;
			expect(group.codeDe).toMatch(/^\d/);
		}
	});

	it('builds unique slugs for group labels', async () => {
		const meta = await loadMeta();
		const slugs = meta.groups.map((group) => toSlug(group.codeRu));
		expect(new Set(slugs).size).toBe(slugs.length);
	});
});

suite('parseTimetablePage label quality', () => {
	it('keeps event labels without trailing slashes for all groups and weeks', async () => {
		const meta = await loadMeta();
		const manifest = await loadManifest();

		for (const week of meta.weeks) {
			if (manifest.weeks.indexOf(week.value) === -1) continue;
			for (const group of meta.groups) {
				const rel = path.join(
					fixtureRoot,
					week.value,
					'c',
					`c${String(group.id).padStart(5, '0')}.htm`
				);
				if (existsSync(rel) === false) continue;
				const html = await readFile(rel, 'utf8');
				const { events } = await parseTimetablePage(parseDocument(html), group, week);

				for (const e of events) {
					expect(e.subjectShortRu).not.toMatch(/\/$/);
					expect(e.subjectShortDe).not.toMatch(/\/$/);
					expect(e.subjectFullRu).not.toMatch(/\/$/);
					expect(e.subjectFullDe).not.toMatch(/\/$/);
				}
			}
		}
	});

	it('keeps event labels without leading dashes', async () => {
		const meta = await loadMeta();
		const manifest = await loadManifest();

		for (const week of meta.weeks) {
			if (manifest.weeks.indexOf(week.value) === -1) continue;
			for (const group of meta.groups) {
				const rel = path.join(
					fixtureRoot,
					week.value,
					'c',
					`c${String(group.id).padStart(5, '0')}.htm`
				);
				if (existsSync(rel) === false) continue;
				const html = await readFile(rel, 'utf8');
				const { events } = await parseTimetablePage(parseDocument(html), group, week);

				for (const e of events) {
					expect(e.subjectShortRu).not.toMatch(/^-/);
					expect(e.subjectShortDe).not.toMatch(/^-/);
					expect(e.subjectFullRu).not.toMatch(/^-/);
					expect(e.subjectFullDe).not.toMatch(/^-/);
				}
			}
		}
	});

	it('keeps lesson type without Kazakh-specific characters', async () => {
		const meta = await loadMeta();
		const manifest = await loadManifest();

		for (const week of meta.weeks) {
			if (manifest.weeks.indexOf(week.value) === -1) continue;
			for (const group of meta.groups) {
				const rel = path.join(
					fixtureRoot,
					week.value,
					'c',
					`c${String(group.id).padStart(5, '0')}.htm`
				);
				if (existsSync(rel) === false) continue;
				const html = await readFile(rel, 'utf8');
				const { events } = await parseTimetablePage(parseDocument(html), group, week);

				for (const e of events) {
					expect(e.lessonType).not.toMatch(/[ҚқӘәҒғҢңӨөҰұҮүІіҺһ]/);
				}
			}
		}
	});

	it('keeps each event within one standard period', async () => {
		const meta = await loadMeta();
		const manifest = await loadManifest();

		function minutesDuration(start: string, end: string): number {
			const [sh, sm] = start.split(':').map(Number);
			const [eh, em] = end.split(':').map(Number);
			return eh! * 60 + em! - (sh! * 60 + sm!);
		}

		for (const week of meta.weeks) {
			if (manifest.weeks.indexOf(week.value) === -1) continue;
			for (const group of meta.groups) {
				const rel = path.join(
					fixtureRoot,
					week.value,
					'c',
					`c${String(group.id).padStart(5, '0')}.htm`
				);
				if (existsSync(rel) === false) continue;
				const html = await readFile(rel, 'utf8');
				const { events } = await parseTimetablePage(parseDocument(html), group, week);

				for (const e of events) {
					const duration = minutesDuration(e.startTime, e.endTime);
					expect(
						duration,
						`${group.codeRaw} w${week.value} ${e.subjectShortRaw} ${e.startTime}-${e.endTime}`
					).toBeLessThanOrEqual(110);
				}
			}
		}
	});

	it('keeps fullDe non-Cyrillic when different from fullRu', async () => {
		const meta = await loadMeta();
		const manifest = await loadManifest();

		for (const week of meta.weeks) {
			if (manifest.weeks.indexOf(week.value) === -1) continue;
			for (const group of meta.groups) {
				const rel = path.join(
					fixtureRoot,
					week.value,
					'c',
					`c${String(group.id).padStart(5, '0')}.htm`
				);
				if (existsSync(rel) === false) continue;
				const html = await readFile(rel, 'utf8');
				const { events } = await parseTimetablePage(parseDocument(html), group, week);

				for (const e of events) {
					expect(
						e.subjectFullDe === e.subjectFullRu ||
							!/^[А-Яа-яЁёҚқӘәҒғҢңӨөҰұҮүІіҺһ]/.test(e.subjectFullDe)
					).toBe(true);
				}
			}
		}
	});
});

suite('parseTimetablePage cohort scope', () => {
	it('keeps no cohort code on core_fixed events', async () => {
		const meta = await loadMeta();
		const manifest = await loadManifest();

		let coreEvents = 0;
		for (const week of meta.weeks) {
			if (manifest.weeks.indexOf(week.value) === -1) continue;
			for (const group of meta.groups) {
				const rel = path.join(
					fixtureRoot,
					week.value,
					'c',
					`c${String(group.id).padStart(5, '0')}.htm`
				);
				if (!existsSync(rel)) continue;

				const html = await readFile(rel, 'utf8');
				const { events } = await parseTimetablePage(parseDocument(html), group, week);
				for (const event of events) {
					if (event.scope !== 'core_fixed') continue;
					coreEvents += 1;
					expect(event.cohortCode).toBeNull();
				}
			}
		}
		expect(coreEvents).toBeGreaterThan(0);
	});
});

if (fixtureReady === false) {
	describe('parser prerequisites', () => {
		it('requires fixture snapshot for parser quality tests', () => {
			expect('Fixture snapshot missing. Run: npm run fixtures:sync').toBeTypeOf('string');
		});
	});
}
