import * as Sentry from '@sentry/sveltekit';

Sentry.init({
	dsn: 'https://2b9222adeea60d9dbaef826f52937788@o4510862703722496.ingest.us.sentry.io/4510862792589312',
	tracesSampleRate: 0.05
});

export const handleError = Sentry.handleErrorWithSentry();
