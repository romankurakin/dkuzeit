<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
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
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="p-4 space-y-4 max-w-screen-2xl mx-auto">
	<header class="flex items-center justify-between">
		<span>{m.app_title()}</span>
		<nav aria-label={m.language_switch_label()}>
			<ToggleGroup.Root
				type="single"
				value={currentLocale}
				onValueChange={handleLocaleChange}
				class="inline-flex border"
			>
				<ToggleGroup.Item value="ru" class="p-2">
					RU
				</ToggleGroup.Item>
				<ToggleGroup.Item value="de" class="p-2">
					DE
				</ToggleGroup.Item>
			</ToggleGroup.Root>
		</nav>
	</header>

	{@render children()}
</div>
