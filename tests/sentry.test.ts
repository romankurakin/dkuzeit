import type { ErrorEvent } from '@sentry/sveltekit';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/env', () => ({ dev: false }));

import { clientSentryConfig, serverSentryConfig } from '../src/lib/sentry';

const wrsRegisterFunction = 'wrsParams.serviceWorkers.navigator.serviceWorker.register';

function exceptionEvent(value: string, functions: string[]): ErrorEvent {
	return {
		type: undefined,
		exception: {
			values: [
				{
					type: 'Error',
					value,
					stacktrace: { frames: functions.map((fn) => ({ function: fn })) }
				}
			]
		}
	};
}

describe('client Sentry event filtering', () => {
	it('drops the Google WRS service worker rejection', () => {
		const event = exceptionEvent('Rejected', ['registerServiceWorker', wrsRegisterFunction]);

		expect(clientSentryConfig.beforeSend(event)).toBeNull();
	});

	it.each([
		['an ordinary rejection', 'Rejected', ['registerServiceWorker']],
		['a browser service worker rejection', 'Rejected', ['navigator.serviceWorker.register']],
		['an unrelated WRS rejection', 'Rejected', ['wrsParams.fetch']],
		['another WRS service worker error', 'SecurityError', [wrsRegisterFunction]],
		['a message containing Rejected', 'Request Rejected', [wrsRegisterFunction]],
		['markers in separate frames', 'Rejected', ['wrsParams.fetch', 'serviceWorker.register']]
	])('preserves %s', (_description, value, functions) => {
		const event = exceptionEvent(value, functions);

		expect(clientSentryConfig.beforeSend(event)).toBe(event);
	});

	it.each([
		{},
		{ message: 'Rejected' },
		{ exception: {} },
		{ exception: { values: [] } },
		{ exception: { values: [{ value: 'Rejected' }] } },
		{ exception: { values: [{ value: 'Rejected', stacktrace: {} }] } },
		{ exception: { values: [{ value: 'Rejected', stacktrace: { frames: [{}] } }] } },
		{
			exception: {
				values: [{ stacktrace: { frames: [{ function: wrsRegisterFunction }] } }]
			}
		}
	])('preserves an event with missing exception data: %o', (data) => {
		const event: ErrorEvent = { type: undefined, ...data };

		expect(clientSentryConfig.beforeSend(event)).toBe(event);
	});

	it('does not combine the message and stack from different exceptions', () => {
		const event: ErrorEvent = {
			type: undefined,
			exception: {
				values: [
					{ value: 'Rejected', stacktrace: { frames: [{ function: 'fetch' }] } },
					{ value: 'Application bug', stacktrace: { frames: [{ function: wrsRegisterFunction }] } }
				]
			}
		};

		expect(clientSentryConfig.beforeSend(event)).toBe(event);
	});

	it('keeps the filter out of the server configuration', () => {
		expect(serverSentryConfig).not.toHaveProperty('beforeSend');
	});
});
