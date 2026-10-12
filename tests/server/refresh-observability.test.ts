import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { buildMergedSchedule } from '../../src/lib/server/dku';
import { createDkuRequestContext, SCHEDULE_CACHE_POLICY } from '../../src/lib/server/dku-fetch';
import type { NativeTracing } from '../../src/lib/server/tracing';
import type { MetaPayload } from '../../src/lib/server/types';

const { count, distribution } = vi.hoisted(() => ({ count: vi.fn(), distribution: vi.fn() }));
vi.mock('@sentry/sveltekit', () => ({ metrics: { count, distribution } }));

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

it('keeps background refresh measurements in Cloudflare without extra Sentry metrics', async () => {
	vi.useFakeTimers({ toFake: ['Date'] });
	const html = readFileSync(new URL('../fixtures/live/47/c/c00001.htm', import.meta.url), 'utf8');
	const meta: MetaPayload = {
		groups: [{ id: 1, codeRaw: '1-CS', codeRu: '1-КС', codeDe: '1-KS' }],
		weeks: ['44', '45', '46', '47'].map((value, index) => ({
			value,
			label: value,
			startDateIso: `2026-11-${String(2 + index * 7).padStart(2, '0')}`
		}))
	};
	const entries = new Map<string, Response>();
	vi.stubGlobal('caches', {
		default: {
			match: async (key: string) => entries.get(key)?.clone(),
			put: async (key: string, response: Response) => entries.set(key, response.clone())
		}
	});
	const fetch = vi.fn(async () => new Response(html));
	vi.stubGlobal('fetch', fetch);
	const load = (request = createDkuRequestContext()) =>
		Promise.all(
			meta.weeks.map((week) => buildMergedSchedule('1-CS', week.value, [], { meta, request }))
		);
	const initial = await load();
	expect(initial.every((schedule) => schedule.events.length > 0)).toBe(true);

	vi.setSystemTime(Date.now() + SCHEDULE_CACHE_POLICY.edgeTtlSeconds * 1000);
	const upstream = Promise.withResolvers<void>();
	fetch.mockImplementation(async () => {
		await upstream.promise;
		return new Response(html);
	});
	count.mockClear();
	distribution.mockClear();
	const setAttribute = vi.fn();
	const tracing: NativeTracing = {
		enterSpan: (_name, callback) => callback({ setAttribute })
	};
	const background: Promise<unknown>[] = [];
	const request = createDkuRequestContext({ tracing, waitUntil: (work) => background.push(work) });

	// The response finishes while all four upstream refreshes are still blocked.
	await expect(load(request)).resolves.toEqual(initial);
	expect(count).toHaveBeenCalledTimes(4);
	expect(count).toHaveBeenCalledWith('dku.cache.access', 1, {
		attributes: { 'cache.kind': 'schedule', 'cache.result': 'stale' }
	});
	upstream.resolve();
	while (background.length) await Promise.all(background.splice(0));

	for (const [key, values] of [
		['html.input_bytes', initial.map(() => new TextEncoder().encode(html).byteLength)],
		['timetable.event_count', initial.map((schedule) => schedule.events.length)],
		['timetable.cohort_count', initial.map((schedule) => schedule.cohorts.length)]
	] as const) {
		expect(
			setAttribute.mock.calls.filter(([name]) => name === key).map(([, value]) => value)
		).toEqual(values);
	}
	expect(count).toHaveBeenCalledTimes(4);
	expect(distribution).not.toHaveBeenCalled();
}, 2000);
