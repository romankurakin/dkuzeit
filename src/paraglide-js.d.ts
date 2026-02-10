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
