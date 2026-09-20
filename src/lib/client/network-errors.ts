import isNetworkError from 'is-network-error';

export const NETWORK_UNAVAILABLE_CODE = 'NETWORK_UNAVAILABLE' as const;

export { isNetworkError as isNetworkFetchError };
