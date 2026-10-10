import type { HandleClientError } from '@sveltejs/kit/hooks';
import type { NavigationEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { addBreadcrumbMock, handleErrorWithSentryMock, initMock } = vi.hoisted(() => ({
	addBreadcrumbMock: vi.fn(),
	// Marks the handler so a test can tell that the hook went through Sentry.
	handleErrorWithSentryMock: vi.fn((handler: HandleClientError) =>
		Object.assign(handler, { capturesFirst: true })
	),
	initMock: vi.fn()
}));

vi.mock('@sentry/sveltekit', () => ({
	addBreadcrumb: addBreadcrumbMock,
	handleErrorWithSentry: handleErrorWithSentryMock,
	init: initMock
}));

vi.mock('#lib/sentry.ts', () => ({
	clientSentryConfig: {}
}));

import { handleError } from '../src/hooks.client';
import { NETWORK_UNAVAILABLE_CODE } from '../src/lib/client/network-errors';

function clientErrorInput(error: unknown): Parameters<HandleClientError>[0] {
	return {
		kind: 'unknown',
		error,
		event: {} as NavigationEvent
	};
}

describe('client error hook', () => {
	beforeEach(() => {
		addBreadcrumbMock.mockClear();
	});

	it('runs inside the Sentry handler, so Sentry captures the error first', () => {
		expect(handleError).toHaveProperty('capturesFirst', true);
	});

	it('returns a recoverable network error', () => {
		expect(handleError(clientErrorInput(new TypeError('Failed to fetch')))).toEqual({
			code: NETWORK_UNAVAILABLE_CODE,
			message: 'Network unavailable'
		});
		expect(addBreadcrumbMock).toHaveBeenCalledOnce();
	});

	it('recognizes a Safari network error that Sentry has captured', () => {
		const error = new TypeError('Load failed (dkuzeit.net)');
		Object.defineProperty(error, '__sentry_captured__', { value: true });

		expect(handleError(clientErrorInput(error))).toMatchObject({ code: NETWORK_UNAVAILABLE_CODE });
	});

	it('leaves other errors to the default error page', () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const error = new TypeError('Application bug');

		expect(handleError(clientErrorInput(error))).toBeUndefined();
		expect(consoleError).toHaveBeenCalledWith(error);
		expect(addBreadcrumbMock).not.toHaveBeenCalled();
		consoleError.mockRestore();
	});
});
