<script lang="ts">
import type { HTMLTextareaAttributes } from "svelte/elements";
import { getFieldContext, mergeDescriptionIdentifiers } from "./field-context";

interface Properties extends Omit<HTMLTextareaAttributes, "value"> {
	value?: string | null;
}

let {
	value = $bindable(),
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

<textarea
	class={`field-control ${className}`}
	id={resolvedIdentifier}
	aria-describedby={resolvedDescriptionIdentifiers}
	aria-invalid={resolvedInvalid}
	bind:value
	{...restProperties}
></textarea>
