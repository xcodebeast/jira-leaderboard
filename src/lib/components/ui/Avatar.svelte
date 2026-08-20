<script lang="ts">
type AvatarTone = "brand" | "success" | "info" | "neutral";

interface Properties {
	name: string;
	tone?: AvatarTone;
	size?: "small" | "medium";
	class?: string;
}

let {
	name,
	tone = "neutral",
	size = "medium",
	class: className = "",
}: Properties = $props();

let nameParts = $derived(name.split(/\s+/).filter(Boolean));
let initials = $derived(
	(nameParts.length > 1
		? nameParts
				.slice(0, 2)
				.map((part) => part[0])
				.join("")
		: nameParts[0]?.slice(0, 2)
	)?.toUpperCase() || "?",
);

const toneClasses: Record<AvatarTone, string> = {
	brand: "border-brand/25 bg-brand/12 text-brand",
	success: "border-mint/25 bg-mint/10 text-mint",
	info: "border-sky/25 bg-sky/10 text-sky",
	neutral: "border-line bg-panel-soft text-ice",
};
</script>

<span
	class={`grid shrink-0 place-items-center rounded-[0.75rem] border text-[0.68rem] font-extrabold ${size === "small" ? "size-8" : "size-10"} ${toneClasses[tone]} ${className}`}
	title={name}
	aria-hidden="true"
>
	{initials}
</span>
