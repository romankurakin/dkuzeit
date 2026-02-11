<script lang="ts">
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
</script>

<main
	class="bg-foreground text-background flex min-h-[calc(100dvh-8rem)] flex-col items-center justify-center p-8 text-center"
>
	{#if page.status === 404}
		<h2 class="brutal-heading">
			{m.not_found_title()}
		</h2>
		<p class="brutal-micro mt-section max-w-md">
			{m.not_found_body()}
		</p>
	{:else}
		<h2 class="brutal-heading">
			{m.upstream_down_title()}
		</h2>
		<p class="brutal-micro mt-section max-w-md">
			{page.error?.message ?? m.upstream_down_body()}
		</p>
	{/if}
</main>
