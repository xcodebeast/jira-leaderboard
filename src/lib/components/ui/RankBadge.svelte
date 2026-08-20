<script lang="ts">
interface Properties {
	rank: number;
}

let { rank }: Properties = $props();
let rankLabel = $derived(
	rank === 1 ? "Gold" : rank === 2 ? "Silver" : rank === 3 ? "Bronze" : "",
);
let rankClasses = $derived(
	rank === 1
		? "border-brand/45 bg-brand text-[#171306] shadow-[0_0_20px_rgb(246_207_91/0.2)]"
		: rank === 2
			? "border-silver/45 bg-silver/12 text-silver"
			: rank === 3
				? "border-bronze/45 bg-bronze/12 text-bronze"
				: "border-line/80 bg-canvas/40 text-muted",
);
</script>

<span
	class={`grid size-8 shrink-0 place-items-center rounded-full border font-mono text-[0.68rem] font-extrabold ${rankClasses}`}
	title={rankLabel ? `${rankLabel} rank` : `Rank ${rank}`}
>
	{rank}
</span>
