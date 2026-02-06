import { cleanText } from './text';
import { hasEvents, parseNavHtml, parseTimetablePage } from './parser';
import type { GroupOption, GroupWeekSchedule, LessonEvent, MetaPayload, WeekOption } from './types';

const BASE_URL = 'https://timetable.dku.kz';
const CACHE_TTL_MS = 15 * 60 * 1000;

interface CacheKV {
	get(key: string): Promise<string | null>;
	put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface RuntimeEnv {
	CACHE?: CacheKV;
}


interface CacheEntry<T> { expiresAt: number; value: T }
const mem = new Map<string, CacheEntry<unknown>>();

async function cached<T>(key: string, kv: CacheKV | undefined, compute: () => Promise<T>): Promise<T> {
	const entry = mem.get(key);
	if (entry && Date.now() <= entry.expiresAt) return entry.value as T;

	if (kv) {
		try {
			const raw = await kv.get(key);
			if (raw) {
				const value = JSON.parse(raw) as T;
				mem.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
				return value;
			}
		} catch { /* miss */ }
	}

	const value = await compute();
	mem.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
	kv?.put(key, JSON.stringify(value), { expirationTtl: Math.ceil(CACHE_TTL_MS / 1000) }).catch(() => {});
	return value;
}


async function fetchText(path: string): Promise<string> {
	const url = `${BASE_URL}/${path}`;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 15_000);
	try {
		const res = await fetch(url, { signal: controller.signal, headers: { 'cache-control': 'no-cache' } });
		if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`);
		return await res.text();
	} finally {
		clearTimeout(timeout);
	}
}


export async function getMeta(env: RuntimeEnv): Promise<MetaPayload> {
	return cached('meta', env.CACHE, async () => {
		const html = await fetchText('frames/navbar.htm');
		const meta = parseNavHtml(html);

		// Pick the latest week to probe groups for events
		const sorted = [...meta.weeks].sort((a, b) => b.startDateIso.localeCompare(a.startDateIso));
		const probeWeek = sorted[0];
		if (!probeWeek) return meta;

		// Fetch all group pages in parallel and keep only groups with events
		const results = await Promise.allSettled(
			meta.groups.map(async (group) => {
				const path = `${probeWeek.value}/c/c${String(group.id).padStart(5, '0')}.htm`;
				const pageHtml = await fetchText(path);
				return { group, active: hasEvents(pageHtml) };
			})
		);

		const activeGroups = results
			.filter((r): r is PromiseFulfilledResult<{ group: GroupOption; active: boolean }> =>
				r.status === 'fulfilled' && r.value.active
			)
			.map((r) => r.value.group);

		return { weeks: meta.weeks, groups: activeGroups };
	});
}

async function getSchedule(env: RuntimeEnv, groupCode: string, weekValue: string): Promise<GroupWeekSchedule> {
	const meta = await getMeta(env);
	const week = meta.weeks.find((w) => w.value === weekValue);
	if (!week) throw new Error(`Unknown week: ${weekValue}`);
	const group = meta.groups.find((g) => g.codeRaw === groupCode || g.codeRu === groupCode);
	if (!group) throw new Error(`Unknown group: ${groupCode}`);

	return cached(`schedule:${week.value}:${group.id}`, env.CACHE, async () => {
		const path = `${week.value}/c/c${String(group.id).padStart(5, '0')}.htm`;
		const parsed = parseTimetablePage(await fetchText(path), group, week);
		return { group, week, events: parsed.events, cohorts: parsed.cohorts };
	});
}

const ASSESSMENT_RE = /\b(экзам|пересдач|зач[её]т|диф\.?\s*зач|коллоквиум|midterm|final|аттест|сесс)\b/i;

function isAssessment(e: LessonEvent): boolean {
	return ASSESSMENT_RE.test(`${e.subjectShortRaw} ${e.subjectFullRaw} ${e.subjectShortRu} ${e.subjectFullRu}`);
}

export async function buildMergedSchedule(
	env: RuntimeEnv,
	groupCode: string,
	weekValue: string,
	selectedCohorts: string[]
): Promise<GroupWeekSchedule> {
	const core = await getSchedule(env, groupCode, weekValue);
	const cohorts = [...core.cohorts].sort((a, b) => a.track.localeCompare(b.track) || a.code.localeCompare(b.code));

	if (selectedCohorts.length === 0) return { ...core, cohorts };

	const selected = new Set(selectedCohorts.map((s) => cleanText(s)));
	const events = core.events.filter(
		(e) => e.scope === 'core_fixed' || isAssessment(e) || (e.cohortCode && selected.has(e.cohortCode))
	);
	return { ...core, events, cohorts };
}

export function buildCalendarTitle(groupCode: string, cohorts: string[]): string {
	return cohorts.length === 0 ? `DKU ${groupCode}` : `DKU ${groupCode} (${cohorts.join(', ')})`;
}


function todayInAlmaty(now: Date): string {
	const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Almaty', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
	const get = (t: string) => p.find((x) => x.type === t)?.value ?? '01';
	return `${get('year')}-${get('month')}-${get('day')}`;
}

export function pickRollingWeeksForCalendar(
	weeks: WeekOption[],
	anchor: string,
	opts: { now?: Date; windowSize?: number } = {}
): WeekOption[] {
	if (weeks.length === 0) return [];
	const sorted = [...weeks].sort((a, b) => a.startDateIso.localeCompare(b.startDateIso));
	const size = Math.max(1, opts.windowSize ?? 2);
	const today = todayInAlmaty(opts.now ?? new Date());

	const anchorIdx = sorted.findIndex((w) => w.value === anchor);
	const anchorDate = anchorIdx >= 0 ? sorted[anchorIdx]!.startDateIso : '';

	const idx = anchorDate > today
		? anchorIdx
		: sorted.reduce((acc, w, i) => (w.startDateIso <= today ? i : acc), 0);

	return sorted.slice(idx, idx + size);
}
