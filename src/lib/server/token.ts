import type { UiLanguage } from './types';

export interface CalendarTokenPayload {
	g: string;
	w: string;
	c: string[];
	l?: UiLanguage;
	exp: number;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

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

async function importHmacKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		'raw',
		textEncoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify']
	);
}

async function signHmac(message: string, key: CryptoKey): Promise<string> {
	const sig = await crypto.subtle.sign('HMAC', key, textEncoder.encode(message));
	return toBase64Url(new Uint8Array(sig));
}

async function verifyHmac(message: string, signature: string, key: CryptoKey): Promise<boolean> {
	let signatureBytes: Uint8Array;
	try {
		signatureBytes = fromBase64Url(signature);
	} catch {
		return false;
	}
	const signatureBuffer = new ArrayBuffer(signatureBytes.byteLength);
	new Uint8Array(signatureBuffer).set(signatureBytes);
	return crypto.subtle.verify('HMAC', key, signatureBuffer, textEncoder.encode(message));
}

export async function signToken(payload: CalendarTokenPayload, secret: string): Promise<string> {
	const body = toBase64Url(textEncoder.encode(JSON.stringify(payload)));
	const key = await importHmacKey(secret);
	return `${body}.${await signHmac(body, key)}`;
}

export async function verifyToken(
	token: string,
	secret: string
): Promise<CalendarTokenPayload | null> {
	const dot = token.indexOf('.');
	if (dot < 1) return null;

	const body = token.slice(0, dot);
	const sig = token.slice(dot + 1);
	const key = await importHmacKey(secret);
	if (!(await verifyHmac(body, sig, key))) return null;

	try {
		const p = JSON.parse(textDecoder.decode(fromBase64Url(body))) as CalendarTokenPayload;
		if (!p.g || !p.w || !Array.isArray(p.c)) return null;
		if (p.l !== undefined && p.l !== 'ru' && p.l !== 'de') return null;
		if (Date.now() / 1000 > p.exp) return null;
		return p;
	} catch {
		return null;
	}
}
