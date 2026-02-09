import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	timeout: 30_000,
	retries: 0,
	use: {
		baseURL: 'http://localhost:8787'
	},
	webServer: {
		command: 'npm run preview',
		port: 8787,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	}
});
