import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import vitest from '@vitest/eslint-plugin';
import globals from 'globals';
import ts from 'typescript-eslint';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import svelteConfig from './svelte.config.js';

const svelteFiles = ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'];
const ignoredPaths = [
	'.svelte-kit/',
	'.wrangler/',
	'coverage/',
	'build/',
	'src/lib/paraglide/',
	'src/paraglide/',
	'tests/fixtures/'
];
const browserAndNodeGlobals = {
	...globals.browser,
	...globals.node
};

export default [
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	{
		languageOptions: {
			globals: browserAndNodeGlobals
		}
	},
	{
		files: svelteFiles,
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
		ignores: ignoredPaths
	},
	eslintPluginPrettierRecommended
];
