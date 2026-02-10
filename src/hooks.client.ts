import * as Sentry from '@sentry/sveltekit';
import { sentryConfig } from '$lib/sentry';

Sentry.init(sentryConfig);

export const handleError = Sentry.handleErrorWithSentry();
