import type { ChildNode, Document, Element } from 'domhandler';
import { collectTextBuilder, hasChildren, isElementNode } from './dom-utils';
import { cleanText } from './text';
import { isMissingGermanName, splitBilingualLabel } from './bilingual';

function findBoldWithText(node: ChildNode, text: string): Element | null {
	if (isElementNode(node) && node.name === 'b') {
		const parts: string[] = [];
		if (hasChildren(node)) {
			for (const child of node.children) collectTextBuilder(child, parts);
		}
		if (parts.join('').trim() === text) return node;
	}
	if (!hasChildren(node)) return null;
	for (const child of node.children) {
		const found = findBoldWithText(child, text);
		if (found) return found;
	}
	return null;
}

function findNextTableAfter(root: ChildNode, target: Element): Element | null {
	let phase: 'search' | 'found' = 'search';

	const walk = (node: ChildNode): Element | null => {
		if (phase === 'search') {
			if (node === target) {
				phase = 'found';
			} else if (hasChildren(node)) {
				for (const child of node.children) {
					const result = walk(child);
					if (result) return result;
				}
			}
		} else {
			if (isElementNode(node) && node.name === 'table') return node;
			if (hasChildren(node)) {
				for (const child of node.children) {
					const result = walk(child);
					if (result) return result;
				}
			}
		}
		return null;
	};
	return walk(root);
}

function collectFirstLevelCells(table: Element): string[][] {
	const rows: string[][] = [];
	const processRow = (row: Element) => {
		const cells: string[] = [];
		for (const td of row.children) {
			if (isElementNode(td) && td.name === 'td') {
				const parts: string[] = [];
				if (hasChildren(td)) {
					for (const child of td.children) collectTextBuilder(child, parts);
				}
				cells.push(cleanText(parts.join('')));
			}
		}
		rows.push(cells);
	};

	for (const child of table.children) {
		if (isElementNode(child) && child.name === 'tr') {
			processRow(child);
		} else if (isElementNode(child) && (child.name === 'tbody' || child.name === 'thead')) {
			for (const row of child.children) {
				if (isElementNode(row) && row.name === 'tr') processRow(row);
			}
		}
	}
	return rows;
}

export function parseLegendEntries(
	document: Document,
	heading: string
): Array<{ code: string; value: string }> {
	const bold = findBoldWithText(document, heading);
	if (!bold) return [];

	const table = findNextTableAfter(document, bold);
	if (!table) return [];

	const rows = collectFirstLevelCells(table);

	const output: Array<{ code: string; value: string }> = [];
	for (const cells of rows) {
		for (let i = 0; i + 1 < cells.length; i += 2) {
			const code = cells[i];
			const value = cells[i + 1];
			if (!code || !value) continue;
			if (code === 'Имя' || value === 'Полное назв/имя') continue;
			output.push({ code, value });
		}
	}
	return output;
}

// Normalize to uppercase, strip source marker prefixes, collapse spaces
function fastCodeKey(input: string): string {
	return input
		.replace(/^[.*]+/, '')
		.replace(/\([A-Za-z]+\)/g, '')
		.replace(/\s+/g, '')
		.replace(/\/$/, '')
		.toUpperCase();
}

function fastLeftKey(input: string): string {
	return fastCodeKey(input.split('/')[0]!);
}

// A truncated cell code can prefix-match several legend entries that differ only
// by a subgroup suffix ("Английский язык/Fachsprache Englisch гр1 пр." vs
// "гр2 пр."). The cell gives no way to tell the subgroups apart, but the subject
// name they agree on is still safe to show, so keep it and drop the suffix.
function sharedSubjectName(values: string[]): string {
	const noGerman = isMissingGermanName(values[0]!);
	const first = splitBilingualLabel(values[0]!, noGerman);
	for (const value of values.slice(1)) {
		if (isMissingGermanName(value) !== noGerman) return '';
		const other = splitBilingualLabel(value, noGerman);
		if (other.ru !== first.ru || other.de !== first.de) return '';
	}
	if (noGerman || !first.de || first.de === first.ru) return first.ru;
	return `${first.ru}/${first.de}`;
}

export function makeLegendResolver(
	entries: Array<{ code: string; value: string }>
): (code: string) => string {
	const byFull = new Map<string, string>();
	const byLeft = new Map<string, string>();
	const leftKeyed: Array<{ key: string; value: string }> = [];

	for (const entry of entries) {
		byFull.set(fastCodeKey(entry.code), entry.value);
		const leftKey = fastLeftKey(entry.code);
		byLeft.set(leftKey, entry.value);
		leftKeyed.push({ key: leftKey, value: entry.value });
	}

	// Cell codes are truncated to the source table's column width while legend
	// codes are complete (e.g. cell "ННРТПР" vs legend "ННРТПР.л/WA"), so on an
	// exact miss fall back to a prefix match — but only when every matching
	// legend entry agrees on one full name
	const byPrefix = (code: string): string => {
		const key = fastLeftKey(code);
		if (key.length < 2) return '';
		const matches: string[] = [];
		for (const entry of leftKeyed) {
			if (!entry.key.startsWith(key)) continue;
			if (!matches.includes(entry.value)) matches.push(entry.value);
		}
		if (matches.length === 0) return '';
		if (matches.length === 1) return matches[0]!;
		return sharedSubjectName(matches);
	};

	return (code: string): string => {
		return byFull.get(fastCodeKey(code)) ?? byLeft.get(fastLeftKey(code)) ?? byPrefix(code);
	};
}
