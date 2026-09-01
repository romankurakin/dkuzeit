export const NETWORK_UNAVAILABLE_CODE = 'NETWORK_UNAVAILABLE' as const;

const NETWORK_FETCH_ERROR_MESSAGES = new Set([
	'Failed to fetch',
	'Load failed',
	'NetworkError when attempting to fetch resource.'
]);

type ErrorLike = {
	message: string;
	name: string;
};

function isErrorLike(error: unknown): error is ErrorLike {
	return (
		typeof error === 'object' &&
		error !== null &&
		'name' in error &&
		typeof error.name === 'string' &&
		'message' in error &&
		typeof error.message === 'string'
	);
}

export function isNetworkFetchError(error: unknown): boolean {
	if (!isErrorLike(error) || error.name === 'AbortError') return false;

	return (
		(error instanceof TypeError || error.name === 'TypeError') &&
		NETWORK_FETCH_ERROR_MESSAGES.has(error.message)
	);
}
