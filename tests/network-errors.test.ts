import { describe, expect, it } from 'vitest';
import { isNetworkFetchError } from '../src/lib/client/network-errors';

describe('network error classification', () => {
	it.each(['Load failed', 'Failed to fetch', 'NetworkError when attempting to fetch resource.'])(
		'recognizes the browser fetch failure %j',
		(message) => {
			expect(isNetworkFetchError(new TypeError(message))).toBe(true);
		}
	);

	it('recognizes cross-realm TypeError-shaped failures', () => {
		expect(
			isNetworkFetchError({
				name: 'TypeError',
				message: 'Failed to fetch'
			})
		).toBe(true);
	});

	it.each([
		new DOMException('The operation was aborted', 'AbortError'),
		new TypeError('Cannot read properties of undefined'),
		new Error('Failed to fetch'),
		{ name: 'TypeError' },
		null
	])('does not classify unrelated errors: %o', (error) => {
		expect(isNetworkFetchError(error)).toBe(false);
	});
});
