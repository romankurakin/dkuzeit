import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseDocument } from 'htmlparser2';
import { parseNavHtml, parseTimetablePage } from '../src/lib/server/parser';

interface Manifest {
	weeks: string[];
	classCount: number;
	downloadedPages: number;
	expectedPages: number;
	failures: Array<{ path: string; error: string }>;
}

interface Page {
	html: string;
	group: ReturnType<typeof parseNavHtml>['groups'][number];
	week: ReturnType<typeof parseNavHtml>['weeks'][number];
}

interface Sample {
	domBuildMs: number;
	extractMs: number;
	fullPipelineMs: number;
}

const fixtureRoot = path.resolve(process.cwd(), 'tests/fixtures/live');
const manifestPath = path.join(fixtureRoot, 'manifest.json');

function readRounds(): number {
	const index = process.argv.indexOf('--rounds');
	if (index < 0) return 7;
	const value = Number(process.argv[index + 1]);
	if (!Number.isInteger(value) || value < 1) throw new Error('--rounds must be a positive integer');
	return value;
}

function measure(fn: () => void): number {
	const start = performance.now();
	fn();
	return performance.now() - start;
}

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 1) return sorted[middle]!;
	return (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function runExtraction(
	pages: Page[],
	documents: ReturnType<typeof parseDocument>[]
): { events: number; failures: number } {
	let events = 0;
	let failures = 0;
	for (let index = 0; index < pages.length; index += 1) {
		const page = pages[index]!;
		try {
			events += parseTimetablePage(documents[index]!, page.group, page.week).events.length;
		} catch {
			failures += 1;
		}
	}
	return { events, failures };
}

async function loadPages(
	meta: ReturnType<typeof parseNavHtml>,
	manifest: Manifest
): Promise<Page[]> {
	const pages: Page[] = [];
	for (const week of meta.weeks) {
		if (!manifest.weeks.includes(week.value)) continue;
		for (const group of meta.groups) {
			const relativePath = path.join(week.value, 'c', `c${String(group.id).padStart(5, '0')}.htm`);
			const filePath = path.join(fixtureRoot, relativePath);
			if (!existsSync(filePath)) continue;
			pages.push({ html: await readFile(filePath, 'utf8'), group, week });
		}
	}
	return pages;
}

async function run() {
	if (!existsSync(manifestPath)) {
		throw new Error('Fixtures missing. Run: pnpm fixtures:sync');
	}

	const rounds = readRounds();
	const json = process.argv.includes('--json');
	const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest;
	const navbarHtml = await readFile(path.join(fixtureRoot, 'frames/navbar.htm'), 'utf8');
	const meta = parseNavHtml(parseDocument(navbarHtml));
	const pages = await loadPages(meta, manifest);
	if (pages.length === 0) throw new Error('No fixture pages found');

	// Warm up both htmlparser2 and the custom DOM traversal before collecting samples.
	const warmDocuments = pages.map((page) => parseDocument(page.html));
	runExtraction(pages, warmDocuments);

	const samples: Sample[] = [];
	let eventCount = 0;
	let failureCount = 0;
	for (let round = 0; round < rounds; round += 1) {
		let documents: ReturnType<typeof parseDocument>[] = [];
		const domBuildMs = measure(() => {
			documents = pages.map((page) => parseDocument(page.html));
		});

		const extractMs = measure(() => {
			const result = runExtraction(pages, documents);
			eventCount = result.events;
			failureCount = result.failures;
		});

		const fullPipelineMs = measure(() => {
			const pipelineDocuments = pages.map((page) => parseDocument(page.html));
			runExtraction(pages, pipelineDocuments);
		});
		samples.push({ domBuildMs, extractMs, fullPipelineMs });
	}

	const result = {
		pages: pages.length,
		rounds,
		events: eventCount,
		failures: failureCount,
		medianMs: {
			domBuild: median(samples.map((sample) => sample.domBuildMs)),
			extraction: median(samples.map((sample) => sample.extractMs)),
			fullPipeline: median(samples.map((sample) => sample.fullPipelineMs))
		}
	};

	if (json) {
		console.log(JSON.stringify(result, null, 2));
		return;
	}

	const row = (label: string, value: number) => {
		console.log(
			`${label.padEnd(31)} ${value.toFixed(2).padStart(8)} ms total  ${(value / pages.length).toFixed(3).padStart(7)} ms/page`
		);
	};

	console.log(`Parser benchmark: ${pages.length} fixture pages, median of ${rounds} rounds`);
	row('DOM build (htmlparser2)', result.medianMs.domBuild);
	row('Timetable extraction (DOM)', result.medianMs.extraction);
	row('Full parse pipeline', result.medianMs.fullPipeline);
	console.log(`${eventCount} events, ${failureCount} failures`);
}

run().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
