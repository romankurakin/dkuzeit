import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	timeout: 30_000,
	retries: 0,
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'webkit', use: { ...devices['Desktop Safari'] } }
	],
	use: {
		baseURL: 'http://localhost:8787'
	},
	webServer: {
		command: 'npm run preview',
		port: 8787,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		env: { VITE_SENTRY_DISABLED: '1' }
	}
});
