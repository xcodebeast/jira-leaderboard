<script lang="ts">
import Icon from "./ui/Icon.svelte";

interface Properties {
	compact?: boolean;
}

let { compact = false }: Properties = $props();
</script>

<div class="flex items-center gap-3">
	<div
		class="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-[0.9rem] border border-brand/70 bg-brand text-[#171306] shadow-[0_8px_24px_rgb(246_207_91/0.13)]"
		aria-hidden="true"
	>
		<span
			class="absolute -right-3 -top-3 size-7 rounded-full bg-white/30"
		></span>
		<Icon name="trophy" size={21} strokeWidth={2.1} />
	</div>
	{#if !compact}
		<div>
			<p
				class="text-sm font-extrabold tracking-[-0.02em] text-ice sm:text-base"
			>
				Jira Leaderboard
			</p>
		</div>
	{/if}
</div>
