<script lang="ts">
	import '../app.css';
	import { m } from '$lib/paraglide/messages';
	import { getLocale, setLocale } from '$lib/paraglide/runtime';
	import { ToggleGroup } from 'bits-ui';

	let { children } = $props();

	const currentLocale = $derived(getLocale());

	function handleLocaleChange(value: string | undefined) {
		if (value && value !== currentLocale) {
			setLocale(value as 'ru' | 'de');
		}
	}
</script>

<svelte:head>
	<meta name="theme-color" content="#000000" />
	<link rel="icon" href="/favicon.ico" sizes="32x32" />
	<link rel="icon" href="/icon.svg" type="image/svg+xml" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<link rel="manifest" href="/manifest.webmanifest" />
</svelte:head>

<div class="mx-auto max-w-screen-2xl space-y-0 p-4">
	<header class="mb-6 flex items-center justify-between brutal-border-b pb-4">
		<span class="text-sm font-bold tracking-widest uppercase">{m.app_title()}</span>
		<nav aria-label={m.language_switch_label()}>
			<ToggleGroup.Root
				type="single"
				value={currentLocale}
				onValueChange={handleLocaleChange}
				class="brutal-border inline-flex"
			>
				<ToggleGroup.Item
					value="ru"
					class="brutal-micro brutal-hover px-3 py-1.5 data-[state=on]:bg-black data-[state=on]:text-white"
				>
					RU
				</ToggleGroup.Item>
				<ToggleGroup.Item
					value="de"
					class="brutal-micro brutal-hover brutal-border-l px-3 py-1.5 data-[state=on]:bg-black data-[state=on]:text-white"
				>
					DE
				</ToggleGroup.Item>
			</ToggleGroup.Root>
		</nav>
	</header>

	{@render children()}
</div>
