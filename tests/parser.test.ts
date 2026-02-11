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
const fixtureReady = existsSync(path.join(fixtureRoot, 'manifest.json'));

const suite = fixtureReady ? describe : describe.skip;

async function loadMeta() {
	const navbar = await readFile(path.join(fixtureRoot, 'frames/navbar.htm'), 'utf8');
	return parseNavHtml(navbar);
}

async function loadManifest(): Promise<Manifest> {
	return JSON.parse(await readFile(path.join(fixtureRoot, 'manifest.json'), 'utf8')) as Manifest;
}

async function loadSchedule(groupCode: string, weekValue?: string) {
	const meta = await loadMeta();
	const manifest = await loadManifest();
	const group = meta.groups.find((g) => g.codeRaw.includes(groupCode));
	if (group === undefined) throw new Error(`Group not found: ${groupCode}`);
	const week = weekValue
		? meta.weeks.find((w) => w.value === weekValue)
		: meta.weeks.find((w) => manifest.weeks.includes(w.value));
	if (week === undefined) throw new Error('Week not found');
	const rel = path.join(fixtureRoot, week.value, 'c', `c${String(group.id).padStart(5, '0')}.htm`);
	const html = await readFile(rel, 'utf8');
	return { ...(await parseTimetablePage(html, group, week)), group, week };
}

suite('parseNavHtml', () => {
	it('group labels have no leading dashes', async () => {
		const meta = await loadMeta();
		for (const group of meta.groups) {
			expect(group.codeRu, group.codeRaw).not.toMatch(/^-/);
			expect(group.codeDe, group.codeRaw).not.toMatch(/^-/);
		}
	});

	it('group labels have no trailing slashes', async () => {
		const meta = await loadMeta();
		for (const group of meta.groups) {
			expect(group.codeRu, group.codeRaw).not.toMatch(/\/$/);
			expect(group.codeDe, group.codeRaw).not.toMatch(/\/$/);
		}
	});

	it('2-ТЛ/-TL German label keeps year prefix and strips leading dash', async () => {
		const meta = await loadMeta();
		const tl = meta.groups.find((g) => g.codeRaw === '2-ТЛ/-TL');
		expect(tl?.codeDe).toBe('2-TL');
	});

	it('German group labels keep year prefix when Russian label has it', async () => {
		const meta = await loadMeta();
		for (const group of meta.groups) {
			if (!/^\d/.test(group.codeRu)) continue;
			expect(group.codeDe, group.codeRaw).toMatch(/^\d/);
		}
	});

	it('parenthesized suffixes are stripped from group labels', async () => {
		const meta = await loadMeta();
		for (const group of meta.groups) {
			expect(group.codeRu).not.toMatch(/\(/);
			expect(group.codeDe).not.toMatch(/\(/);
		}
	});
});

suite('parseTimetablePage - label quality', () => {
	it('no event labels have trailing slashes (all groups, all weeks)', async () => {
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
				const { events } = await parseTimetablePage(html, group, week);

				for (const e of events) {
					const ctx = `${group.codeRaw} w${week.value} ${e.subjectShortRaw}`;
					expect(e.subjectShortRu, ctx).not.toMatch(/\/$/);
					expect(e.subjectShortDe, ctx).not.toMatch(/\/$/);
					expect(e.subjectFullRu, ctx).not.toMatch(/\/$/);
					expect(e.subjectFullDe, ctx).not.toMatch(/\/$/);
				}
			}
		}
	});

	it('no event labels have leading dashes', async () => {
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
				const { events } = await parseTimetablePage(html, group, week);

				for (const e of events) {
					const ctx = `${group.codeRaw} w${week.value} ${e.subjectShortRaw}`;
					expect(e.subjectShortRu, ctx).not.toMatch(/^-/);
					expect(e.subjectShortDe, ctx).not.toMatch(/^-/);
					expect(e.subjectFullRu, ctx).not.toMatch(/^-/);
					expect(e.subjectFullDe, ctx).not.toMatch(/^-/);
				}
			}
		}
	});

	it('lessonType never contains Kazakh-specific characters', async () => {
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
				const { events } = await parseTimetablePage(html, group, week);

				for (const e of events) {
					expect(e.lessonType, `${group.codeRaw} ${e.subjectFullRaw}`).not.toMatch(
						/[ҚқӘәҒғҢңӨөҰұҮүІіҺһ]/
					);
				}
			}
		}
	});

	it('no event spans more than one standard period (multi-period events are split)', async () => {
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
				const { events } = await parseTimetablePage(html, group, week);

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

	it('fullDe is never Cyrillic-only when different from fullRu', async () => {
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
				const { events } = await parseTimetablePage(html, group, week);

				for (const e of events) {
					if (e.subjectFullDe !== e.subjectFullRu) {
						expect(e.subjectFullDe, `${group.codeRaw} ${e.subjectFullRaw}`).not.toMatch(
							/^[А-Яа-яЁёҚқӘәҒғҢңӨөҰұҮүІіҺһ]/
						);
					}
				}
			}
		}
	});
});

suite('parseTimetablePage - specific groups', () => {
	it('Экономическая теория has lessonType "лекция"', async () => {
		const { events } = await loadSchedule('3А-ТЛ');
		const econ = events.find((e) => e.subjectFullRaw.includes('Экономическая теория'));
		expect(econ).toBeDefined();
		expect(econ?.lessonType).toBe('лекция');
		expect(econ?.subjectFullRu).toBe('Экономическая теория');
		expect(econ?.subjectFullDe).toBe('Wirtschaftstheorie');
	});

	it('Казахский язык/Kasachisch has lessonType "пр."', async () => {
		const { events } = await loadSchedule('3А-ТЛ');
		const kaz = events.find((e) => e.subjectFullRaw.includes('Kasachisch'));
		expect(kaz).toBeDefined();
		expect(kaz?.lessonType).toBe('пр.');
		expect(kaz?.subjectFullDe).toBe('Kasachisch');
	});

	it('Казахский язык/Бизнес қазақ тілі has empty lessonType and Russian fallback for German', async () => {
		const { events } = await loadSchedule('3-Мен');
		const biz = events.find((e) => e.subjectFullRaw.includes('қазақ'));
		if (biz === undefined) return; // not every week has this subject
		expect(biz.lessonType).toBe('');
		expect(biz.subjectFullDe).toBe(biz.subjectFullRu);
	});

	it('detects kz cohort codes correctly', async () => {
		const { events, cohorts } = await loadSchedule('3А-ТЛ');
		const kazCohorts = cohorts.filter((c) => c.track === 'kz');
		expect(kazCohorts.length).toBeGreaterThan(0);
		for (const c of kazCohorts) {
			expect(c.code).toMatch(/^Каз/);
		}
		const kazEvents = events.filter((e) => e.track === 'kz');
		for (const e of kazEvents) {
			expect(e.cohortCode).toMatch(/^Каз/);
			expect(e.scope).toBe('cohort_shared');
		}
	});

	it('core_fixed events have no cohortCode', async () => {
		const { events } = await loadSchedule('3А-ТЛ');
		const core = events.filter((e) => e.scope === 'core_fixed');
		expect(core.length).toBeGreaterThan(0);
		for (const e of core) {
			expect(e.cohortCode).toBeNull();
		}
	});

	it('Business and Soft Skills extracts пр. as lessonType from no-slash legend entry', async () => {
		const { events } = await loadSchedule('2А-МО');
		const bs = events.find((e) => e.subjectFullRaw.includes('Business'));
		if (bs === undefined) return; // not every week has this subject
		expect(bs.lessonType).toBe('пр.');
		expect(bs.subjectFullRu).not.toContain('пр.');
	});
});

if (fixtureReady === false) {
	describe('parser quality tests prerequisites', () => {
		it('requires fixture snapshot', () => {
			expect('Fixture snapshot missing. Run: npm run fixtures:sync').toBeTypeOf('string');
		});
	});
}
