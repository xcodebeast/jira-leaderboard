<script lang="ts">
import AllTimeLeaderboard from "$lib/components/AllTimeLeaderboard.svelte";
import Badge from "$lib/components/ui/Badge.svelte";
import Card from "$lib/components/ui/Card.svelte";
import MetricCard from "$lib/components/ui/MetricCard.svelte";
import { totalAllTimeLeaderboard } from "$lib/domain/all-time-performance";
import { formatNumber } from "$lib/presentation/format";
import type { SharedLeaderboardSnapshot } from "$lib/snapshot/schema";

interface Properties {
	snapshot: SharedLeaderboardSnapshot;
}

let { snapshot }: Properties = $props();
let developerTotals = $derived(
	totalAllTimeLeaderboard(snapshot.report.development.entries),
);
let qualityAssuranceTotals = $derived(
	totalAllTimeLeaderboard(snapshot.report.qualityAssurance?.entries ?? []),
);
</script>

<section aria-labelledby="shared-leaderboard-heading">
	<Card class="rounded-[1.2rem] p-5 sm:p-6" accent="brand">
		<div
			class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"
		>
			<div>
				<div class="flex flex-wrap items-center gap-3">
					<p class="eyebrow">Leaderboard</p>
					<Badge tone={snapshot.report.scope === "global" ? "info" : "neutral"}>
						{snapshot.report.scope === "global"
							? "All Jira projects"
							: "Current boards"}
					</Badge>
				</div>
				<h2
					id="shared-leaderboard-heading"
					class="display-title mt-3 text-3xl text-ice sm:text-4xl"
				>
					{snapshot.report.period.label}
					standings
				</h2>
				<p class="mt-2 text-sm text-muted">{snapshot.report.scopeLabel}</p>
			</div>
			<dl class="grid gap-3 text-sm sm:grid-cols-2 lg:min-w-[30rem]">
				<div class="rounded-xl border border-line/70 bg-canvas/38 px-4 py-3">
					<dt class="text-xs font-bold uppercase tracking-wide text-muted">
						Development source
					</dt>
					<dd class="mt-1 font-bold text-ice">
						{snapshot.report.development.sourceLabel}
					</dd>
				</div>
				<div class="rounded-xl border border-line/70 bg-canvas/38 px-4 py-3">
					<dt class="text-xs font-bold uppercase tracking-wide text-muted">
						QA source
					</dt>
					<dd class="mt-1 font-bold text-ice">
						{snapshot.report.qualityAssurance?.sourceLabel ??
							"Not included"}
					</dd>
				</div>
			</dl>
		</div>
	</Card>

	<section
		class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
		aria-label="Frozen leaderboard totals"
	>
		<MetricCard
			label="Developer points"
			value={formatNumber(developerTotals.completedPoints)}
			subtitle={`${snapshot.report.development.entries.length} ranked developers`}
			tone="success"
			context={snapshot.report.period.label}
		/>
		<MetricCard
			label="Developer tickets"
			value={String(developerTotals.completedTickets)}
			subtitle={snapshot.report.development.sourceLabel}
			context="Completed"
		/>
		<MetricCard
			label="QA points"
			value={snapshot.report.qualityAssurance
				? formatNumber(qualityAssuranceTotals.completedPoints)
				: "—"}
			subtitle={snapshot.report.qualityAssurance
				? `${snapshot.report.qualityAssurance.entries.length} ranked testers`
				: "QA data was not included"}
			tone="brand"
			context={snapshot.report.period.label}
		/>
		<MetricCard
			label="QA tickets"
			value={snapshot.report.qualityAssurance
				? String(qualityAssuranceTotals.completedTickets)
				: "—"}
			subtitle={snapshot.report.qualityAssurance?.sourceLabel ?? "Not included"}
			tone="info"
			context="Completed"
		/>
	</section>

	<div class="mt-6 grid items-start gap-6 xl:grid-cols-2">
		<AllTimeLeaderboard
			title="Developer league"
			description={`Done points, then Done tickets · ${snapshot.report.period.label} · ${snapshot.report.development.sourceLabel}`}
			contributorLabel="Developer"
			entries={snapshot.report.development.entries}
			tone="success"
		/>

		{#if snapshot.report.qualityAssurance}
			<AllTimeLeaderboard
				title="QA league"
				description={`Done points, then Done tickets · ${snapshot.report.period.label} · ${snapshot.report.qualityAssurance.sourceLabel}`}
				contributorLabel="Tester"
				entries={snapshot.report.qualityAssurance.entries}
				tone="info"
			/>
		{/if}
	</div>
</section>
