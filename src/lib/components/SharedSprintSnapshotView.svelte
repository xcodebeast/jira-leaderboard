<script lang="ts">
import { untrack } from "svelte";
import DeveloperSprintScoreboard from "$lib/components/DeveloperSprintScoreboard.svelte";
import QualityAssuranceSprintScoreboard from "$lib/components/QualityAssuranceSprintScoreboard.svelte";
import Badge from "$lib/components/ui/Badge.svelte";
import Card from "$lib/components/ui/Card.svelte";
import MetricCard from "$lib/components/ui/MetricCard.svelte";
import SegmentedControl from "$lib/components/ui/SegmentedControl.svelte";
import { formatNumber } from "$lib/presentation/format";
import type {
	SharedSprintReference,
	SharedSprintSnapshot,
} from "$lib/snapshot/schema";

interface Properties {
	snapshot: SharedSprintSnapshot;
}

let { snapshot }: Properties = $props();
let activeScoreboard = $state<"development" | "qualityAssurance">(
	untrack(() =>
		snapshot.report.activeScoreboard === "qualityAssurance" &&
		snapshot.report.qualityAssurance
			? "qualityAssurance"
			: "development",
	),
);

let totalDonePoints = $derived(
	snapshot.report.development.summaries.reduce(
		(total, summary) => total + summary.donePoints,
		0,
	),
);
let totalPipelinePoints = $derived(
	snapshot.report.development.summaries.reduce(
		(total, summary) =>
			total +
			summary.qualityAssurancePoints +
			summary.readyForQualityAssurancePoints,
		0,
	),
);
let totalProjectedPoints = $derived(totalDonePoints + totalPipelinePoints);
let totalBounceCount = $derived(
	snapshot.report.development.summaries.reduce(
		(total, summary) => total + summary.bounceCount,
		0,
	),
);
let totalDevelopmentTickets = $derived(
	snapshot.report.development.summaries.reduce(
		(total, summary) => total + summary.tickets.length,
		0,
	),
);
let totalQualityAssuranceDonePoints = $derived(
	snapshot.report.qualityAssurance?.summaries.reduce(
		(total, summary) => total + summary.doneStoryPoints,
		0,
	) ?? 0,
);
let totalQualityAssuranceTickets = $derived(
	snapshot.report.qualityAssurance?.summaries.reduce(
		(total, summary) =>
			total +
			summary.doneTicketCount +
			summary.readyForQualityAssuranceTicketCount,
		0,
	) ?? 0,
);
let scoreboardSegments = $derived([
	{
		value: "development",
		label: "Development",
		detail: `${snapshot.report.development.summaries.length} contributors · ${totalDevelopmentTickets} tickets`,
	},
	...(snapshot.report.qualityAssurance
		? [
				{
					value: "qualityAssurance",
					label: "Quality assurance",
					detail: `${snapshot.report.qualityAssurance.summaries.length} testers · ${totalQualityAssuranceTickets} tickets`,
				},
			]
		: []),
]);
let comparisonSprint = $derived(
	snapshot.report.comparisonSprint
		? {
				name: snapshot.report.comparisonSprint.name,
			}
		: null,
);

const dateFormatter = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	year: "numeric",
	timeZone: "UTC",
});

function sprintWindow(sprint: SharedSprintReference): string {
	if (!sprint.startDate || !sprint.endDate) {
		return "Dates unavailable";
	}
	return `${dateFormatter.format(new Date(sprint.startDate))} – ${dateFormatter.format(new Date(sprint.endDate))}`;
}
</script>

<section aria-labelledby="shared-sprint-heading">
	<Card class="rounded-[1.2rem] p-5 sm:p-6" accent="brand">
		<div
			class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"
		>
			<div>
				<div class="flex flex-wrap items-center gap-3">
					<p class="eyebrow">Sprint performance</p>
					<Badge
						tone={snapshot.report.sprint.state === "active"
							? "success"
							: "neutral"}
					>
						{snapshot.report.sprint.state === "active"
							? "Current when captured"
							: "Closed sprint"}
					</Badge>
				</div>
				<h2
					id="shared-sprint-heading"
					class="display-title mt-3 text-3xl text-ice sm:text-4xl"
				>
					{snapshot.report.sprint.name}
				</h2>
				<p class="mt-2 text-sm text-muted">
					{sprintWindow(snapshot.report.sprint)}
				</p>
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
		aria-label="Frozen sprint totals"
	>
		<MetricCard
			label="Delivered"
			value={formatNumber(totalDonePoints)}
			subtitle={`${totalDevelopmentTickets} tracked development tickets`}
			tone="success"
			context="Development points"
		/>
		<MetricCard
			label="In the pipeline"
			value={formatNumber(totalPipelinePoints)}
			subtitle={`${formatNumber(totalProjectedPoints)} total projected`}
			tone="info"
			context="Development source"
		/>
		<MetricCard
			label="QA cleared"
			value={snapshot.report.qualityAssurance
				? formatNumber(totalQualityAssuranceDonePoints)
				: "—"}
			subtitle={snapshot.report.qualityAssurance
				? `${totalQualityAssuranceTickets} tracked QA tickets`
				: "QA data was not included"}
			tone="brand"
			context="Tester-owned points"
		/>
		<MetricCard
			label="Bounces"
			value={formatNumber(totalBounceCount)}
			subtitle={totalBounceCount > 0
				? "A signal to inspect, not a penalty"
				: "Clean flow in this snapshot"}
			tone={totalBounceCount > 0 ? "danger" : "neutral"}
			context="Bounce count"
		/>
	</section>

	<section class="mt-8" aria-labelledby="shared-scoreboard-heading">
		<div
			class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
		>
			<div>
				<p class="eyebrow">Captured standings</p>
				<h2
					id="shared-scoreboard-heading"
					class="mt-2 text-2xl font-extrabold text-ice"
				>
					Team scoreboards
				</h2>
			</div>
			<SegmentedControl
				segments={scoreboardSegments}
				bind:value={activeScoreboard}
				label="Frozen sprint scoreboard"
			/>
		</div>

		<div class="mt-5">
			{#if activeScoreboard === "development"}
				<DeveloperSprintScoreboard
					summaries={snapshot.report.development.summaries}
					comparisons={snapshot.report.development.comparisons}
					{comparisonSprint}
				/>
			{:else if snapshot.report.qualityAssurance}
				<QualityAssuranceSprintScoreboard
					summaries={snapshot.report.qualityAssurance.summaries}
				/>
			{/if}
		</div>
	</section>
</section>
