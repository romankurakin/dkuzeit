import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = 'https://timetable.dku.kz';
const outDir = path.resolve(process.cwd(), 'tests/fixtures/live');
const concurrency = 8;
const retryCount = 2;

function toAbsolute(base: string, relativePath: string): string {
	return `${base.replace(/\/$/, '')}/${relativePath.replace(/^\//, '')}`;
}

async function fetchText(relativePath: string): Promise<string> {
	const url = toAbsolute(baseUrl, relativePath);
	let lastError: unknown = null;
	for (let attempt = 0; attempt <= retryCount; attempt += 1) {
		try {
			const response = await fetch(url, {
				headers: { 'cache-control': 'no-cache' }
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			return await response.text();
		} catch (error) {
			lastError = error;
			if (attempt < retryCount) {
				await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
			}
		}
	}
	throw new Error(`Failed to fetch ${url}: ${String(lastError)}`);
}

async function save(relativePath: string, contents: string): Promise<void> {
	const filePath = path.join(outDir, relativePath);
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, contents, 'utf8');
}

function parseWeeks(html: string): string[] {
	const select = html.match(/<select\s+name="week"[\s\S]*?<\/select>/i);
	if (!select) throw new Error('Failed to parse week selector in navbar fixture');
	return Array.from(select[0].matchAll(/<option\s+value="(\d+)"/gi), (entry) => entry[1].padStart(2, '0'));
}

function parseClassCount(html: string): number {
	const classesMatch = html.match(/var\s+classes\s*=\s*\[([\s\S]*?)\];/i);
	if (!classesMatch) throw new Error('Failed to parse classes array in navbar fixture');
	const items = classesMatch[1].match(/"((?:\\.|[^"\\])*)"/g) ?? [];
	return items.length;
}

interface Job {
	week: string;
	classId: number;
	relativePath: string;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, iteratee: (item: T, index: number) => Promise<R>): Promise<R[]> {
	const output = new Array<R>(items.length);
	let cursor = 0;

	async function worker(): Promise<void> {
		while (cursor < items.length) {
			const index = cursor;
			cursor += 1;
			output[index] = await iteratee(items[index], index);
		}
	}

	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return output;
}

async function main(): Promise<void> {
	console.log(`Saving fixtures to ${outDir}`);

	const rootHtml = await fetchText('/');
	await save('index.html', rootHtml);

	const rootFiles = ['frames/navbar.htm', 'frames/title.htm', 'welcome.htm', 'untisscripts.js'];
	for (const file of rootFiles) {
		const html = await fetchText(file);
		await save(file, html);
	}

	const navbar = await fetchText('frames/navbar.htm');
	const weeks = parseWeeks(navbar);
	const classCount = parseClassCount(navbar);
	console.log(`Weeks: ${weeks.length}, classes: ${classCount}`);

	const jobs: Job[] = [];
	for (const week of weeks) {
		for (let classId = 1; classId <= classCount; classId += 1) {
			const fileName = `c${String(classId).padStart(5, '0')}.htm`;
			jobs.push({ week, classId, relativePath: `${week}/c/${fileName}` });
		}
	}

	let success = 0;
	const failures: Array<{ path: string; error: string }> = [];

	await mapWithConcurrency(jobs, concurrency, async (job, index) => {
		try {
			const html = await fetchText(job.relativePath);
			await save(job.relativePath, html);
			success += 1;
			if (index % 80 === 0) {
				console.log(`Downloaded ${index + 1}/${jobs.length}`);
			}
		} catch (error) {
			failures.push({ path: job.relativePath, error: String(error) });
		}
	});

	const manifest = {
		generatedAt: new Date().toISOString(),
		baseUrl,
		weeks,
		classCount,
		expectedPages: jobs.length,
		downloadedPages: success,
		failures
	};

	await save('manifest.json', JSON.stringify(manifest, null, 2));

	console.log(`Done. Downloaded ${success}/${jobs.length} class-week pages.`);
	if (failures.length > 0) {
		console.warn(`Failures: ${failures.length}`);
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
