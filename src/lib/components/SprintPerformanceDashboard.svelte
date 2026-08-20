<script lang="ts">
import { onMount } from "svelte";
import {
	loadQualityAssuranceSprintIssues,
	loadSprintIssues,
} from "../browser/api-client";
import type { AppConfiguration } from "../browser/configuration";
import {
	type ClosedSprintPageRequest,
	initializeSprintHistory,
	loadOlderSprintHistoryPage,
} from "../browser/sprint-history";
import {
	findPreviousClosedSprint,
	type JiraSprint,
	mergeJiraSprints,
} from "../domain/jira";
import {
	summarizeQualityAssuranceSprintIssues,
	type TesterSprintSummary,
	totalQualityAssuranceTicketCount,
} from "../domain/quality-assurance-performance";
import {
	compareSprintSummaries,
	type DeveloperSprintComparison,
	type DeveloperSprintSummary,
	projectedSprintPoints,
	summarizeSprintIssues,
} from "../domain/sprint-performance";
import { formatNumber, sprintDateDescription } from "../presentation/format";
import DeveloperSprintScoreboard from "./DeveloperSprintScoreboard.svelte";
import QualityAssuranceSprintScoreboard from "./QualityAssuranceSprintScoreboard.svelte";
import SprintSelector from "./SprintSelector.svelte";
import Alert from "./ui/Alert.svelte";
import Badge from "./ui/Badge.svelte";
import Button from "./ui/Button.svelte";
import Card from "./ui/Card.svelte";
import EmptyState from "./ui/EmptyState.svelte";
import LoadingState from "./ui/LoadingState.svelte";
import MetricCard from "./ui/MetricCard.svelte";
import SegmentedControl from "./ui/SegmentedControl.svelte";

interface Properties {
	configuration: AppConfiguration;
	jiraSiteUrl: string;
	onOpenSettings: () => void;
}

let { configuration, jiraSiteUrl, onOpenSettings }: Properties = $props();
let sprints = $state<JiraSprint[]>([]);
let selectedSprintIdentifier = $state("");
let comparisonSprintIdentifier = $state("");
let developmentSummaries = $state<DeveloperSprintSummary[]>([]);
let developmentComparisons = $state<DeveloperSprintComparison[]>([]);
let qualityAssuranceSummaries = $state<TesterSprintSummary[]>([]);
let isLoadingSprints = $state(true);
let isLoadingOlderSprints = $state(false);
let isLoadingDevelopmentReport = $state(false);
let isLoadingQualityAssuranceReport = $state(false);
let sprintHistoryErrorMessage = $state("");
let developmentErrorMessage = $state("");
let developmentComparisonErrorMessage = $state("");
let qualityAssuranceErrorMessage = $state("");
let sprintHistoryFailure = $state<"list" | "history">("list");
let nextClosedSprintPageRequest = $state<ClosedSprintPageRequest | null>(null);
let totalClosedSprints = $state<number | null>(null);
let developmentReportSprintIdentifier = $state<number | null>(null);
let developmentReportComparisonIdentifier = $state<number | null>(null);
let qualityAssuranceReportSprintIdentifier = $state<number | null>(null);
let activeScoreboard = $state("development");

let selectedSprint = $derived(
	sprints.find(
		(sprint) => sprint.identifier === Number(selectedSprintIdentifier),
	) ?? null,
);
let comparisonSprint = $derived(
	sprints.find(
		(sprint) => sprint.identifier === Number(comparisonSprintIdentifier),
	) ?? null,
);
let hasDevelopmentReport = $derived(
	developmentReportSprintIdentifier === selectedSprint?.identifier,
);
let hasDevelopmentComparison = $derived(
	comparisonSprint !== null &&
		developmentReportSprintIdentifier === selectedSprint?.identifier &&
		developmentReportComparisonIdentifier === comparisonSprint.identifier,
);
let hasQualityAssuranceReport = $derived(
	qualityAssuranceReportSprintIdentifier === selectedSprint?.identifier,
);
let isRefreshing = $derived(
	isLoadingDevelopmentReport || isLoadingQualityAssuranceReport,
);
let totalDonePoints = $derived(
	developmentSummaries.reduce(
		(total, summary) => total + summary.donePoints,
		0,
	),
);
let totalPipelinePoints = $derived(
	developmentSummaries.reduce(
		(total, summary) =>
			total +
			summary.qualityAssurancePoints +
			summary.readyForQualityAssurancePoints,
		0,
	),
);
let totalProjectedPoints = $derived(
	developmentSummaries.reduce(
		(total, summary) => total + projectedSprintPoints(summary),
		0,
	),
);
let totalBounceCount = $derived(
	developmentSummaries.reduce(
		(total, summary) => total + summary.bounceCount,
		0,
	),
);
let totalDevelopmentTickets = $derived(
	developmentSummaries.reduce(
		(total, summary) => total + summary.tickets.length,
		0,
	),
);
let totalQualityAssuranceDonePoints = $derived(
	qualityAssuranceSummaries.reduce(
		(total, summary) => total + summary.doneStoryPoints,
		0,
	),
);
let totalQualityAssuranceTickets = $derived(
	qualityAssuranceSummaries.reduce(
		(total, summary) => total + totalQualityAssuranceTicketCount(summary),
		0,
	),
);
let scoreboardSegments = $derived([
	{
		value: "development",
		label: "Development",
		detail: hasDevelopmentReport
			? `${developmentSummaries.length} contributors · ${totalDevelopmentTickets} tickets`
			: "Delivery flow",
	},
	{
		value: "qualityAssurance",
		label: "Quality assurance",
		detail: configuration.qualityAssurance
			? hasQualityAssuranceReport
				? `${qualityAssuranceSummaries.length} testers · ${totalQualityAssuranceTickets} tickets`
				: "Tester throughput"
			: "Add a QA board",
	},
]);

function selectSuggestedComparison(): void {
	if (!selectedSprint) {
		comparisonSprintIdentifier = "";
		return;
	}
	const previousSprint = findPreviousClosedSprint(selectedSprint, sprints);
	comparisonSprintIdentifier = previousSprint
		? String(previousSprint.identifier)
		: "";
}

function reportErrorMessage(error: unknown, fallbackMessage: string): string {
	return error instanceof Error ? error.message : fallbackMessage;
}

function clearDevelopmentComparisonReport(): void {
	developmentComparisons = [];
	developmentReportComparisonIdentifier = null;
}

function clearDevelopmentReport(): void {
	developmentSummaries = [];
	developmentReportSprintIdentifier = null;
	clearDevelopmentComparisonReport();
}

async function refreshDevelopmentReport(): Promise<void> {
	const sprint = selectedSprint;
	const sprintToCompare = comparisonSprint;
	if (!sprint) {
		clearDevelopmentReport();
		return;
	}

	isLoadingDevelopmentReport = true;
	developmentErrorMessage = "";
	developmentComparisonErrorMessage = "";
	try {
		const [currentIssuesResult, comparisonIssuesResult] =
			await Promise.allSettled([
				loadSprintIssues(sprint.identifier, configuration.fieldMapping),
				sprintToCompare
					? loadSprintIssues(
							sprintToCompare.identifier,
							configuration.fieldMapping,
						)
					: Promise.resolve([]),
			]);

		if (sprintToCompare && comparisonIssuesResult.status === "rejected") {
			developmentComparisonErrorMessage = reportErrorMessage(
				comparisonIssuesResult.reason,
				`Comparison with ${sprintToCompare.name} could not be loaded.`,
			);
		}

		if (currentIssuesResult.status === "rejected") {
			clearDevelopmentReport();
			developmentErrorMessage = reportErrorMessage(
				currentIssuesResult.reason,
				"Development performance could not be loaded.",
			);
			return;
		}

		let currentSummaries: DeveloperSprintSummary[];
		try {
			currentSummaries = summarizeSprintIssues(
				currentIssuesResult.value,
				configuration.statusMapping,
			);
		} catch (error) {
			clearDevelopmentReport();
			developmentErrorMessage = reportErrorMessage(
				error,
				"Development performance could not be calculated.",
			);
			return;
		}

		developmentSummaries = currentSummaries;
		developmentReportSprintIdentifier = sprint.identifier;

		if (!sprintToCompare || comparisonIssuesResult.status === "rejected") {
			clearDevelopmentComparisonReport();
			return;
		}

		try {
			const comparisonSummaries = summarizeSprintIssues(
				comparisonIssuesResult.value,
				configuration.statusMapping,
			);
			developmentComparisons = compareSprintSummaries(
				currentSummaries,
				comparisonSummaries,
			);
			developmentReportComparisonIdentifier = sprintToCompare.identifier;
		} catch (error) {
			clearDevelopmentComparisonReport();
			developmentComparisonErrorMessage = reportErrorMessage(
				error,
				`Comparison with ${sprintToCompare.name} could not be calculated.`,
			);
		}
	} catch (error) {
		clearDevelopmentReport();
		developmentErrorMessage = reportErrorMessage(
			error,
			"Development performance could not be loaded.",
		);
	} finally {
		isLoadingDevelopmentReport = false;
	}
}

async function refreshQualityAssuranceReport(): Promise<void> {
	const sprint = selectedSprint;
	const qualityAssuranceConfiguration = configuration.qualityAssurance;
	if (!sprint || !qualityAssuranceConfiguration) {
		qualityAssuranceSummaries = [];
		qualityAssuranceReportSprintIdentifier = null;
		qualityAssuranceErrorMessage = "";
		return;
	}

	isLoadingQualityAssuranceReport = true;
	qualityAssuranceErrorMessage = "";
	try {
		const issues = await loadQualityAssuranceSprintIssues(
			qualityAssuranceConfiguration.boardIdentifier,
			sprint.identifier,
			qualityAssuranceConfiguration.fieldMapping,
		);
		qualityAssuranceSummaries = summarizeQualityAssuranceSprintIssues(
			issues,
			qualityAssuranceConfiguration.statusMapping,
		);
		qualityAssuranceReportSprintIdentifier = sprint.identifier;
	} catch (error) {
		qualityAssuranceSummaries = [];
		qualityAssuranceReportSprintIdentifier = null;
		qualityAssuranceErrorMessage = reportErrorMessage(
			error,
			"Quality assurance performance could not be loaded.",
		);
	} finally {
		isLoadingQualityAssuranceReport = false;
	}
}

async function refreshReports(): Promise<void> {
	await Promise.all([
		refreshDevelopmentReport(),
		refreshQualityAssuranceReport(),
	]);
}

async function loadSprintList(): Promise<void> {
	isLoadingSprints = true;
	sprintHistoryErrorMessage = "";
	try {
		const sprintHistory = await initializeSprintHistory(
			configuration.boardIdentifier,
		);
		sprints = sprintHistory.sprints;
		nextClosedSprintPageRequest = sprintHistory.nextClosedSprintPageRequest;
		totalClosedSprints = sprintHistory.totalClosedSprints;
		const initialSprint =
			sprints.find((sprint) => sprint.state === "active") ?? sprints[0];
		if (!initialSprint) {
			throw new Error("This board has no active or closed sprints.");
		}
		selectedSprintIdentifier = String(initialSprint.identifier);
		selectSuggestedComparison();
		void refreshReports();
	} catch (error) {
		sprintHistoryFailure = "list";
		sprintHistoryErrorMessage =
			error instanceof Error ? error.message : "Sprints could not be loaded.";
	} finally {
		isLoadingSprints = false;
	}
}

async function loadOlderSprints(): Promise<void> {
	if (nextClosedSprintPageRequest === null || isLoadingOlderSprints) {
		return;
	}
	isLoadingOlderSprints = true;
	sprintHistoryErrorMessage = "";
	try {
		const sprintHistory = await loadOlderSprintHistoryPage(
			configuration.boardIdentifier,
			nextClosedSprintPageRequest,
		);
		sprints = mergeJiraSprints(sprints, sprintHistory.sprints);
		nextClosedSprintPageRequest = sprintHistory.nextClosedSprintPageRequest;
		totalClosedSprints = sprintHistory.totalClosedSprints ?? totalClosedSprints;
	} catch (error) {
		sprintHistoryFailure = "history";
		sprintHistoryErrorMessage =
			error instanceof Error
				? error.message
				: "Older sprints could not be loaded.";
	} finally {
		isLoadingOlderSprints = false;
	}
}

async function handleSprintChange(identifier: string): Promise<void> {
	selectedSprintIdentifier = identifier;
	selectSuggestedComparison();
	developmentComparisons = [];
	developmentReportSprintIdentifier = null;
	developmentReportComparisonIdentifier = null;
	qualityAssuranceReportSprintIdentifier = null;
	await refreshReports();
}

async function handleComparisonChange(identifier: string): Promise<void> {
	comparisonSprintIdentifier = identifier;
	developmentComparisons = [];
	developmentReportComparisonIdentifier = null;
	await refreshDevelopmentReport();
}

function retrySprintHistory(): void {
	if (sprintHistoryFailure === "history") {
		void loadOlderSprints();
	} else {
		void loadSprintList();
	}
}

onMount(() => {
	void loadSprintList();
});
</script>

<main class="mx-auto max-w-[94rem] px-5 py-8 sm:px-8 sm:py-10">
	<header
		class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"
	>
		<div class="max-w-3xl">
			<div class="flex flex-wrap items-center gap-3">
				<p class="eyebrow">{configuration.boardName}</p>
				{#if selectedSprint}
					<Badge
						tone={selectedSprint.state === "active"
							? "success"
							: "neutral"}
					>
						{selectedSprint.state === "active"
							? "Current sprint"
							: "Closed sprint"}
					</Badge>
				{/if}
			</div>
			<h1 class="display-title mt-3 text-4xl leading-none text-ice sm:text-5xl">
				Sprint performance
			</h1>
		</div>
		<Button
			variant="secondary"
			onclick={refreshReports}
			loading={isRefreshing}
			disabled={!selectedSprint || isLoadingSprints}
		>
			{isRefreshing ? "Updating scores…" : "Refresh scores"}
		</Button>
	</header>

	<Card class="mt-8 rounded-[1.2rem] p-5 sm:p-6" accent="brand">
		<div class="grid gap-5 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
			<SprintSelector
				label="Sprint to review"
				{sprints}
				selectedIdentifier={selectedSprintIdentifier}
				onSelect={handleSprintChange}
				onLoadOlder={loadOlderSprints}
				hasMore={nextClosedSprintPageRequest !== null}
				isLoadingMore={isLoadingOlderSprints}
				disabled={isLoadingSprints || isRefreshing}
				{totalClosedSprints}
			/>
			<SprintSelector
				label="Development comparison"
				sprints={sprints.filter((sprint) => sprint.state === "closed")}
				selectedIdentifier={comparisonSprintIdentifier}
				onSelect={handleComparisonChange}
				onLoadOlder={loadOlderSprints}
				hasMore={nextClosedSprintPageRequest !== null}
				isLoadingMore={isLoadingOlderSprints}
				disabled={isLoadingSprints || isLoadingDevelopmentReport}
				excludedIdentifier={selectedSprint?.identifier}
				emptyOptionLabel="No comparison"
				{totalClosedSprints}
			/>
			<div
				class="rounded-xl border border-line/70 bg-canvas/38 px-4 py-3 text-sm lg:min-w-48"
			>
				<p
					class="text-[0.66rem] font-bold uppercase tracking-[0.1em] text-muted"
				>
					Sprint window
				</p>
				<p class="mt-1.5 font-bold text-ice">
					{sprintDateDescription(selectedSprint)}
				</p>
			</div>
		</div>
	</Card>

	{#if sprintHistoryErrorMessage}
		<div class="mt-5">
			<Alert message={sprintHistoryErrorMessage} onRetry={retrySprintHistory} />
		</div>
	{/if}
	{#if developmentErrorMessage || developmentComparisonErrorMessage || qualityAssuranceErrorMessage}
		<div class="mt-5 grid gap-3">
			{#if developmentErrorMessage}
				<Alert
					message={`Development performance: ${developmentErrorMessage}`}
					onRetry={refreshDevelopmentReport}
				/>
			{/if}
			{#if developmentComparisonErrorMessage}
				<Alert
					message={`Development comparison: ${developmentComparisonErrorMessage}`}
					onRetry={refreshDevelopmentReport}
				/>
			{/if}
			{#if qualityAssuranceErrorMessage}
				<Alert
					message={`Quality assurance performance: ${qualityAssuranceErrorMessage}`}
					onRetry={refreshQualityAssuranceReport}
				/>
			{/if}
		</div>
	{/if}

	{#if isLoadingSprints}
		<LoadingState message="Opening the sprint arena…" />
	{:else if selectedSprint}
		<section
			class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
			aria-label="Team pulse"
		>
			<MetricCard
				label="Delivered"
				value={hasDevelopmentReport
					? formatNumber(totalDonePoints)
					: "—"}
				subtitle={hasDevelopmentReport
					? `${totalDevelopmentTickets} tracked development tickets`
					: "Waiting for development data"}
				tone="success"
				context="Development points"
			/>
			<MetricCard
				label="In the pipeline"
				value={hasDevelopmentReport
					? formatNumber(totalPipelinePoints)
					: "—"}
				subtitle={hasDevelopmentReport
					? `${formatNumber(totalProjectedPoints)} total projected`
					: "QA + Ready for QA"}
				tone="info"
				context="Development board"
			/>
			<MetricCard
				label="QA cleared"
				value={configuration.qualityAssurance &&
				hasQualityAssuranceReport
					? formatNumber(totalQualityAssuranceDonePoints)
					: "—"}
				subtitle={configuration.qualityAssurance
					? hasQualityAssuranceReport
						? `${totalQualityAssuranceTickets} tracked QA tickets`
						: "Waiting for QA data"
					: "Add a QA board in Settings"}
				tone="brand"
				context="Tester-owned points"
			/>
			<MetricCard
				label="Bounces"
				value={hasDevelopmentReport
					? formatNumber(totalBounceCount)
					: "—"}
				subtitle={hasDevelopmentReport
					? totalBounceCount > 0
						? "A signal to inspect, not a penalty"
						: "Clean flow this sprint"
					: "Waiting for development data"}
				tone={totalBounceCount > 0 ? "danger" : "neutral"}
				context="Bounce count"
			/>
		</section>

		<section class="mt-8" aria-labelledby="scoreboard-heading">
			<div
				class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
			>
				<h2
					id="scoreboard-heading"
					class="mt-2 text-2xl font-extrabold text-ice"
				>
					Team scoreboards
				</h2>
				<SegmentedControl
					segments={scoreboardSegments}
					bind:value={activeScoreboard}
					label="Sprint scoreboard"
				/>
			</div>

			<div class="mt-5">
				{#if activeScoreboard === "development"}
					{#if isLoadingDevelopmentReport && !hasDevelopmentReport}
						<LoadingState message="Calculating development momentum…" />
					{:else if hasDevelopmentReport}
						<DeveloperSprintScoreboard
							boardName={configuration.boardName}
							{jiraSiteUrl}
							statusMapping={configuration.statusMapping}
							summaries={developmentSummaries}
							comparisons={developmentComparisons}
							comparisonSprint={hasDevelopmentComparison
								? comparisonSprint
								: null}
						/>
					{/if}
				{:else if configuration.qualityAssurance}
					{#if isLoadingQualityAssuranceReport && !hasQualityAssuranceReport}
						<LoadingState message="Calculating QA throughput…" />
					{:else if hasQualityAssuranceReport}
						<QualityAssuranceSprintScoreboard
							configuration={configuration.qualityAssurance}
							{jiraSiteUrl}
							summaries={qualityAssuranceSummaries}
						/>
					{/if}
				{:else}
					<Card class="rounded-[1.2rem]">
						<EmptyState
							title="Bring QA into the sprint story"
							description="Add an optional QA board and map its Tester field to track cleared and ready work beside development performance."
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
		</section>
	{/if}
</main>
