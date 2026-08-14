import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	timeout: 30_000,
	retries: 0,
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'firefox', use: { ...devices['Desktop Firefox'] } },
		{ name: 'webkit', use: { ...devices['Desktop Safari'] } }
	],
	use: {
		baseURL: 'http://localhost:8787'
	},
	// The worker runs with wrangler's e2e environment
	// (see wrangler.toml [env.e2e]), which points the upstream at the committed
	// fixture snapshot and pins the clock inside the snapshot's week range.
	webServer: [
		{
			command: 'npm run fixtures:serve',
			port: 8788,
			reuseExistingServer: !process.env.CI,
			timeout: 30_000
		},
		{
			command: 'npm run preview:e2e',
			port: 8787,
			reuseExistingServer: !process.env.CI,
			timeout: 120_000,
			env: { VITE_SENTRY_DISABLED: '1' }
		}
	]
});
