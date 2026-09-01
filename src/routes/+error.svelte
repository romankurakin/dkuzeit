<script lang="ts">
	import { page } from '$app/state';
	import { NETWORK_UNAVAILABLE_CODE } from '$lib/client/network-errors';
	import { m } from '$lib/paraglide/messages';

	function retry(): void {
		window.location.reload();
	}
</script>

<main
	id="main-content"
	class="bg-foreground text-background flex min-h-[calc(100dvh-8rem)] flex-col items-center justify-center p-8 text-center"
>
	{#if page.status === 404}
		<h2 class="brutal-heading">
			{m.not_found_title()}
		</h2>
		<p class="brutal-micro mt-section max-w-md">
			{m.not_found_body()}
		</p>
	{:else if page.error?.code === NETWORK_UNAVAILABLE_CODE}
		<h2 class="brutal-heading">
			{m.network_error_title()}
		</h2>
		<p class="brutal-micro mt-section max-w-md">
			{m.network_error_body()}
		</p>
		<button
			type="button"
			class="brutal-control brutal-hover brutal-focus mt-section border-background bg-background p-control text-foreground cursor-pointer border-[3px] border-solid"
			onclick={retry}
		>
			{m.network_error_retry()}
		</button>
	{:else}
		<h2 class="brutal-heading">
			{m.upstream_down_title()}
		</h2>
		<p class="brutal-micro mt-section max-w-md">
			{page.error?.message ?? m.upstream_down_body()}
		</p>
	{/if}
</main>
