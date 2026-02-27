import { error, redirect } from '@sveltejs/kit';
import { localizeHref } from '$lib/paraglide/runtime';
import { buildMergedSchedule, getMeta, CLIENT_CACHE_HEADER } from '$lib/server/dku';
import { todayInAlmaty } from '$lib/server/time';
import { resolveGroup, resolveWeek, groupSlug } from '$lib/server/resolve';
import type { Cohort, LessonEvent } from '$lib/server/types';
import type { PageServerLoad } from './$types';

const GROUP_COOKIE_NAME = 'dku_group';
// 1 year
const GROUP_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const load: PageServerLoad = async ({ params, url, setHeaders, cookies }) => {
	const meta = await getMeta();

	// 301 redirect old ?group= query param to path
	const qGroup = url.searchParams.get('group');
	if (qGroup) {
		const g = resolveGroup(meta.groups, qGroup);
		if (!g) {
			throw error(404, 'Requested group was not found');
		}
		cookies?.set(GROUP_COOKIE_NAME, g, {
			path: '/',
			sameSite: 'lax',
			maxAge: GROUP_COOKIE_MAX_AGE,
			secure: url.protocol === 'https:'
		});
		const slug = groupSlug(meta.groups, g);
		const rest = new URLSearchParams(url.searchParams);
		rest.delete('group');
		const qs = rest.toString();
		redirect(301, localizeHref(`/${slug}${qs ? `?${qs}` : ''}`));
	}

	// Restore last selected group when opening root path (e.g. PWA start_url)
	const rememberedGroupRaw = cookies?.get(GROUP_COOKIE_NAME) ?? '';
	if (!params.group && rememberedGroupRaw) {
		const rememberedGroup = resolveGroup(meta.groups, rememberedGroupRaw);
		if (rememberedGroup) {
			const slug = groupSlug(meta.groups, rememberedGroup);
			redirect(302, localizeHref(`/${slug}${url.search}`));
		}
	}

	// Resolve group from path, week from query param
	// Unknown group slugs must return 404 to avoid expensive schedule work
	const groupCode = resolveGroup(meta.groups, params.group ?? '');
	const weekValue = resolveWeek(meta.weeks, url.searchParams.get('week') ?? '');

	if (params.group && !groupCode) {
		throw error(404, 'Requested group was not found');
	}

	if (params.group && groupCode) {
		cookies?.set(GROUP_COOKIE_NAME, groupCode, {
			path: '/',
			sameSite: 'lax',
			maxAge: GROUP_COOKIE_MAX_AGE,
			secure: url.protocol === 'https:'
		});
	}

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
