<script lang="ts">
import Card from "./Card.svelte";

export type MetricTone = "brand" | "success" | "info" | "danger" | "neutral";

interface Properties {
	label: string;
	value: string;
	subtitle?: string;
	tone?: MetricTone;
	context?: string;
}

let {
	label,
	value,
	subtitle = "",
	tone = "neutral",
	context = "",
}: Properties = $props();

const toneClasses: Record<MetricTone, { dot: string; text: string }> = {
	brand: { dot: "bg-brand", text: "text-brand" },
	success: { dot: "bg-mint", text: "text-mint" },
	info: { dot: "bg-sky", text: "text-sky" },
	danger: { dot: "bg-coral", text: "text-coral" },
	neutral: { dot: "bg-muted", text: "text-ice" },
};
</script>

<Card class="rounded-[1.15rem] p-5" accent={tone === "neutral" ? null : tone}>
	<div class="flex items-start justify-between gap-3">
		<div>
			<p
				class="text-[0.68rem] font-bold uppercase tracking-[0.11em] text-muted"
			>
				{label}
			</p>
			{#if context}
				<p class="mt-1 text-[0.68rem] text-muted/80">{context}</p>
			{/if}
		</div>
		<span
			class={`mt-1 size-2 rounded-full ${toneClasses[tone].dot}`}
			aria-hidden="true"
		></span>
	</div>
	<p
		class={`metric-value mt-4 text-[2.55rem] font-extrabold leading-none ${toneClasses[tone].text}`}
	>
		{value}
	</p>
	{#if subtitle}
		<p class="mt-3 text-xs leading-5 text-muted">{subtitle}</p>
	{/if}
</Card>
