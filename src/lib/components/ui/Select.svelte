<script lang="ts">
import type { Snippet } from "svelte";
import type { HTMLSelectAttributes } from "svelte/elements";
import { getFieldContext, mergeDescriptionIdentifiers } from "./field-context";

interface Properties extends Omit<HTMLSelectAttributes, "value"> {
	children: Snippet;
	value?: HTMLSelectAttributes["value"];
}

let {
	children,
	value = $bindable(),
	onchange,
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

function handleChange(
	event: Event & { currentTarget: HTMLSelectElement },
): void {
	onchange?.(event);
}
</script>

<select
	class={`field-control ${className}`}
	id={resolvedIdentifier}
	aria-describedby={resolvedDescriptionIdentifiers}
	aria-invalid={resolvedInvalid}
	bind:value
	onchange={handleChange}
	{...restProperties}
>
	{@render children()}
</select>
