const LONG_SELECTION_SECONDS = 60 * 60 * 24 * 180;
const SHORT_WEEK_OVERRIDE_SECONDS = 60 * 60 * 24;

function decodeHtml(value: string): string {
	return value
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function cleanCookieText(input: string): string {
	return decodeHtml(input.replace(/<[^>]*>/g, ' '))
		.replace(/\u00a0/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function normalizeGroup(raw: string | null | undefined): string {
	return cleanCookieText(raw ?? '');
}

function normalizeCohorts(raw: string | null | undefined): string {
	return (raw ?? '')
		.split(',')
		.map((item) => cleanCookieText(item))
		.filter(Boolean)
		.join(',');
}

function safeDecodeURIComponent(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

function readDocumentCookie(name: string): string | undefined {
	if (typeof document === 'undefined') return undefined;
	return document.cookie
		.split('; ')
		.find((entry) => entry.startsWith(`${name}=`))
		?.slice(name.length + 1);
}

type ServerCookieGetter = {
	get: (name: string) => string | undefined;
};

type ServerCookieStore = ServerCookieGetter & {
	set: (
		name: string,
		value: string,
		options: {
			path: string;
			sameSite: 'lax';
			maxAge: number;
			httpOnly: false;
			secure: boolean;
		}
	) => void;
};

export interface SelectionCookieSpec {
	name: string;
	maxAge: number;
	allowEmpty: boolean;
	normalize: (raw: string | null | undefined) => string;
}

export const groupSelectionCookie: SelectionCookieSpec = {
	name: 'dku_group',
	maxAge: LONG_SELECTION_SECONDS,
	allowEmpty: false,
	normalize: normalizeGroup
};

export const cohortsSelectionCookie: SelectionCookieSpec = {
	name: 'dku_cohorts',
	maxAge: LONG_SELECTION_SECONDS,
	allowEmpty: true,
	normalize: normalizeCohorts
};

export const weekSelectionCookie: SelectionCookieSpec = {
	name: 'dku_week',
	maxAge: SHORT_WEEK_OVERRIDE_SECONDS,
	allowEmpty: true,
	normalize: normalizeGroup
};

export function getServerCookieValue(
	cookies: Pick<ServerCookieGetter, 'get'> | undefined,
	spec: SelectionCookieSpec
): string {
	return spec.normalize(safeDecodeURIComponent(cookies?.get(spec.name) ?? ''));
}

export function setServerCookieIfChanged(
	cookies: Pick<ServerCookieStore, 'get' | 'set'> | undefined,
	url: URL,
	spec: SelectionCookieSpec,
	rawValue: string | null | undefined
): void {
	const next = spec.normalize(rawValue);
	if (!spec.allowEmpty && !next) return;
	const current = getServerCookieValue(cookies, spec);
	if (current === next) return;
	cookies?.set(spec.name, next, {
		path: '/',
		sameSite: 'lax',
		maxAge: next ? spec.maxAge : 0,
		httpOnly: false,
		secure: url.protocol === 'https:'
	});
}

export function setClientCookieIfChanged(
	spec: SelectionCookieSpec,
	rawValue: string | null | undefined
): void {
	if (typeof document === 'undefined') return;
	const next = spec.normalize(rawValue);
	if (!spec.allowEmpty && !next) return;
	const currentEncoded = readDocumentCookie(spec.name);
	const current = spec.normalize(
		currentEncoded === undefined ? '' : safeDecodeURIComponent(currentEncoded)
	);
	if (current === next) return;
	const secure =
		typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
	document.cookie = `${spec.name}=${encodeURIComponent(next)}; Max-Age=${next ? spec.maxAge : 0}; Path=/; SameSite=Lax${secure}`;
}
