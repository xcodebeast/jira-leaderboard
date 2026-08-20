<script lang="ts">
export interface Segment {
	value: string;
	label: string;
	detail?: string;
}

interface Properties {
	segments: Segment[];
	value?: string;
	onChange?: (value: string) => void;
	label: string;
	class?: string;
}

let {
	segments,
	value = $bindable(""),
	onChange,
	label,
	class: className = "",
}: Properties = $props();

function selectSegment(selectedValue: string): void {
	value = selectedValue;
	onChange?.(selectedValue);
}
</script>

<fieldset
	class={`inline-flex rounded-[0.95rem] border border-line bg-canvas/45 p-1 ${className}`}
>
	<legend class="screen-reader-only">{label}</legend>
	{#each segments as segment (segment.value)}
		<button
			class="rounded-[0.7rem] px-3.5 py-2 text-left transition-colors sm:px-4"
			class:bg-panel-soft={value === segment.value}
			class:text-ice={value === segment.value}
			class:text-muted={value !== segment.value}
			type="button"
			aria-pressed={value === segment.value}
			onclick={() => selectSegment(segment.value)}
		>
			<span class="block text-xs font-extrabold sm:text-sm"
				>{segment.label}</span
			>
			{#if segment.detail}
				<span
					class="mt-0.5 hidden text-[0.64rem] font-medium opacity-75 sm:block"
				>
					{segment.detail}
				</span>
			{/if}
		</button>
	{/each}
</fieldset>
