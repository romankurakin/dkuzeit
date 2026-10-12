import * as Sentry from '@sentry/sveltekit';

type SourceKind = 'meta' | 'other' | 'schedule';

function cacheKind(key: string): SourceKind {
	if (key === 'meta') return 'meta';
	if (key.startsWith('schedule:')) return 'schedule';
	return 'other';
}

export function recordCacheAccess(key: string, hit: boolean, stale = false): void {
	Sentry.metrics.count('dku.cache.access', 1, {
		attributes: {
			'cache.kind': cacheKind(key),
			'cache.result': stale ? 'stale' : hit ? 'hit' : 'miss'
		}
	});
}

export function recordCalendarSubscription(locale: 'de' | 'ru'): void {
	Sentry.metrics.count('dku.calendar.subscription', 1, {
		attributes: { 'ui.locale': locale }
	});
}

export function recordUpstreamUnavailable(kind: Exclude<SourceKind, 'other'>): void {
	Sentry.metrics.count('dku.upstream.unavailable', 1, {
		attributes: { 'source.kind': kind }
	});
}
