import { describe, expect, it } from 'vitest';
import { isNetworkFetchError } from '../src/lib/client/network-errors';

// Safari network errors carry no stack; is-network-error uses that to tell
// them apart from other "Load failed" TypeErrors.
function safariNetworkError(message: string): TypeError {
	const error = new TypeError(message);
	delete error.stack;
	return error;
}

describe('network error classification', () => {
	it.each([
		'Failed to fetch',
		'Failed to fetch (dkuzeit.net)',
		'NetworkError when attempting to fetch resource.'
	])('recognizes the browser fetch failure %j', (message) => {
		expect(isNetworkFetchError(new TypeError(message))).toBe(true);
	});

	it.each(['Load failed', 'Load failed (dkuzeit.net)'])(
		'recognizes the Safari fetch failure %j',
		(message) => {
			expect(isNetworkFetchError(safariNetworkError(message))).toBe(true);
		}
	);

	it.each([
		new DOMException('The operation was aborted', 'AbortError'),
		new TypeError('Cannot read properties of undefined'),
		new TypeError('Failed to fetch dynamically imported module: https://dkuzeit.net/_app/x.js'),
		new Error('Failed to fetch'),
		{ name: 'TypeError', message: 'Failed to fetch' },
		null
	])('does not classify unrelated errors: %o', (error) => {
		expect(isNetworkFetchError(error)).toBe(false);
	});
});
