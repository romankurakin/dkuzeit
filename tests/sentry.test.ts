import { eventFiltersIntegration, type ErrorEvent } from '@sentry/sveltekit';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/env', () => ({ dev: false }));

import { clientSentryConfig, serverSentryConfig } from '../src/lib/sentry';

function exceptionEvent(value: string): ErrorEvent {
	return { type: undefined, exception: { values: [{ type: 'TypeError', value }] } };
}

// Sentry marks an error as captured before beforeSend sees the event.
function capturedError(message: string): TypeError {
	const error = new TypeError(message);
	Object.defineProperty(error, '__sentry_captured__', { value: true });
	return error;
}

describe('client Sentry event filtering', () => {
	const { beforeSend, ignoreErrors } = clientSentryConfig;

	it.each(['Failed to fetch (dkuzeit.net)', 'Load failed (dkuzeit.net)'])(
		'drops the network failure %j that hooks.client.ts recovered from',
		(message) => {
			const event = exceptionEvent(message);

			expect(beforeSend(event, { originalException: capturedError(message) })).toBeNull();
		}
	);

	it('preserves other errors', () => {
		const event = exceptionEvent('Application bug');

		expect(beforeSend(event, { originalException: capturedError('Application bug') })).toBe(event);
		expect(beforeSend(event, {})).toBe(event);
	});

	describe('ignoreErrors', () => {
		const client = { getOptions: () => ({}) } as never;
		const filters = eventFiltersIntegration({ ignoreErrors });

		it.each([
			'Importing a module script failed.',
			'Failed to fetch dynamically imported module: https://dkuzeit.net/_app/immutable/nodes/1.js',
			'error loading dynamically imported module: https://dkuzeit.net/_app/immutable/nodes/1.js'
		])('ignores the script load failure %j', (value) => {
			expect(filters.processEvent?.(exceptionEvent(value), {}, client)).toBeNull();
		});

		it('keeps other errors', () => {
			const event = exceptionEvent('Application bug');

			expect(filters.processEvent?.(event, {}, client)).toBe(event);
		});
	});

	it('keeps the client filters out of the server configuration', () => {
		expect(serverSentryConfig).not.toHaveProperty('beforeSend');
		expect(serverSentryConfig).not.toHaveProperty('ignoreErrors');
	});
});
