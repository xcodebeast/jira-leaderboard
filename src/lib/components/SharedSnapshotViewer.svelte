<script lang="ts">
import type { SharedSnapshot } from "$lib/snapshot/schema";
import SharedLeaderboardSnapshotView from "./SharedLeaderboardSnapshotView.svelte";
import SharedPeriodComparisonSnapshotView from "./SharedPeriodComparisonSnapshotView.svelte";
import SharedSprintSnapshotView from "./SharedSprintSnapshotView.svelte";

interface Properties {
	snapshot: SharedSnapshot;
}

let { snapshot }: Properties = $props();
</script>

{#key snapshot}
	{#if snapshot.kind === "sprint"}
		<SharedSprintSnapshotView {snapshot} />
	{:else if snapshot.kind === "leaderboard"}
		<SharedLeaderboardSnapshotView {snapshot} />
	{:else}
		<SharedPeriodComparisonSnapshotView {snapshot} />
	{/if}
{/key}
