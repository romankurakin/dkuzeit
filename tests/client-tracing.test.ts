import { beforeEach, describe, expect, it, vi } from 'vitest';

const { startSpanMock } = vi.hoisted(() => ({
	startSpanMock: vi.fn()
}));

vi.mock('@sentry/sveltekit', () => ({
	startSpan: startSpanMock
}));

import { traceNavigate, traceCalendarExport, traceInitialRender } from '../src/lib/client-tracing';

describe('client tracing wrappers', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('trace navigate wraps fn with ui.navigate span', async () => {
		startSpanMock.mockImplementation((_ctx, fn: () => Promise<void>) => fn());
		await traceNavigate('/group', 'invalidate', async () => {});
		expect(startSpanMock).toHaveBeenCalledWith(
			{
				name: 'invalidate',
				op: 'ui.navigate',
				attributes: { 'ui.navigate.type': 'invalidate', 'ui.route': '/group' }
			},
			expect.any(Function)
		);
	});

	it('trace navigate propagates goto type', async () => {
		startSpanMock.mockImplementation((_ctx, fn: () => Promise<void>) => fn());
		await traceNavigate('/other', 'goto', async () => {});
		expect(startSpanMock).toHaveBeenCalledWith(
			{
				name: 'goto',
				op: 'ui.navigate',
				attributes: { 'ui.navigate.type': 'goto', 'ui.route': '/other' }
			},
			expect.any(Function)
		);
	});

	it('trace calendar export wraps fn with ui.calendar_export span', async () => {
		startSpanMock.mockImplementation((_ctx, fn: () => Promise<string>) => fn());
		await expect(
			traceCalendarExport({ group: '2-CS', locale: 'de', week: '05' }, async () => 'url')
		).resolves.toBe('url');
		expect(startSpanMock).toHaveBeenCalledWith(
			{
				name: 'calendarExport',
				op: 'ui.calendar_export',
				attributes: {
					'schedule.group': '2-CS',
					'schedule.week': '05',
					'ui.locale': 'de'
				}
			},
			expect.any(Function)
		);
	});

	it('trace initial render creates span with custom start time', () => {
		startSpanMock.mockImplementation((_ctx, fn: () => void) => fn());
		const start = 1700000000;
		traceInitialRender(start, {
			days: 6,
			events: 18,
			group: '2-CS',
			locale: 'ru',
			week: '05'
		});
		expect(startSpanMock).toHaveBeenCalledWith(
			{
				name: 'scheduleRender',
				op: 'ui.initial_render',
				startTime: start,
				attributes: {
					'schedule.days': 6,
					'schedule.events': 18,
					'schedule.group': '2-CS',
					'schedule.week': '05',
					'ui.locale': 'ru'
				}
			},
			expect.any(Function)
		);
	});

	it('trace wrappers propagate callback failures', async () => {
		const boom = new Error('boom');
		startSpanMock.mockImplementation((_ctx, fn: () => Promise<never>) => fn());
		await expect(
			traceCalendarExport({ group: '2-CS' }, async () => {
				throw boom;
			})
		).rejects.toThrow('boom');
	});
});
