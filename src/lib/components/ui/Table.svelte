<script lang="ts">
import type { Snippet } from "svelte";

interface Properties {
	head: Snippet;
	body: Snippet;
	label: string;
	minimumWidth?: string;
	class?: string;
}

let {
	head,
	body,
	label,
	minimumWidth = "44rem",
	class: className = "",
}: Properties = $props();
</script>

<div class={`overflow-x-auto ${className}`}>
	<table
		class="w-full border-collapse text-left"
		style={`min-width: ${minimumWidth}`}
		aria-label={label}
	>
		<thead
			class="border-y border-line/65 bg-canvas/32 text-[0.66rem] uppercase tracking-[0.1em] text-muted"
		>
			{@render head()}
		</thead>
		<tbody class="divide-y divide-line/55">
			{@render body()}
		</tbody>
	</table>
</div>
