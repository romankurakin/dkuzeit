import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
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

async function run() {
	if (!existsSync(manifestPath)) {
		console.error('Fixtures missing. Run: npm run fixtures:sync');
		process.exit(1);
	}

	const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest;
	const navbarHtml = await readFile(path.join(fixtureRoot, 'frames/navbar.htm'), 'utf8');

	// Bench parseNavHtml
	const navStart = performance.now();
	const meta = parseNavHtml(navbarHtml);
	const navMs = performance.now() - navStart;
	console.log(
		`parseNavHtml: ${navMs.toFixed(2)}ms (${meta.groups.length} groups, ${meta.weeks.length} weeks)`
	);

	// Pre-load all HTML files into memory to measure only parse time
	const pages: Array<{
		html: string;
		group: (typeof meta.groups)[number];
		week: (typeof meta.weeks)[number];
		rel: string;
	}> = [];
	for (const week of meta.weeks) {
		if (!manifest.weeks.includes(week.value)) continue;
		for (const group of meta.groups) {
			const rel = path.join(week.value, 'c', `c${String(group.id).padStart(5, '0')}.htm`);
			const filePath = path.join(fixtureRoot, rel);
			if (!existsSync(filePath)) continue;
			const html = await readFile(filePath, 'utf8');
			pages.push({ html, group, week, rel });
		}
	}

	console.log(`Loaded ${pages.length} fixture pages into memory`);

	// Bench parseTimetablePage for all pages
	let totalEvents = 0;
	let failures = 0;
	const parseStart = performance.now();
	for (const { html, group, week } of pages) {
		try {
			const parsed = parseTimetablePage(html, group, week);
			totalEvents += parsed.events.length;
		} catch {
			failures += 1;
		}
	}
	const parseMs = performance.now() - parseStart;
	const perPage = parseMs / pages.length;
	console.log(
		`parseTimetablePage: ${parseMs.toFixed(2)}ms total, ${perPage.toFixed(2)}ms/page (${pages.length} pages, ${totalEvents} events, ${failures} failures)`
	);
	console.log(`Total: ${(navMs + parseMs).toFixed(2)}ms`);
}

run();
