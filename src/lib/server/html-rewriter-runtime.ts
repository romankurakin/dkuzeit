export interface HtmlRewriterTextLike {
	text: string;
}

export interface HtmlRewriterElementLike {
	getAttribute(name: string): string | null;
	onEndTag(handler: () => void | Promise<void>): void;
}

export interface HtmlRewriterLike {
	on(
		selector: string,
		handlers: {
			element?: (element: HtmlRewriterElementLike) => void | Promise<void>;
			text?: (text: HtmlRewriterTextLike) => void | Promise<void>;
		}
	): HtmlRewriterLike;
	transform?: (input: Response) => Response;
	write?: (chunk: Uint8Array) => Promise<void>;
	end?: () => Promise<void>;
	free?: () => void;
}

export async function runHtmlRewriter(
	html: string,
	register: (rewriter: HtmlRewriterLike) => void
): Promise<void> {
	const g = globalThis as { HTMLRewriter?: new () => HtmlRewriterLike };
	if (typeof g.HTMLRewriter !== 'function') {
		try {
			const mod = await import('html-rewriter-wasm');
			const ctor =
				(mod as { HTMLRewriter?: unknown }).HTMLRewriter ??
				(mod as { default?: { HTMLRewriter?: unknown } }).default?.HTMLRewriter;
			if (typeof ctor === 'function') g.HTMLRewriter = ctor as unknown as typeof g.HTMLRewriter;
		} catch {
			// html-rewriter-wasm not available (production Cloudflare Workers)
		}
	}
	if (typeof g.HTMLRewriter !== 'function') {
		throw new Error('HTMLRewriter is unavailable in this runtime');
	}
	const nativeCtor = g.HTMLRewriter;

	const rewriter = new (nativeCtor as unknown as new (
		outputSink?: (chunk: Uint8Array) => void
	) => HtmlRewriterLike)(() => undefined);
	register(rewriter);
	if (typeof rewriter.transform === 'function') {
		const transformed = rewriter.transform(new Response(html));
		await transformed.arrayBuffer();
		return;
	}

	if (typeof rewriter.write === 'function' && typeof rewriter.end === 'function') {
		try {
			await rewriter.write(new TextEncoder().encode(html));
			await rewriter.end();
		} finally {
			rewriter.free?.();
		}
		return;
	}

	throw new Error('HTMLRewriter does not provide transform() or write()/end()');
}
