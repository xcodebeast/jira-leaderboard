<script lang="ts">
import type { Snippet } from "svelte";

type BadgeTone = "brand" | "success" | "info" | "danger" | "neutral";

interface Properties {
	children: Snippet;
	tone?: BadgeTone;
	class?: string;
}

let {
	children,
	tone = "neutral",
	class: className = "",
}: Properties = $props();

const toneClasses: Record<BadgeTone, string> = {
	brand: "border-brand/25 bg-brand/10 text-brand",
	success: "border-mint/25 bg-mint/9 text-mint",
	info: "border-sky/25 bg-sky/9 text-sky",
	danger: "border-coral/25 bg-coral/9 text-coral",
	neutral: "border-line bg-canvas/35 text-muted",
};
</script>

<span
	class={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.66rem] font-bold uppercase tracking-[0.08em] ${toneClasses[tone]} ${className}`}
>
	{@render children()}
</span>
