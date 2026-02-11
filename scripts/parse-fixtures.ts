import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parseNavHtml, parseTimetablePage } from '../src/lib/server/parser';

const root = 'tests/fixtures/live';
const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const navbar = readFileSync(path.join(root, 'frames/navbar.htm'), 'utf8');
const meta = parseNavHtml(navbar);

const groupArg = process.argv[2] ?? '';
const weekArg = process.argv[3] ?? '';

if (groupArg === '--list' || groupArg === '-l') {
	console.log('Groups:');
	for (const g of meta.groups) {
		console.log(`  ${g.id}\t${g.codeRaw}\t(ru: ${g.codeRu}, de: ${g.codeDe})`);
	}
	console.log('\nWeeks:');
	for (const w of meta.weeks) {
		const available = manifest.weeks.includes(w.value) ? '✓' : '✗';
		console.log(`  ${w.value}\t${w.label}\t${available}`);
	}
	process.exit(0);
}

if (groupArg === '' || groupArg === '--help' || groupArg === '-h') {
	console.log('Usage: npm run fixtures:parse -- <group> [week]');
	console.log('       npm run fixtures:parse -- --list');
	console.log('\nExamples:');
	console.log('  npm run fixtures:parse -- "3А-ТЛ"');
	console.log('  npm run fixtures:parse -- "3А-ТЛ" 04');
	process.exit(0);
}

async function run() {
	const group = meta.groups.find(
		(g) =>
			g.codeRaw === groupArg ||
			g.codeRu === groupArg ||
			g.codeDe === groupArg ||
			g.codeRaw.includes(groupArg)
	);
	if (group === undefined) {
		console.error(`Group not found: "${groupArg}"`);
		console.error('Use --list to see available groups');
		process.exit(1);
	}

	const weeks = weekArg
		? meta.weeks.filter((w) => w.value === weekArg.padStart(2, '0'))
		: meta.weeks.filter((w) => manifest.weeks.includes(w.value));

	if (weeks.length === 0) {
		console.error('No matching weeks found');
		process.exit(1);
	}

	for (const week of weeks) {
		const rel = path.join(week.value, 'c', `c${String(group.id).padStart(5, '0')}.htm`);
		const fp = path.join(root, rel);
		if (!existsSync(fp)) {
			console.error(`Fixture missing: ${rel}`);
			continue;
		}
		const html = readFileSync(fp, 'utf8');
		const result = await parseTimetablePage(html, group, week);

		const output = {
			group: { id: group.id, codeRaw: group.codeRaw, codeRu: group.codeRu, codeDe: group.codeDe },
			week: { value: week.value, label: week.label, startDateIso: week.startDateIso },
			events: result.events,
			cohorts: result.cohorts
		};

		console.log(JSON.stringify(output, null, 2));
	}
}

void run();
