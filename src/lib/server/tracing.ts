import * as Sentry from '@sentry/sveltekit';

type Attrs = Record<string, string | number>;

export function traceFn<T>(name: string, attributes: Attrs, fn: () => T | Promise<T>) {
	return Sentry.startSpan({ name, op: 'function', attributes }, fn);
}

export function traceSerialize<T>(name: string, attributes: Attrs, fn: () => T) {
	return Sentry.startSpan({ name, op: 'serialize', attributes }, fn);
}

export function traceCacheGet<T>(
	key: string,
	fn: (setHit: (hit: boolean) => void) => Promise<T>
): Promise<T> {
	return Sentry.startSpan(
		{ name: key, op: 'cache.get', attributes: { 'cache.key': [key] } },
		(span) => fn((hit) => span.setAttribute('cache.hit', hit))
	);
}
