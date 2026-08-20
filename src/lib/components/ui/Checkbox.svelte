<script lang="ts">
import type { HTMLInputAttributes } from "svelte/elements";
import { getFieldContext, mergeDescriptionIdentifiers } from "./field-context";

interface Properties extends Omit<HTMLInputAttributes, "checked" | "type"> {
	checked?: boolean;
	element?: HTMLInputElement;
}

let {
	checked = $bindable(false),
	element = $bindable(),
	id,
	"aria-describedby": ariaDescribedBy,
	"aria-invalid": ariaInvalid,
	class: className = "",
	...restProperties
}: Properties = $props();

const fieldContext = getFieldContext();
let resolvedIdentifier = $derived(id ?? fieldContext?.controlIdentifier);
let resolvedDescriptionIdentifiers = $derived(
	mergeDescriptionIdentifiers(
		ariaDescribedBy,
		fieldContext?.descriptionIdentifier,
	),
);
let resolvedInvalid = $derived(
	ariaInvalid ?? (fieldContext?.invalid ? "true" : undefined),
);
</script>

<input
	type="checkbox"
	class={`size-4 accent-brand ${className}`}
	id={resolvedIdentifier}
	aria-describedby={resolvedDescriptionIdentifiers}
	aria-invalid={resolvedInvalid}
	bind:this={element}
	bind:checked
	{...restProperties}
>
