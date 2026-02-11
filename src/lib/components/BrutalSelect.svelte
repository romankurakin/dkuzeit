<script lang="ts">
	import { Select } from 'bits-ui';

	let {
		label,
		value,
		items,
		disabled = false,
		empty = false,
		autofocus = false,
		onValueChange
	}: {
		label: string;
		value: string;
		items: { value: string; label: string }[];
		disabled?: boolean;
		empty?: boolean;
		autofocus?: boolean;
		onValueChange: (v: string) => void;
	} = $props();
</script>

<label class="min-w-44 flex-1">
	<span class="brutal-micro mb-1.5 block">
		{label}
	</span>
	<Select.Root type="single" {value} {onValueChange} {items} {disabled}>
		<Select.Trigger
			data-nav-select
			data-cohort-empty={empty || undefined}
			autofocus={autofocus || undefined}
			class="brutal-border brutal-hover brutal-focus brutal-control p-control flex w-full items-center justify-between disabled:opacity-30"
		>
			<span class="truncate">{items.find((i) => i.value === value)?.label ?? '—'}</span>
			<span aria-hidden="true" class="brutal-micro ml-2">&#9660;</span>
		</Select.Trigger>
		<Select.Portal>
			<Select.Content
				sideOffset={0}
				class="brutal-border bg-background z-50 max-h-64 w-(--bits-select-anchor-width) overflow-y-auto data-[side=bottom]:border-t-0 data-[side=top]:border-b-0"
			>
				{#each items as item (item.value)}
					<Select.Item
						value={item.value}
						label={item.label}
						class="brutal-hover brutal-focus brutal-control p-control data-highlighted:bg-foreground data-highlighted:text-background cursor-pointer"
					>
						{item.label}
					</Select.Item>
				{/each}
			</Select.Content>
		</Select.Portal>
	</Select.Root>
</label>
