import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import vitest from '@vitest/eslint-plugin';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

export default defineConfig(
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		}
	},
	{
		files: ['tests/**/*.test.ts'],
		plugins: {
			vitest
		},
		languageOptions: {
			globals: {
				...vitest.environments.env.globals
			}
		},
		rules: {
			...vitest.configs.recommended.rules
		}
	},
	{
		rules: {
			'svelte/prefer-svelte-reactivity': 'off'
		}
	},
	{
		ignores: [
			'.svelte-kit/',
			'.wrangler/',
			'coverage/',
			'build/',
			'src/lib/paraglide/',
			'src/paraglide/',
			'tests/fixtures/'
		]
	}
);
