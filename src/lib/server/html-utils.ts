import type { DefaultTreeAdapterTypes } from 'parse5';

export type ParseParentNode = Pick<DefaultTreeAdapterTypes.ParentNode, 'childNodes'>;
export type ParseElement = DefaultTreeAdapterTypes.Element;
export type ParseNode = DefaultTreeAdapterTypes.Node;

export function isElement(node: ParseNode | undefined): node is ParseElement {
	return Boolean(node && typeof node === 'object' && 'tagName' in node);
}

export function isTextNode(node: ParseNode): node is DefaultTreeAdapterTypes.TextNode {
	return node.nodeName === '#text';
}

export function attrValue(node: ParseElement, key: string): string | null {
	for (const attr of node.attrs) {
		if (attr.name === key) return attr.value;
	}
	return null;
}

export function nodeText(node: ParseNode): string {
	if (isTextNode(node)) return node.value;
	if (!('childNodes' in node) || !Array.isArray(node.childNodes)) return '';
	let result = '';
	for (const child of node.childNodes) result += nodeText(child);
	return result;
}

export function findFirstByTag(parent: ParseParentNode, tag: string): ParseElement | null {
	const needle = tag;
	const stack: ParseNode[] = parent.childNodes.slice().reverse();
	while (stack.length > 0) {
		const current = stack.pop()!;
		if (isElement(current) && current.tagName === needle) return current;
		if ('childNodes' in current && Array.isArray(current.childNodes)) {
			for (let i = current.childNodes.length - 1; i >= 0; i--) {
				stack.push(current.childNodes[i]!);
			}
		}
	}
	return null;
}

export function directChildrenByTag(parent: ParseParentNode, tag: string): ParseElement[] {
	const output: ParseElement[] = [];
	for (const node of parent.childNodes) {
		if (isElement(node) && node.tagName === tag) output.push(node);
	}
	return output;
}

/** Collapse whitespace in text already extracted from the DOM (no tags/entities to strip). */
export function collapseSpaces(input: string): string {
	return input.replace(/[\s\u00a0]+/g, ' ').trim();
}
