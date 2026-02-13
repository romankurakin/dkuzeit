<script lang="ts">
	import { ScrollArea, Select } from 'bits-ui';

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

<label class="control-field">
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
			<span
				aria-hidden="true"
				class="pixel-icon-control pixel-icon-mask ml-2"
				style="--pixel-icon: url('/icons/pixel-chevron-down.svg')"
			></span>
		</Select.Trigger>
		<Select.Portal>
			<Select.Content
				sideOffset={0}
				class="brutal-border bg-background z-50 w-(--bits-select-anchor-width) data-[side=bottom]:border-t-0 data-[side=top]:border-b-0"
			>
				<ScrollArea.Root type="auto" class="relative max-h-64">
					<ScrollArea.Viewport class="max-h-64">
						{#each items as item (item.value)}
							<Select.Item
								value={item.value}
								label={item.label}
								class="brutal-hover brutal-focus brutal-control p-control data-highlighted:bg-hover data-highlighted:text-background cursor-pointer"
							>
								{item.label}
							</Select.Item>
						{/each}
					</ScrollArea.Viewport>
					<ScrollArea.Scrollbar orientation="vertical" class="brutal-scrollbar-rail">
						<ScrollArea.Thumb class="brutal-scrollbar-thumb" />
					</ScrollArea.Scrollbar>
				</ScrollArea.Root>
			</Select.Content>
		</Select.Portal>
	</Select.Root>
</label>

<style>
	.control-field {
		flex: 1 1 max(var(--size-control-min), calc(var(--size-time-column) * 2));
		min-width: min(100%, var(--size-control-min));
		max-width: 100%;
	}

	:global([data-nav-select][data-state='open'] .pixel-icon-control),
	:global([data-nav-select][aria-expanded='true'] .pixel-icon-control) {
		transform: rotate(180deg);
	}
</style>
