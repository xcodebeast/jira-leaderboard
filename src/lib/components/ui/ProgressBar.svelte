<script lang="ts">
type ProgressTone = "brand" | "success" | "info" | "danger" | "neutral";

interface Properties {
	value: number;
	maximum: number;
	label: string;
	tone?: ProgressTone;
	class?: string;
}

let {
	value,
	maximum,
	label,
	tone = "success",
	class: className = "",
}: Properties = $props();

const toneClasses: Record<ProgressTone, string> = {
	brand: "bg-brand",
	success: "bg-mint",
	info: "bg-sky",
	danger: "bg-coral",
	neutral: "bg-muted",
};

let percentage = $derived(
	Math.min(100, Math.max(0, maximum <= 0 ? 0 : (value / maximum) * 100)),
);
</script>

<div
	class={`h-1.5 overflow-hidden rounded-full bg-line/75 ${className}`}
	role="progressbar"
	aria-label={label}
	aria-valuemin="0"
	aria-valuemax={maximum}
	aria-valuenow={value}
>
	<div
		class={`h-full rounded-full transition-[width] duration-500 ${toneClasses[tone]}`}
		style={`width: ${percentage}%`}
	></div>
</div>
