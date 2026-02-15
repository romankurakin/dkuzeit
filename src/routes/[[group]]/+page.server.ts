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
	const metaPayload = { groups: meta.groups, weeks: meta.weeks, resolvedWeek: weekValue };
	const emptySchedule: {
		events: LessonEvent[];
		cohorts: Cohort[];
		resolvedGroup: string;
		resolvedWeek: string;
		error?: boolean;
	} = { events: [], cohorts: [], resolvedGroup: groupCode, resolvedWeek: weekValue };

	if (!groupCode || !weekValue) {
		setHeaders({ 'cache-control': 'private, no-store' });
		return {
			todayIso,
			meta: metaPayload,
			schedule: emptySchedule
		};
	}

	try {
		const merged = await buildMergedSchedule(groupCode, weekValue, [], meta);
		setHeaders({ 'cache-control': CLIENT_CACHE_HEADER });
		return {
			todayIso,
			meta: metaPayload,
			schedule: {
				events: merged.events,
				cohorts: merged.cohorts,
				resolvedGroup: groupCode,
				resolvedWeek: weekValue,
				error: false
			}
		};
	} catch {
		setHeaders({ 'cache-control': 'private, no-store' });
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
