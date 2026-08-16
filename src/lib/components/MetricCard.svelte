<script lang="ts">
type Tone = "mint" | "violet" | "coral" | "neutral";

interface Properties {
	label: string;
	value: string;
	subtitle?: string;
	tone?: Tone;
}

let { label, value, subtitle = "", tone = "neutral" }: Properties = $props();
let accentClass = $derived(
	tone === "mint"
		? "bg-mint text-mint"
		: tone === "violet"
			? "bg-violet text-violet"
			: tone === "coral"
				? "bg-coral text-coral"
				: "bg-muted text-muted",
);
</script>

<article class="surface-card relative overflow-hidden rounded-2xl p-5">
	<span
		class={`absolute inset-x-0 top-0 h-px opacity-70 ${accentClass.split(" ")[0]}`}
	></span>
	<div class="flex items-center justify-between gap-3">
		<p class="text-xs font-semibold uppercase tracking-[0.1em] text-muted">
			{label}
		</p>
		<span
			class={`size-2 rounded-full ${accentClass.split(" ")[0]} shadow-[0_0_14px_currentColor]`}
		></span>
	</div>
	<p
		class={`metric-value mt-4 text-4xl font-bold ${accentClass.split(" ")[1]}`}
	>
		{value}
	</p>
	{#if subtitle}
		<p class="mt-2 text-xs leading-5 text-muted">{subtitle}</p>
	{/if}
</article>
