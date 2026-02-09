import { cleanText } from './text';

export function parseLegendEntries(
	html: string,
	heading: string
): Array<{ code: string; value: string }> {
	const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const pattern = new RegExp(
		`<B>${escaped}<\\/B>[\\s\\S]*?<TABLE[^>]*>([\\s\\S]*?)<\\/TABLE>`,
		'i'
	);
	const tableMatch = html.match(pattern);
	if (!tableMatch) return [];

	const cells = Array.from(tableMatch[1]!.matchAll(/<TD[^>]*>([\s\S]*?)<\/TD>/gi)).map((entry) =>
		cleanText(entry[1]!)
	);

	const output: Array<{ code: string; value: string }> = [];
	for (let i = 0; i + 1 < cells.length; i += 2) {
		const code = cells[i];
		const value = cells[i + 1];
		if (!code || !value) continue;
		if (code === 'Имя' || value === 'Полное назв/имя') continue;
		if (code === '&nbsp;' || value === '&nbsp;') continue;
		output.push({ code, value });
	}
	return output;
}

/** Normalize a code key: strip leading dots, collapse spaces, strip trailing slash, uppercase. */
function fastCodeKey(input: string): string {
	return input.replace(/^\.+/, '').replace(/\s+/g, '').replace(/\/$/, '').toUpperCase();
}

function fastLeftKey(input: string): string {
	return fastCodeKey(input.split('/')[0] ?? input);
}

export function makeLegendResolver(
	entries: Array<{ code: string; value: string }>
): (code: string) => string {
	const byFull = new Map<string, string>();
	const byLeft = new Map<string, string>();

	for (const entry of entries) {
		byFull.set(fastCodeKey(entry.code), entry.value);
		byLeft.set(fastLeftKey(entry.code), entry.value);
	}

	return (code: string): string => {
		return byFull.get(fastCodeKey(code)) ?? byLeft.get(fastLeftKey(code)) ?? '';
	};
}
