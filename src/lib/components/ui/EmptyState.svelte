<script lang="ts">
import type { Snippet } from "svelte";

interface Properties {
	title: string;
	description: string;
	symbol?: string;
	action?: Snippet;
	class?: string;
}

let {
	title,
	description,
	symbol = "✦",
	action,
	class: className = "",
}: Properties = $props();
</script>

<div class={`px-6 py-14 text-center ${className}`}>
	<span
		class="mx-auto grid size-11 place-items-center rounded-full border border-brand/25 bg-brand/8 text-lg text-brand"
		aria-hidden="true"
		>{symbol}</span
	>
	<h3 class="mt-4 text-lg font-extrabold text-ice">{title}</h3>
	<p class="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">
		{description}
	</p>
	{#if action}
		<div class="mt-5 flex justify-center">{@render action()}</div>
	{/if}
</div>
