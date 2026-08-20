<script lang="ts">
import type { Snippet } from "svelte";

type Accent = "brand" | "success" | "info" | "danger" | null;

interface Properties {
	children: Snippet;
	class?: string;
	accent?: Accent;
}

let { children, class: className = "", accent = null }: Properties = $props();

const accentClasses: Record<Exclude<Accent, null>, string> = {
	brand: "before:bg-brand",
	success: "before:bg-mint",
	info: "before:bg-sky",
	danger: "before:bg-coral",
};

let accentClass = $derived(accent ? accentClasses[accent] : "");
</script>

<div
	class={`surface-card relative ${accent ? "before:absolute before:inset-x-4 before:top-0 before:h-px" : ""} ${accentClass} ${className}`}
>
	{@render children()}
</div>
