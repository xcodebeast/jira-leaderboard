<script lang="ts">
import type { Snippet } from "svelte";
import { setFieldContext } from "./field-context";

interface Properties {
	label: string;
	children: Snippet;
	for?: string;
	hint?: string;
	error?: string;
	required?: boolean;
	compact?: boolean;
	class?: string;
}

let {
	label,
	children,
	for: controlIdentifier,
	hint = "",
	error = "",
	required = false,
	compact = false,
	class: className = "",
}: Properties = $props();

const fieldIdentifier = $props.id();
const generatedControlIdentifier = `${fieldIdentifier}-control`;
const descriptionIdentifier = `${fieldIdentifier}-description`;
let resolvedControlIdentifier = $derived(
	controlIdentifier || generatedControlIdentifier,
);
let resolvedDescriptionIdentifier = $derived(
	error || hint ? descriptionIdentifier : undefined,
);

setFieldContext({
	get controlIdentifier() {
		return resolvedControlIdentifier;
	},
	get descriptionIdentifier() {
		return resolvedDescriptionIdentifier;
	},
	get invalid() {
		return Boolean(error);
	},
});
</script>

<div class={`block ${className}`}>
	<label
		for={resolvedControlIdentifier}
		class={`mb-2 block font-bold text-ice ${compact ? "text-xs uppercase tracking-[0.09em] text-muted" : "text-sm"}`}
	>
		{label}
		{#if required}
			<span class="ml-1 text-brand" aria-hidden="true">*</span>
		{/if}
	</label>
	{@render children()}
	{#if error}
		<span
			id={descriptionIdentifier}
			class="mt-2 block text-xs font-semibold text-coral"
			>{error}</span
		>
	{:else if hint}
		<span
			id={descriptionIdentifier}
			class="mt-2 block text-xs leading-5 text-muted"
			>{hint}</span
		>
	{/if}
</div>
