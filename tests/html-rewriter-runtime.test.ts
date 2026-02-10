import { afterEach, describe, expect, it } from 'vitest';
import { runHtmlRewriter } from '../src/lib/server/html-rewriter-runtime';

const globalScope = globalThis as { HTMLRewriter?: unknown };
const originalCtor = globalScope.HTMLRewriter;

afterEach(() => {
	if (originalCtor === undefined) {
		delete globalScope.HTMLRewriter;
	} else {
		globalScope.HTMLRewriter = originalCtor;
	}
});

describe('runHtmlRewriter', () => {
	it('uses transform() path when available', async () => {
		const calls = { on: 0, transform: 0 };

		class TransformRewriter {
			on(): this {
				calls.on += 1;
				return this;
			}
			transform(input: Response): Response {
				calls.transform += 1;
				return input;
			}
		}

		globalScope.HTMLRewriter = TransformRewriter;

		await runHtmlRewriter('<p>ok</p>', (rewriter) => {
			rewriter.on('p', {});
		});

		expect(calls.on).toBe(1);
		expect(calls.transform).toBe(1);
	});

	it('falls back to write/end/free path', async () => {
		const calls = { on: 0, write: 0, end: 0, free: 0 };
		const chunks: Uint8Array[] = [];

		class StreamRewriter {
			constructor(private outputSink?: (chunk: Uint8Array) => void) {}
			on(): this {
				calls.on += 1;
				return this;
			}
			async write(chunk: Uint8Array): Promise<void> {
				calls.write += 1;
				chunks.push(chunk);
				this.outputSink?.(chunk);
			}
			async end(): Promise<void> {
				calls.end += 1;
			}
			free(): void {
				calls.free += 1;
			}
		}

		globalScope.HTMLRewriter = StreamRewriter;

		await runHtmlRewriter('<p>fallback</p>', (rewriter) => {
			rewriter.on('p', {});
		});

		expect(calls.on).toBe(1);
		expect(calls.write).toBe(1);
		expect(calls.end).toBe(1);
		expect(calls.free).toBe(1);
		expect(new TextDecoder().decode(chunks[0])).toBe('<p>fallback</p>');
	});

	it('throws when HTMLRewriter is unavailable', async () => {
		delete globalScope.HTMLRewriter;

		await expect(runHtmlRewriter('<p>x</p>', () => {})).rejects.toThrow(
			'HTMLRewriter is unavailable in this runtime'
		);
	});

	it('throws when runtime implementation has unsupported methods', async () => {
		class UnsupportedRewriter {
			on(): this {
				return this;
			}
		}

		globalScope.HTMLRewriter = UnsupportedRewriter;

		await expect(runHtmlRewriter('<p>x</p>', (rewriter) => rewriter.on('p', {}))).rejects.toThrow(
			'HTMLRewriter does not provide transform() or write()/end()'
		);
	});
});
