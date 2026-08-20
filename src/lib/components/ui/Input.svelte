<script lang="ts">
import type { HTMLInputAttributes } from "svelte/elements";
import { getFieldContext, mergeDescriptionIdentifiers } from "./field-context";

interface Properties extends Omit<HTMLInputAttributes, "value"> {
	value?: HTMLInputAttributes["value"];
	element?: HTMLInputElement;
}

let {
	value = $bindable(),
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
	class={`field-control ${className}`}
	id={resolvedIdentifier}
	aria-describedby={resolvedDescriptionIdentifiers}
	aria-invalid={resolvedInvalid}
	bind:this={element}
	bind:value
	{...restProperties}
>
