<script lang="ts">
	import { Select } from 'bits-ui';

	interface SelectItem {
		value: string;
		label: string;
	}

	let {
		label,
		value,
		items,
		disabled = false,
		onChange
	}: {
		label: string;
		value: string;
		items: SelectItem[];
		disabled?: boolean;
		onChange: (value: string) => void | Promise<void>;
	} = $props();

	const selected = $derived(items.find((item) => item.value === value));
</script>

<label>
	<span>{label}</span>
	<Select.Root type="single" {value} onValueChange={onChange} {items} {disabled}>
		<Select.Trigger class="flex w-full items-center justify-between border p-2">
			<span>{selected?.label ?? label}</span>
			<span aria-hidden="true">▾</span>
		</Select.Trigger>
		<Select.Portal>
			<Select.Content sideOffset={4} class="z-50 w-(--bits-select-anchor-width) border bg-white">
				<Select.Viewport class="max-h-64 overflow-y-auto">
					{#each items as item (item.value)}
						<Select.Item value={item.value} label={item.label} class="p-2">
							{item.label}
						</Select.Item>
					{/each}
				</Select.Viewport>
			</Select.Content>
		</Select.Portal>
	</Select.Root>
</label>
