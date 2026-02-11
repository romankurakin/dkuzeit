<script lang="ts">
	import '../app.css';
	import { tick } from 'svelte';
	import { Toaster } from 'svelte-sonner';
	import { m } from '$lib/paraglide/messages';
	import { getLocale, setLocale } from '$lib/paraglide/runtime';
	import { ToggleGroup } from 'bits-ui';

	let { children } = $props();

	let selectedLocale: string = $derived(getLocale());

	function handleLocaleChange(value: string | undefined) {
		if (value && value !== getLocale()) {
			setLocale(value as 'ru' | 'de');
		} else if (!value) {
			// bits-ui sets value="" on re-click; force it back
			const current = getLocale();
			selectedLocale = '';
			tick().then(() => {
				selectedLocale = current;
			});
		}
	}
</script>

<svelte:head>
	<meta name="theme-color" content="#141414" />
	<link rel="icon" href="/favicon.ico" sizes="32x32" />
	<link rel="icon" href="/icon.svg" type="image/svg+xml" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<link rel="manifest" href="/manifest.webmanifest" />
</svelte:head>

<div class="mx-auto max-w-screen-2xl space-y-0 p-4">
	<header class="mb-section brutal-border-b pb-section flex items-center justify-between">
		<h1 class="text-sm font-bold tracking-widest uppercase">{m.app_title()}</h1>
		<nav aria-label={m.language_switch_label()}>
			<ToggleGroup.Root
				type="single"
				value={selectedLocale}
				onValueChange={handleLocaleChange}
				class="brutal-border brutal-focus-within inline-flex"
			>
				<ToggleGroup.Item
					value="ru"
					class="brutal-control brutal-control-segment brutal-hover brutal-focus-fill data-[state=on]:bg-hover data-[state=on]:text-background p-control"
				>
					RU
				</ToggleGroup.Item>
				<ToggleGroup.Item
					value="de"
					class="brutal-control brutal-control-segment brutal-hover brutal-focus-fill brutal-border-l data-[state=on]:bg-hover data-[state=on]:text-background p-control"
				>
					DE
				</ToggleGroup.Item>
			</ToggleGroup.Root>
		</nav>
	</header>

	{@render children()}
</div>

<Toaster
	position="top-center"
	visibleToasts={1}
	offset="16px"
	successIcon={null}
	errorIcon={null}
	warningIcon={null}
	infoIcon={null}
	toastOptions={{
		unstyled: true,
		classes: {
			toast:
				'brutal-border brutal-control flex items-center gap-3 bg-foreground text-background p-control w-fit left-0 right-0 mx-auto max-w-[calc(100vw-2rem)] whitespace-nowrap overflow-hidden text-ellipsis'
		}
	}}
/>
