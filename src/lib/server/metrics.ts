import * as Sentry from '@sentry/sveltekit';

type SourceKind = 'meta' | 'other' | 'schedule';

function sourceKind(path: string): SourceKind {
	if (path === 'frames/navbar.htm') return 'meta';
	if (/^\d+\/c\/c\d+\.htm$/.test(path)) return 'schedule';
	return 'other';
}

function cacheKind(key: string): SourceKind {
	if (key === 'meta') return 'meta';
	if (key.startsWith('schedule:')) return 'schedule';
	return 'other';
}

export function recordCacheAccess(key: string, hit: boolean): void {
	Sentry.metrics.count('dku.cache.access', 1, {
		attributes: {
			'cache.kind': cacheKind(key),
			'cache.result': hit ? 'hit' : 'miss'
		}
	});
}

export function recordHtmlInputBytes(path: string, inputBytes: number): void {
	Sentry.metrics.distribution('dku.html.input_bytes', inputBytes, {
		unit: 'byte',
		attributes: {
			'html.parser': 'htmlparser2',
			'source.kind': sourceKind(path)
		}
	});
}

export function recordTimetableOutput(eventCount: number, cohortCount: number): void {
	const attributes = { 'source.kind': 'schedule' };
	Sentry.metrics.distribution('dku.timetable.events', eventCount, { attributes });
	Sentry.metrics.distribution('dku.timetable.cohorts', cohortCount, { attributes });
}

export function recordCalendarSubscription(locale: 'de' | 'ru'): void {
	Sentry.metrics.count('dku.calendar.subscription', 1, {
		attributes: { 'ui.locale': locale }
	});
}
