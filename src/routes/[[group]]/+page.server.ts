import { error, redirect } from '@sveltejs/kit';
import { localizeHref } from '$lib/paraglide/runtime';
import { buildMergedSchedule, getMeta } from '$lib/server/dku';
import { todayInAlmaty } from '$lib/server/time';
import { resolveGroup, resolveWeek, groupSlug } from '$lib/server/resolve';
import type { Cohort, LessonEvent } from '$lib/server/types';
import {
	cohortsSelectionCookie,
	getServerCookieValue,
	groupSelectionCookie,
	setServerCookieIfChanged,
	weekSelectionCookie
} from '$lib/persistence/selection-cookies';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, setHeaders, cookies }) => {
	const meta = await getMeta();
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
		error?: boolean;
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
		const merged = await buildMergedSchedule(groupCode, weekValue, [], meta);
		return {
			todayIso,
			meta: metaPayload,
			schedule: {
				events: merged.events,
				cohorts: merged.cohorts,
				resolvedGroup: groupCode,
				resolvedWeek: weekValue,
				selectedCohortsCsv: rememberedCohortsCsv,
				error: false
			}
		};
	} catch {
		return {
			todayIso,
			meta: metaPayload,
			schedule: {
				...emptySchedule,
				error: true
			}
		};
	}
};
