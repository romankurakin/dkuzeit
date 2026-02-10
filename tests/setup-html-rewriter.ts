import * as rewriterModule from 'html-rewriter-wasm';

const globalScope = globalThis as { HTMLRewriter?: unknown };

if (typeof globalScope.HTMLRewriter !== 'function') {
	const ctor =
		(rewriterModule as { HTMLRewriter?: unknown }).HTMLRewriter ??
		(rewriterModule as { default?: { HTMLRewriter?: unknown } }).default?.HTMLRewriter;

	if (typeof ctor !== 'function') {
		throw new Error('Failed to load HTMLRewriter from html-rewriter-wasm');
	}

	globalScope.HTMLRewriter = ctor;
}
