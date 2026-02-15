import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			$lib: path.resolve(rootDir, 'src/lib')
		}
	},
	test: {
		environment: 'node',
		include: ['tests/**/*.test.ts'],
		setupFiles: ['tests/vitest.setup.ts'],
		testTimeout: 180000,
		coverage: {
			provider: 'v8',
			enabled: false,
			include: ['src/lib/**/*.{ts,js}', 'src/routes/api/**/*.ts', 'src/routes/**/+page.server.ts'],
			exclude: ['src/lib/paraglide/**', '**/*.d.ts'],
			reporter: ['text', 'html', 'json-summary']
		}
	}
});
