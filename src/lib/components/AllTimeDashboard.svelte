<script lang="ts">
import { onMount } from "svelte";
import {
	loadDevelopmentAllTimeIssues,
	loadQualityAssuranceAllTimeIssues,
} from "../browser/api-client";
import type { AppConfiguration } from "../browser/configuration";
import {
	type AllTimeLeaderboardEntry,
	type LeaderboardScope,
	summarizeDeveloperAllTimeIssues,
	summarizeQualityAssuranceAllTimeIssues,
	totalAllTimeLeaderboard,
} from "../domain/all-time-performance";
import { formatNumber } from "../presentation/format";
import {
	SHARED_SNAPSHOT_VERSION,
	type SharedLeaderboardSnapshot,
} from "../snapshot/schema";
import AllTimeLeaderboard from "./AllTimeLeaderboard.svelte";
import ShareSnapshotButton from "./ShareSnapshotButton.svelte";
import Alert from "./ui/Alert.svelte";
import Button from "./ui/Button.svelte";
import Card from "./ui/Card.svelte";
import EmptyState from "./ui/EmptyState.svelte";
import Field from "./ui/Field.svelte";
import LoadingState from "./ui/LoadingState.svelte";
import MetricCard from "./ui/MetricCard.svelte";
import Select from "./ui/Select.svelte";

interface Properties {
	configuration: AppConfiguration;
	onOpenSettings: () => void;
}

let { configuration, onOpenSettings }: Properties = $props();
let developerEntries = $state<AllTimeLeaderboardEntry[]>([]);
let qualityAssuranceEntries = $state<AllTimeLeaderboardEntry[]>([]);
let isLoading = $state(true);
let reportSelection = $state<string | null>(null);
let errorMessage = $state("");
const currentYear = new Date().getFullYear();
const earliestSelectableYear = 2002;
const selectableYears = Array.from(
	{ length: currentYear - earliestSelectableYear + 1 },
	(_, index) => currentYear - index,
);
let selectedScope = $state<LeaderboardScope>("board");
let selectedPeriod = $state(String(currentYear));
let selectedYear = $derived(
	selectedPeriod === "all" ? null : Number(selectedPeriod),
);
let selectedPeriodLabel = $derived(
	selectedPeriod === "all" ? "All time" : selectedPeriod,
);
let selectedReportKey = $derived(`${selectedScope}:${selectedPeriod}`);
let hasCurrentReport = $derived(reportSelection === selectedReportKey);
let developerSourceLabel = $derived(
	selectedScope === "global"
		? "All accessible Jira projects"
		: configuration.boardName,
);
let qualityAssuranceSourceLabel = $derived(
	selectedScope === "global"
		? "All accessible Jira projects"
		: (configuration.qualityAssurance?.boardName ?? "Set up in Settings"),
);
let developerTotals = $derived(totalAllTimeLeaderboard(developerEntries));
let qualityAssuranceTotals = $derived(
	totalAllTimeLeaderboard(qualityAssuranceEntries),
);

function createSharedSnapshot(): SharedLeaderboardSnapshot {
	return {
		version: SHARED_SNAPSHOT_VERSION,
		kind: "leaderboard",
		capturedAt: new Date().toISOString(),
		report: {
			period: {
				label: selectedPeriodLabel,
				year: selectedYear,
			},
			scope: selectedScope,
			scopeLabel:
				selectedScope === "global"
					? "All accessible Jira projects"
					: "Current Jira boards",
			development: {
				sourceLabel: developerSourceLabel,
				entries: developerEntries.map((entry) => ({
					contributor: entry.contributor,
					completedPoints: entry.completedPoints,
					completedTickets: entry.completedTickets,
				})),
			},
			qualityAssurance: configuration.qualityAssurance
				? {
						sourceLabel: qualityAssuranceSourceLabel,
						entries: qualityAssuranceEntries.map((entry) => ({
							contributor: entry.contributor,
							completedPoints: entry.completedPoints,
							completedTickets: entry.completedTickets,
						})),
					}
				: null,
		},
	};
}

async function refreshReport(): Promise<void> {
	const reportKey = selectedReportKey;
	isLoading = true;
	errorMessage = "";
	try {
		const [developerIssues, qualityAssuranceIssues] = await Promise.all([
			loadDevelopmentAllTimeIssues(
				configuration.boardIdentifier,
				selectedScope,
				configuration.statusMapping.done,
				selectedYear,
				configuration.fieldMapping,
			),
			configuration.qualityAssurance
				? loadQualityAssuranceAllTimeIssues(
						configuration.qualityAssurance.boardIdentifier,
						selectedScope,
						configuration.qualityAssurance.statusMapping.done,
						selectedYear,
						configuration.qualityAssurance.fieldMapping,
					)
				: Promise.resolve([]),
		]);
		developerEntries = summarizeDeveloperAllTimeIssues(
			developerIssues,
			configuration.statusMapping.done,
		);
		qualityAssuranceEntries = configuration.qualityAssurance
			? summarizeQualityAssuranceAllTimeIssues(
					qualityAssuranceIssues,
					configuration.qualityAssurance.statusMapping.done,
				)
			: [];
		reportSelection = reportKey;
	} catch (error) {
		errorMessage =
			error instanceof Error
				? error.message
				: "Leaderboard performance could not be loaded.";
	} finally {
		isLoading = false;
	}
}

onMount(() => {
	void refreshReport();
});
</script>

<main class="mx-auto max-w-[94rem] px-5 py-8 sm:px-8 sm:py-10">
	<header
		class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"
	>
		<div class="max-w-3xl">
			<h1 class="display-title mt-3 text-4xl leading-none text-ice sm:text-5xl">
				{selectedPeriod === "all" ? "All-time" : selectedPeriod}
				{selectedScope === "global" ? "global" : ""}
				leaderboard
			</h1>
		</div>
		<div class="flex flex-col gap-3 sm:flex-row sm:items-end">
			<Field label="Scope" compact class="min-w-48">
				<Select
					bind:value={selectedScope}
					onchange={refreshReport}
					disabled={isLoading}
				>
					<option value="board">Current boards</option>
					<option value="global">All Jira projects</option>
				</Select>
			</Field>
			<Field label="Season" compact class="min-w-36">
				<Select
					bind:value={selectedPeriod}
					onchange={refreshReport}
					disabled={isLoading}
				>
					<option value="all">All time</option>
					{#each selectableYears as year (year)}
						<option value={String(year)}>{year}</option>
					{/each}
				</Select>
			</Field>
			<Button variant="secondary" onclick={refreshReport} loading={isLoading}>
				{isLoading ? "Updating…" : "Refresh scores"}
			</Button>
			<ShareSnapshotButton
				createSnapshot={createSharedSnapshot}
				snapshotIdentity={selectedReportKey}
				disabled={isLoading || !hasCurrentReport}
			/>
		</div>
	</header>

	{#if errorMessage}
		<div class="mt-6">
			<Alert message={errorMessage} onRetry={refreshReport} />
		</div>
	{/if}

	{#if isLoading && !hasCurrentReport}
		<LoadingState
			message={`Calculating ${selectedPeriodLabel.toLowerCase()} performance…`}
		/>
	{:else if hasCurrentReport}
		<section
			class="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
			aria-label="Leaderboard totals"
		>
			<MetricCard
				label="Developer points"
				value={formatNumber(developerTotals.completedPoints)}
				subtitle={`${developerEntries.length} ranked developers`}
				tone="success"
				context={selectedPeriodLabel}
			/>
			<MetricCard
				label="Developer tickets"
				value={String(developerTotals.completedTickets)}
				subtitle={developerSourceLabel}
				context="Completed"
			/>
			<MetricCard
				label="QA points"
				value={configuration.qualityAssurance
					? formatNumber(qualityAssuranceTotals.completedPoints)
					: "—"}
				subtitle={configuration.qualityAssurance
					? `${qualityAssuranceEntries.length} ranked testers`
					: "QA board not configured"}
				tone="brand"
				context={selectedPeriodLabel}
			/>
			<MetricCard
				label="QA tickets"
				value={configuration.qualityAssurance
					? String(qualityAssuranceTotals.completedTickets)
					: "—"}
				subtitle={qualityAssuranceSourceLabel}
				tone="info"
				context="Completed"
			/>
		</section>

		<div class="mt-6 grid items-start gap-6 xl:grid-cols-2">
			<AllTimeLeaderboard
				title="Developer league"
				description={`Done points, then Done tickets · ${selectedPeriodLabel} · ${developerSourceLabel}`}
				contributorLabel="Developer"
				entries={developerEntries}
				tone="success"
			/>

			{#if configuration.qualityAssurance}
				<AllTimeLeaderboard
					title="QA league"
					description={`Done points, then Done tickets · ${selectedPeriodLabel} · ${qualityAssuranceSourceLabel}`}
					contributorLabel="Tester"
					entries={qualityAssuranceEntries}
					tone="info"
				/>
			{:else}
				<Card class="rounded-[1.2rem]">
					<EmptyState
						title="Add the QA league"
						description="Configure a QA board and map its Tester field to celebrate quality work beside development delivery."
						symbol="✓"
					>
						{#snippet action()}
							<Button variant="primary" onclick={onOpenSettings}
								>Open settings</Button
							>
						{/snippet}
					</EmptyState>
				</Card>
			{/if}
		</div>
	{/if}
</main>
