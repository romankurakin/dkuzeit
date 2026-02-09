import { cleanText } from "./text";
import { parseNavHtml, parseTimetablePage } from "./parser";
import type {
  GroupWeekSchedule,
  LessonEvent,
  MetaPayload,
  WeekOption,
} from "./types";

const BASE_URL = "https://timetable.dku.kz";

// Two-layer TTL: edge cache (Cache API) holds parsed upstream data, HTTP tells browsers/CDN to reuse responses.
// Keep HTTP < edge so clients see updated data soon after the edge cache expires.
// stale-while-revalidate covers the remaining edge window so users never wait.
const EDGE_TTL_SECONDS = 3600;
export const CLIENT_TTL_SECONDS = 600;
const SWR_SECONDS = EDGE_TTL_SECONDS - CLIENT_TTL_SECONDS;
export const CLIENT_CACHE_HEADER = `public, max-age=${CLIENT_TTL_SECONDS}, stale-while-revalidate=${SWR_SECONDS}`;
async function cached<T>(
  key: string,
  compute: () => Promise<T>,
): Promise<T> {
  const cache =
    typeof caches !== "undefined" ? caches.default : null;
  const url = `${BASE_URL}/_cache/${encodeURIComponent(key)}`;

  if (cache) {
    try {
      const hit = await cache.match(url);
      if (hit) return (await hit.json()) as T;
    } catch {
      /* miss */
    }
  }

  const value = await compute();
  cache
    ?.put(
      url,
      new Response(JSON.stringify(value), {
        headers: { "cache-control": `s-maxage=${EDGE_TTL_SECONDS}` },
      }),
    )
    .catch(() => {});
  return value;
}

async function fetchText(path: string): Promise<string> {
  const url = `${BASE_URL}/${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "cache-control": "no-cache" },
    });
    if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

export async function getMeta(): Promise<MetaPayload> {
  return cached("meta", async () => {
    const html = await fetchText("frames/navbar.htm");
    return parseNavHtml(html);
  });
}

async function getSchedule(
  groupCode: string,
  weekValue: string,
): Promise<GroupWeekSchedule> {
  const meta = await getMeta();
  const week = meta.weeks.find((w) => w.value === weekValue);
  if (!week) throw new Error(`Unknown week: ${weekValue}`);
  const group = meta.groups.find(
    (g) => g.codeRaw === groupCode || g.codeRu === groupCode,
  );
  if (!group) throw new Error(`Unknown group: ${groupCode}`);

  return cached(`schedule:${week.value}:${group.id}`, async () => {
    const path = `${week.value}/c/c${String(group.id).padStart(5, "0")}.htm`;
    const parsed = parseTimetablePage(await fetchText(path), group, week);
    return { group, week, events: parsed.events, cohorts: parsed.cohorts };
  });
}

const ASSESSMENT_RE =
  /\b(экзам|пересдач|зач[её]т|диф\.?\s*зач|коллоквиум|midterm|final|аттест|сесс)\b/i;

function isAssessment(e: LessonEvent): boolean {
  return ASSESSMENT_RE.test(
    `${e.subjectShortRaw} ${e.subjectFullRaw} ${e.subjectShortRu} ${e.subjectFullRu}`,
  );
}

export async function buildMergedSchedule(
  groupCode: string,
  weekValue: string,
  selectedCohorts: string[],
): Promise<GroupWeekSchedule> {
  const core = await getSchedule(groupCode, weekValue);
  const cohorts = [...core.cohorts].sort(
    (a, b) => a.track.localeCompare(b.track) || a.code.localeCompare(b.code),
  );

  if (selectedCohorts.length === 0) return { ...core, cohorts };

  const selected = new Set(selectedCohorts.map((s) => cleanText(s)));
  const events = core.events.filter(
    (e) =>
      e.scope === "core_fixed" ||
      isAssessment(e) ||
      (e.cohortCode && selected.has(e.cohortCode)),
  );
  return { ...core, events, cohorts };
}

export function buildCalendarTitle(groupCode: string): string {
  return `DKU ${groupCode}`;
}

function todayInAlmaty(now: Date): string {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Almaty",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "01";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function pickRollingWeeksForCalendar(
  weeks: WeekOption[],
  anchor: string,
  opts: { now?: Date; windowSize?: number } = {},
): WeekOption[] {
  if (weeks.length === 0) return [];
  const sorted = [...weeks].sort((a, b) =>
    a.startDateIso.localeCompare(b.startDateIso),
  );
  const size = Math.max(1, opts.windowSize ?? 2);
  const today = todayInAlmaty(opts.now ?? new Date());

  const anchorIdx = sorted.findIndex((w) => w.value === anchor);
  const anchorDate = anchorIdx >= 0 ? sorted[anchorIdx]!.startDateIso : "";

  const idx =
    anchorDate > today
      ? anchorIdx
      : sorted.reduce((acc, w, i) => (w.startDateIso <= today ? i : acc), 0);

  return sorted.slice(idx, idx + size);
}
