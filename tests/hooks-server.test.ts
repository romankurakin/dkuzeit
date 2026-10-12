import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Handle } from '@sveltejs/kit/hooks';

const { initSentry, handleSentry, waitUntil } = vi.hoisted(() => ({
	initSentry: vi.fn(),
	handleSentry: vi.fn(),
	waitUntil: vi.fn()
}));

vi.mock('cloudflare:workers', () => ({ tracing: undefined, waitUntil }));
vi.mock('#lib/sentry.ts', () => ({ serverSentryConfig: {} }));
vi.mock('@sentry/sveltekit', () => ({
	initCloudflareSentryHandle:
		(): Handle =>
		async ({ event, resolve }) => {
			initSentry();
			return resolve(event);
		},
	sentryHandle:
		(): Handle =>
		async ({ event, resolve }) => {
			handleSentry();
			return resolve(event);
		},
	handleErrorWithSentry: () => vi.fn()
}));
vi.mock('#lib/paraglide/server.js', () => ({
	paraglideMiddleware: (_request: Request, next: (context: { locale: string }) => unknown) =>
		next({ locale: 'ru' })
}));

import { handle } from '../src/hooks.server';
import { GET as health } from '../src/routes/api/health/+server';

// Exercise the real hook sequence inside the request store SvelteKit normally provides.
const { with_request_store } = await vi.importActual<{
	with_request_store<T>(store: { event: unknown; state: object }, fn: () => T): T;
}>('@sveltejs/kit/internal/server');

describe('server hooks', () => {
	beforeEach(() => vi.clearAllMocks());

	it('serves liveness through the Worker without Sentry or a timetable context', async () => {
		const event = { route: { id: '/api/health' }, locals: {} };
		const response = await with_request_store({ event, state: {} }, () =>
			handle({ event, resolve: () => health({} as never) } as never)
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: 'ok' });
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
		expect(event.locals).not.toHaveProperty('dkuRequest');
		expect(initSentry).not.toHaveBeenCalled();
		expect(handleSentry).not.toHaveBeenCalled();
	});

	it('retains Sentry and the background-work context on application requests', async () => {
		const event = {
			route: { id: '/[[group]]' },
			locals: {},
			request: new Request('https://dkuzeit.net/')
		};
		await with_request_store({ event, state: {} }, () =>
			handle({ event, resolve: () => new Response('ok') } as never)
		);
		expect(event.locals).toHaveProperty('dkuRequest.waitUntil', waitUntil);
		expect(initSentry).toHaveBeenCalledTimes(1);
		expect(handleSentry).toHaveBeenCalledTimes(1);
	});
});
