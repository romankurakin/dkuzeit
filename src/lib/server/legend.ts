import type { ChildNode, Document, Element } from 'domhandler';
import { collectTextBuilder, hasChildren, isElementNode } from './dom-utils';
import { cleanText } from './text';

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
