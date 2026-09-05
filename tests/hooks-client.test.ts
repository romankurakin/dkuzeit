import type { HandleClientError, NavigationEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { addBreadcrumbMock, sentryHandleErrorMock, handleErrorWithSentryMock, initMock } =
	vi.hoisted(() => {
		const sentryHandleError = vi.fn();
		return {
			addBreadcrumbMock: vi.fn(),
			sentryHandleErrorMock: sentryHandleError,
			handleErrorWithSentryMock: vi.fn(() => sentryHandleError),
			initMock: vi.fn()
		};
	});

vi.mock('@sentry/sveltekit', () => ({
	addBreadcrumb: addBreadcrumbMock,
	handleErrorWithSentry: handleErrorWithSentryMock,
	init: initMock
}));

vi.mock('$lib/sentry', () => ({
	clientSentryConfig: {}
}));

import { handleError } from '../src/hooks.client';
import { NETWORK_UNAVAILABLE_CODE } from '../src/lib/client/network-errors';

function clientErrorInput(error: unknown): Parameters<HandleClientError>[0] {
	return {
		error,
		event: {} as NavigationEvent,
		message: 'Internal Error',
		status: 500
	};
}

describe('client error hook', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		sentryHandleErrorMock.mockReturnValue({ message: 'Handled by Sentry' });
	});

	it('returns a recoverable network error without delegating it to Sentry', async () => {
		await expect(handleError(clientErrorInput(new TypeError('Load failed')))).resolves.toEqual({
			code: NETWORK_UNAVAILABLE_CODE,
			message: 'Network unavailable'
		});
		expect(addBreadcrumbMock).toHaveBeenCalledOnce();
		expect(sentryHandleErrorMock).not.toHaveBeenCalled();
	});

	it('delegates unrelated failures to the Sentry handler', async () => {
		const input = clientErrorInput(new TypeError('Application bug'));

		await expect(handleError(input)).resolves.toEqual({ message: 'Handled by Sentry' });
		expect(sentryHandleErrorMock).toHaveBeenCalledWith(input);
		expect(addBreadcrumbMock).not.toHaveBeenCalled();
	});
});
