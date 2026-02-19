type ProblemDetails = {
	type: string;
	title: string;
	status: number;
	detail?: string;
	instance?: string;
};

function problemJson(problem: ProblemDetails): Response {
	return new Response(JSON.stringify(problem), {
		status: problem.status,
		headers: {
			'content-type': 'application/problem+json; charset=utf-8'
		}
	});
}

// Problem Details RFC 9457
export function notFoundProblem(detail: string, instance?: string): Response {
	return problemJson({
		type: 'about:blank',
		title: 'Not Found',
		status: 404,
		detail,
		instance
	});
}

export function badRequestProblem(detail = 'Bad request', instance?: string): Response {
	return problemJson({
		type: 'about:blank',
		title: 'Bad Request',
		status: 400,
		detail,
		instance
	});
}

export function forbiddenProblem(detail = 'Forbidden', instance?: string): Response {
	return problemJson({
		type: 'about:blank',
		title: 'Forbidden',
		status: 403,
		detail,
		instance
	});
}

export function internalErrorProblem(
	detail = 'Internal server error',
	instance?: string
): Response {
	return problemJson({
		type: 'about:blank',
		title: 'Internal Server Error',
		status: 500,
		detail,
		instance
	});
}

export function serviceUnavailableProblem(
	detail = 'Service unavailable',
	instance?: string
): Response {
	return problemJson({
		type: 'about:blank',
		title: 'Service Unavailable',
		status: 503,
		detail,
		instance
	});
}
