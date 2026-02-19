import { describe, expect, it } from 'vitest';
import {
	badRequestProblem,
	forbiddenProblem,
	internalErrorProblem,
	notFoundProblem,
	serviceUnavailableProblem
} from '../../src/lib/server/problem';

async function readProblem(response: Response) {
	return (await response.json()) as {
		type: string;
		title: string;
		status: number;
		detail?: string;
		instance?: string;
	};
}

describe('problem responses', () => {
	it('build not-found problem response', async () => {
		const response = notFoundProblem('missing resource', '/api/schedule');
		expect(response.status).toBe(404);
		expect(response.headers.get('content-type')).toContain('application/problem+json');
		expect(await readProblem(response)).toEqual({
			type: 'about:blank',
			title: 'Not Found',
			status: 404,
			detail: 'missing resource',
			instance: '/api/schedule'
		});
	});

	it('build bad-request problem response with defaults', async () => {
		const response = badRequestProblem();
		expect(response.status).toBe(400);
		expect(await readProblem(response)).toEqual({
			type: 'about:blank',
			title: 'Bad Request',
			status: 400,
			detail: 'Bad request'
		});
	});

	it('build forbidden problem response', async () => {
		const response = forbiddenProblem('Invalid token', '/api/calendar');
		expect(response.status).toBe(403);
		expect(response.headers.get('content-type')).toContain('application/problem+json');
		expect(await readProblem(response)).toEqual({
			type: 'about:blank',
			title: 'Forbidden',
			status: 403,
			detail: 'Invalid token',
			instance: '/api/calendar'
		});
	});

	it('build internal-error problem response', async () => {
		const response = internalErrorProblem('Server misconfigured', '/api/token');
		expect(response.status).toBe(500);
		expect(response.headers.get('content-type')).toContain('application/problem+json');
		expect(await readProblem(response)).toEqual({
			type: 'about:blank',
			title: 'Internal Server Error',
			status: 500,
			detail: 'Server misconfigured',
			instance: '/api/token'
		});
	});

	it('build service-unavailable problem response', async () => {
		const response = serviceUnavailableProblem('upstream failed', '/api/calendar');
		expect(response.status).toBe(503);
		expect(await readProblem(response)).toEqual({
			type: 'about:blank',
			title: 'Service Unavailable',
			status: 503,
			detail: 'upstream failed',
			instance: '/api/calendar'
		});
	});
});
