import type { ChildNode, Element } from 'domhandler';

export function isElementNode(node: ChildNode): node is Element {
	return node.type === 'tag' || node.type === 'script' || node.type === 'style';
}

export function hasChildren(
	node: ChildNode | Element
): node is ChildNode & { children: ChildNode[] } {
	return 'children' in node && Array.isArray(node.children);
}

export function collectTextBuilder(node: ChildNode, out: string[]): void {
	if (node.type === 'text') {
		out.push(node.data);
		return;
	}
	if (hasChildren(node)) {
		for (const child of node.children) collectTextBuilder(child, out);
	}
}

export function collectText(node: ChildNode): string {
	const parts: string[] = [];
	collectTextBuilder(node, parts);
	return parts.join('');
}
