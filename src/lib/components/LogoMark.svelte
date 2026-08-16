<script lang="ts">
interface Properties {
	compact?: boolean;
}

let { compact = false }: Properties = $props();
</script>

<div class="flex items-center gap-3">
	<div
		class="grid size-10 shrink-0 grid-cols-3 items-end gap-1 rounded-xl border border-mint/20 bg-mint/8 p-2 shadow-[inset_0_0_20px_rgba(139,255,202,0.05)]"
		aria-hidden="true"
	>
		<span class="h-2 rounded-sm bg-mint/55"></span>
		<span class="h-4 rounded-sm bg-mint/75"></span>
		<span class="h-6 rounded-sm bg-mint"></span>
	</div>
	{#if !compact}
		<div>
			<p class="text-md font-bold tracking-tight text-white">
				Jira Leaderboard
			</p>
		</div>
	{/if}
</div>
