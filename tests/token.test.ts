import { describe, expect, it } from 'vitest';
import { signToken, verifyToken } from '../src/lib/server/token';

const SECRET = 'test-secret';

describe('calendar token', () => {
	it('signs and verifies a valid token', async () => {
		const token = await signToken(
			{ g: '2-CS', w: '05', c: ['D2'], exp: Math.floor(Date.now() / 1000) + 3600 },
			SECRET
		);

		const payload = await verifyToken(token, SECRET);
		expect(payload).toEqual({ g: '2-CS', w: '05', c: ['D2'], exp: expect.any(Number) });
	});

	it('rejects expired tokens', async () => {
		const token = await signToken(
			{ g: '2-CS', w: '05', c: [], exp: Math.floor(Date.now() / 1000) - 10 },
			SECRET
		);

		expect(await verifyToken(token, SECRET)).toBeNull();
	});

	it('rejects token signed with a different secret', async () => {
		const token = await signToken(
			{ g: '2-CS', w: '05', c: [], exp: Math.floor(Date.now() / 1000) + 3600 },
			SECRET
		);

		expect(await verifyToken(token, 'wrong-secret')).toBeNull();
	});

	it('rejects malformed input', async () => {
		expect(await verifyToken('', SECRET)).toBeNull();
		expect(await verifyToken('garbage', SECRET)).toBeNull();
		expect(await verifyToken('a.b.c', SECRET)).toBeNull();
	});

	it('preserves language field in round-trip', async () => {
		const token = await signToken(
			{ g: '1-CS', w: '06', c: ['D1'], l: 'de', exp: Math.floor(Date.now() / 1000) + 3600 },
			SECRET
		);

		const payload = await verifyToken(token, SECRET);
		expect(payload?.l).toBe('de');
	});
});
