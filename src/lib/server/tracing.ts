import { recordCacheAccess } from './metrics';

type AttrValue = boolean | number | string;
type Attrs = Record<string, AttrValue | string[]>;

export interface NativeTraceSpan {
	setAttribute(key: string, value: AttrValue): void;
}

export interface NativeTracing {
	enterSpan<T>(name: string, callback: (span: NativeTraceSpan) => T): T;
}

export interface TraceSpan {
	setAttribute(key: string, value: AttrValue): void;
}

export function traceSpan<T>(
	name: string,
	op: string,
	attributes: Attrs,
	fn: (span: TraceSpan) => Promise<T>,
	nativeTracing?: NativeTracing
) {
	if (!nativeTracing) return fn({ setAttribute() {} });
	return nativeTracing.enterSpan(name, (cloudflareSpan) => {
		for (const [key, value] of Object.entries(attributes)) {
			cloudflareSpan.setAttribute(key, Array.isArray(value) ? value.join(',') : value);
		}
		cloudflareSpan.setAttribute('code.operation', op);
		return fn(cloudflareSpan);
	});
}

export function traceCacheGet<T>(
	key: string,
	fn: (setHit: (hit: boolean) => void) => Promise<T>,
	nativeTracing?: NativeTracing
): Promise<T> {
	const name =
		key === 'meta' ? 'meta cache' : key.startsWith('schedule:') ? 'schedule cache' : 'cache';
	return traceSpan(
		name,
		'cache.get',
		{ 'cache.key': [key] },
		(span) =>
			fn((hit) => {
				span.setAttribute('cache.hit', hit);
				recordCacheAccess(key, hit);
			}),
		nativeTracing
	);
}
