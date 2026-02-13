import { redirect } from '@sveltejs/kit';
import { localizeHref } from '$lib/paraglide/runtime';
import { buildMergedSchedule, getMeta, CLIENT_CACHE_HEADER } from '$lib/server/dku';
import { todayInAlmaty } from '$lib/server/time';
import { resolveGroup, resolveWeek, groupSlug } from '$lib/server/resolve';
import type { Cohort, LessonEvent } from '$lib/server/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, setHeaders }) => {
	const meta = await getMeta();

	// 301 redirect old ?group= query param to path
	const qGroup = url.searchParams.get('group');
	if (qGroup) {
		const g = resolveGroup(meta.groups, qGroup);
		const slug = groupSlug(meta.groups, g);
		const rest = new URLSearchParams(url.searchParams);
		rest.delete('group');
		const qs = rest.toString();
		redirect(301, localizeHref(`/${slug}${qs ? `?${qs}` : ''}`));
	}

	// Resolve group from path, week from query param
	const groupCode = resolveGroup(meta.groups, params.group ?? '');
	const weekValue = resolveWeek(meta.weeks, url.searchParams.get('week') ?? '');

	// Canonical redirect if group slug mismatch
	const slug = groupSlug(meta.groups, groupCode);
	if (params.group && params.group !== slug) {
		redirect(301, localizeHref(`/${slug}${url.search}`));
	}

	const todayIso = todayInAlmaty();
	let cacheControl = CLIENT_CACHE_HEADER;
	if (!groupCode || !weekValue) {
		cacheControl = 'private, no-store';
		setHeaders({ 'cache-control': cacheControl });
		return {
			todayIso,
			meta: { groups: meta.groups, weeks: meta.weeks, resolvedWeek: weekValue },
			schedule: {
				events: [],
				cohorts: [],
				resolvedGroup: groupCode,
				resolvedWeek: weekValue
			}
		};
	}

	let events: LessonEvent[] = [];
	let cohorts: Cohort[] = [];
	try {
		const merged = await buildMergedSchedule(groupCode, weekValue, [], meta);
		events = merged.events;
		cohorts = merged.cohorts;
	} catch {
		cacheControl = 'private, no-store';
		setHeaders({ 'cache-control': cacheControl });
		return {
			todayIso,
			meta: { groups: meta.groups, weeks: meta.weeks, resolvedWeek: weekValue },
			schedule: {
				events: [],
				cohorts: [],
				resolvedGroup: groupCode,
				resolvedWeek: weekValue,
				error: true
			}
		};
	}
	setHeaders({ 'cache-control': cacheControl });
	return {
		todayIso,
		meta: { groups: meta.groups, weeks: meta.weeks, resolvedWeek: weekValue },
		schedule: {
			events,
			cohorts,
			resolvedGroup: groupCode,
			resolvedWeek: weekValue,
			error: false
		}
	};
};
