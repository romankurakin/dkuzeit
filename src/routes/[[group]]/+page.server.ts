import { error, redirect } from '@sveltejs/kit';
import { m } from '#lib/paraglide/messages.js';
import { localizeHref } from '#lib/paraglide/runtime.js';
import { buildMergedSchedule, getMeta } from '#lib/server/dku.ts';
import { recordUpstreamUnavailable } from '#lib/server/metrics.ts';
import { todayInAlmaty } from '#lib/server/time.ts';
import { resolveGroup, resolveWeek, groupSlug } from '#lib/server/resolve.ts';
import type { Cohort, LessonEvent } from '#lib/server/types.ts';
import {
	cohortsSelectionCookie,
	getServerCookieValue,
	groupSelectionCookie,
	setServerCookieIfChanged,
	weekSelectionCookie
} from '#lib/persistence/selection-cookies.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, setHeaders, cookies, locals }) => {
	let meta: Awaited<ReturnType<typeof getMeta>>;
	try {
		meta = await getMeta(locals?.dkuRequest);
	} catch {
		setHeaders({ 'cache-control': 'private, no-store' });
		recordUpstreamUnavailable('meta');
		error(503, m.upstream_down_body());
	}
	const stateQueryKeys = ['group', 'week', 'cohorts'] as const;
	if (stateQueryKeys.some((key) => url.searchParams.has(key))) {
		const rest = new URLSearchParams(url.searchParams);
		for (const key of stateQueryKeys) {
			rest.delete(key);
		}
		const base = localizeHref(`/${params.group ?? ''}`);
		const qs = rest.toString();
		redirect(301, `${base}${qs ? `?${qs}` : ''}`);
	}

	// Restore last selected group when opening root path (e.g. PWA start_url)
	const rememberedGroupRaw = getServerCookieValue(cookies, groupSelectionCookie);
	if (!params.group && rememberedGroupRaw) {
		const rememberedGroup = resolveGroup(meta.groups, rememberedGroupRaw);
		if (rememberedGroup) {
			const slug = groupSlug(meta.groups, rememberedGroup);
			const qs = url.searchParams.toString();
			redirect(302, localizeHref(`/${slug}${qs ? `?${qs}` : ''}`));
		}
	}

	// Resolve group from path.
	// Unknown group slugs must return 404 to avoid expensive schedule work
	const groupCode = resolveGroup(meta.groups, params.group ?? '');

	if (params.group && !groupCode) {
		throw error(404, 'Requested group was not found');
	}

	if (params.group && groupCode) {
		setServerCookieIfChanged(cookies, url, groupSelectionCookie, groupCode);
	}

	// Canonical redirect if group slug mismatch
	const slug = groupSlug(meta.groups, groupCode);
	if (params.group && params.group !== slug) {
		redirect(301, localizeHref(`/${slug}${url.search}`));
	}

	const rememberedCohortsCsv = getServerCookieValue(cookies, cohortsSelectionCookie);
	const rememberedWeekRaw = getServerCookieValue(cookies, weekSelectionCookie);
	const weekValue = resolveWeek(meta.weeks, rememberedWeekRaw);
	if (rememberedWeekRaw && rememberedWeekRaw !== weekValue) {
		setServerCookieIfChanged(cookies, url, weekSelectionCookie, weekValue);
	}

	setHeaders({ 'cache-control': 'private, no-store' });
	const todayIso = todayInAlmaty();
	const metaPayload = { groups: meta.groups, weeks: meta.weeks, resolvedWeek: weekValue };
	const emptySchedule: {
		events: LessonEvent[];
		cohorts: Cohort[];
		resolvedGroup: string;
		resolvedWeek: string;
		selectedCohortsCsv: string;
	} = {
		events: [],
		cohorts: [],
		resolvedGroup: groupCode,
		resolvedWeek: weekValue,
		selectedCohortsCsv: rememberedCohortsCsv
	};

	if (!groupCode || !weekValue) {
		return {
			todayIso,
			meta: metaPayload,
			schedule: emptySchedule
		};
	}

	try {
		const merged = await buildMergedSchedule(groupCode, weekValue, [], {
			meta,
			request: locals?.dkuRequest
		});
		return {
			todayIso,
			meta: metaPayload,
			schedule: {
				events: merged.events,
				cohorts: merged.cohorts,
				resolvedGroup: groupCode,
				resolvedWeek: weekValue,
				selectedCohortsCsv: rememberedCohortsCsv
			}
		};
	} catch {
		recordUpstreamUnavailable('schedule');
		error(503, m.upstream_down_body());
	}
};
