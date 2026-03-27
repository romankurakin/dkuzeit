import * as Sentry from '@sentry/sveltekit';

type AttrValue = boolean | number | string;
type Attrs = Record<string, AttrValue>;

export function traceSpan<T>(name: string, op: string, attributes: Attrs, fn: () => Promise<T>) {
	return Sentry.startSpan({ name, op, attributes }, fn);
}

export function traceCacheGet<T>(
	key: string,
	fn: (setHit: (hit: boolean) => void) => Promise<T>
): Promise<T> {
	const name =
		key === 'meta' ? 'meta cache' : key.startsWith('schedule:') ? 'schedule cache' : 'cache';
	return Sentry.startSpan({ name, op: 'cache.get', attributes: { 'cache.key': [key] } }, (span) =>
		fn((hit) => span.setAttribute('cache.hit', hit))
	);
}
