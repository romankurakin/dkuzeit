<script lang="ts">
	import SelectField from './SelectField.svelte';

	interface SelectItem {
		value: string;
		label: string;
	}

	interface CohortGroup {
		label: string;
		value: string;
		items: SelectItem[];
	}

	let {
		groupLabel,
		weekLabel,
		groupValue,
		weekValue,
		groupItems,
		weekItems,
		cohortGroups,
		isDisabled = false,
		isLoading = false,
		onGroupChange,
		onWeekChange,
		onCohortChange
	}: {
		groupLabel: string;
		weekLabel: string;
		groupValue: string;
		weekValue: string;
		groupItems: SelectItem[];
		weekItems: SelectItem[];
		cohortGroups: CohortGroup[];
		isDisabled?: boolean;
		isLoading?: boolean;
		onGroupChange: (value: string) => void | Promise<void>;
		onWeekChange: (value: string) => void | Promise<void>;
		onCohortChange: (trackCategory: string, value: string) => void | Promise<void>;
	} = $props();
</script>

<section class="space-y-2">
	<SelectField
		label={groupLabel}
		value={groupValue}
		items={groupItems}
		disabled={isDisabled || isLoading}
		onChange={onGroupChange}
	/>

	{#each cohortGroups as cg (cg.label)}
		<SelectField
			label={cg.label}
			value={cg.value}
			items={cg.items}
			disabled={isDisabled || isLoading}
			onChange={(value) => onCohortChange(cg.label, value)}
		/>
	{/each}

	<SelectField
		label={weekLabel}
		value={weekValue}
		items={weekItems}
		disabled={isDisabled || isLoading}
		onChange={onWeekChange}
	/>
</section>
