import type { UiLanguage } from './types';

export interface CalendarTokenPayload {
	g: string;
	w: string;
	c: string[];
	l?: UiLanguage;
	exp: number;
}

function toBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
	const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

async function hmac(message: string, secret: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
	return toBase64Url(new Uint8Array(sig));
}

export async function signToken(payload: CalendarTokenPayload, secret: string): Promise<string> {
	const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
	return `${body}.${await hmac(body, secret)}`;
}

export async function verifyToken(token: string, secret: string): Promise<CalendarTokenPayload | null> {
	const dot = token.indexOf('.');
	if (dot < 1) return null;

	const body = token.slice(0, dot);
	const sig = token.slice(dot + 1);
	if (sig !== await hmac(body, secret)) return null;

	try {
		const p = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as CalendarTokenPayload;
		if (!p.g || !p.w || !Array.isArray(p.c)) return null;
		if (p.l !== undefined && p.l !== 'ru' && p.l !== 'de') return null;
		if (Date.now() / 1000 > p.exp) return null;
		return p;
	} catch {
		return null;
	}
}
