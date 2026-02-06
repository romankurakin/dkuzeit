// Workaround: @inlang/paraglide-js@2.10.0 ships .d.ts files that reference
// non-existent ../../src/ paths, breaking type resolution.
declare module '@inlang/paraglide-js' {
	import type { Plugin } from 'vite';

	interface ParaglideOptions {
		project: string;
		outdir: string;
		strategy?: string[];
		disableAsyncLocalStorage?: boolean;
	}

	export function paraglideVitePlugin(options: ParaglideOptions): Plugin | Plugin[];
}
