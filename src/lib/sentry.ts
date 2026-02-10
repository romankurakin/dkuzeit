import { dev } from '$app/environment';

export const sentryConfig = {
	dsn: 'https://2b9222adeea60d9dbaef826f52937788@o4510862703722496.ingest.us.sentry.io/4510862792589312',
	tracesSampleRate: 0.05,
	enabled: !dev && !import.meta.env.VITE_SENTRY_DISABLED
} as const;
