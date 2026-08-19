<script lang="ts">
import { onMount } from "svelte";
import { loadSprintIssues } from "../browser/api-client";
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
	compareSprintSummaries,
	type DeveloperSprintComparison,
	type DeveloperSprintSummary,
	projectedSprintPoints,
	sprintTicketDisplay,
	summarizeSprintIssues,
} from "../domain/sprint-performance";
import ErrorBanner from "./ErrorBanner.svelte";
import LoadingState from "./LoadingState.svelte";
import MetricCard from "./MetricCard.svelte";
import SprintSelector from "./SprintSelector.svelte";

interface Properties {
	configuration: AppConfiguration;
}

let { configuration }: Properties = $props();
let sprints = $state<JiraSprint[]>([]);
let selectedSprintIdentifier = $state("");
let comparisonSprintIdentifier = $state("");
let summaries = $state<DeveloperSprintSummary[]>([]);
let comparisons = $state<DeveloperSprintComparison[]>([]);
let isLoadingSprints = $state(true);
let isLoadingOlderSprints = $state(false);
let isLoadingReport = $state(false);
let errorMessage = $state("");
let hasReport = $state(false);
let nextClosedSprintPageRequest = $state<ClosedSprintPageRequest | null>(null);
let totalClosedSprints = $state<number | null>(null);
let failedOperation = $state<"list" | "history" | "report">("list");

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
let totalDonePoints = $derived(
	summaries.reduce((total, summary) => total + summary.donePoints, 0),
);
let totalProjectedPoints = $derived(
	summaries.reduce(
		(total, summary) => total + projectedSprintPoints(summary),
		0,
	),
);
let totalBounceCount = $derived(
	summaries.reduce((total, summary) => total + summary.bounceCount, 0),
);
let totalTickets = $derived(
	summaries.reduce((total, summary) => total + summary.tickets.length, 0),
);
const numberFormatter = new Intl.NumberFormat("en-US", {
	maximumFractionDigits: 1,
});

function formatNumber(value: number): string {
	return numberFormatter.format(value);
}

function formatDelta(value: number): string {
	return `${value > 0 ? "+" : ""}${formatNumber(value)}`;
}

function deltaClass(value: number): string {
	return value > 0 ? "text-mint" : value < 0 ? "text-coral" : "text-muted";
}

function developerInitials(name: string): string {
	return name
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase())
		.join("");
}

function sprintDateDescription(sprint: JiraSprint | null): string {
	if (!sprint?.startDate || !sprint.endDate) {
		return "Dates unavailable";
	}
	const formatter = new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
	});
	return `${formatter.format(new Date(sprint.startDate))} – ${formatter.format(new Date(sprint.endDate))}`;
}

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

async function refreshReport(): Promise<void> {
	if (!selectedSprint) {
		return;
	}
	isLoadingReport = true;
	errorMessage = "";
	try {
		const [currentIssues, previousIssues] = await Promise.all([
			loadSprintIssues(selectedSprint.identifier, configuration.fieldMapping),
			comparisonSprint
				? loadSprintIssues(
						comparisonSprint.identifier,
						configuration.fieldMapping,
					)
				: Promise.resolve([]),
		]);
		summaries = summarizeSprintIssues(
			currentIssues,
			configuration.statusMapping,
		);
		const previousSummaries = summarizeSprintIssues(
			previousIssues,
			configuration.statusMapping,
		);
		comparisons = comparisonSprint
			? compareSprintSummaries(summaries, previousSummaries)
			: [];
		hasReport = true;
	} catch (error) {
		failedOperation = "report";
		errorMessage =
			error instanceof Error
				? error.message
				: "Sprint performance could not be loaded.";
	} finally {
		isLoadingReport = false;
	}
}

async function loadSprintList(): Promise<void> {
	isLoadingSprints = true;
	errorMessage = "";
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
		await refreshReport();
	} catch (error) {
		failedOperation = "list";
		errorMessage =
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
	errorMessage = "";
	try {
		const sprintHistory = await loadOlderSprintHistoryPage(
			configuration.boardIdentifier,
			nextClosedSprintPageRequest,
		);
		sprints = mergeJiraSprints(sprints, sprintHistory.sprints);
		nextClosedSprintPageRequest = sprintHistory.nextClosedSprintPageRequest;
		totalClosedSprints = sprintHistory.totalClosedSprints ?? totalClosedSprints;
	} catch (error) {
		failedOperation = "history";
		errorMessage =
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
	await refreshReport();
}

async function handleComparisonChange(identifier: string): Promise<void> {
	comparisonSprintIdentifier = identifier;
	await refreshReport();
}

function retryLastFailure(): void {
	if (failedOperation === "list") {
		void loadSprintList();
	} else if (failedOperation === "history") {
		void loadOlderSprints();
	} else {
		void refreshReport();
	}
}

onMount(loadSprintList);
</script>

<main class="mx-auto max-w-[94rem] px-5 py-8 sm:px-8 sm:py-10">
	<header
		class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"
	>
		<div>
			<p class="eyebrow">{configuration.boardName}</p>
			<h1
				class="mt-3 text-3xl font-bold tracking-[-0.04em] text-white sm:text-4xl"
			>
				Sprint performance
			</h1>
			<p class="mt-2 text-sm text-muted">
				Completed, near-done, and bounced work from the Developer field.
			</p>
		</div>
		<button
			class="secondary-button"
			type="button"
			onclick={refreshReport}
			disabled={isLoadingReport || !selectedSprint}
		>
			<span class:is-rotating={isLoadingReport} aria-hidden="true">↻</span>
			Refresh Jira
		</button>
	</header>

	<section
		class="surface-card mt-8 grid gap-5 rounded-2xl p-5 md:grid-cols-[1fr_1fr_auto] md:items-end"
	>
		<SprintSelector
			label="Sprint to review"
			{sprints}
			selectedIdentifier={selectedSprintIdentifier}
			onSelect={handleSprintChange}
			onLoadOlder={loadOlderSprints}
			hasMore={nextClosedSprintPageRequest !== null}
			isLoadingMore={isLoadingOlderSprints}
			disabled={isLoadingSprints || isLoadingReport}
			{totalClosedSprints}
		/>
		<SprintSelector
			label="Compare against"
			sprints={sprints.filter((sprint) => sprint.state === "closed")}
			selectedIdentifier={comparisonSprintIdentifier}
			onSelect={handleComparisonChange}
			onLoadOlder={loadOlderSprints}
			hasMore={nextClosedSprintPageRequest !== null}
			isLoadingMore={isLoadingOlderSprints}
			disabled={isLoadingSprints || isLoadingReport}
			excludedIdentifier={selectedSprint?.identifier}
			emptyOptionLabel="No comparison"
			{totalClosedSprints}
		/>
		<div
			class="rounded-xl border border-line/60 bg-canvas/35 px-4 py-3 text-sm md:min-w-44"
		>
			<p class="text-xs text-muted">Sprint window</p>
			<p class="mt-1 font-semibold text-ice">
				{sprintDateDescription(selectedSprint)}
			</p>
		</div>
	</section>

	{#if errorMessage}
		<div class="mt-6">
			<ErrorBanner message={errorMessage} onRetry={retryLastFailure} />
		</div>
	{/if}

	{#if isLoadingSprints || isLoadingReport}
		<LoadingState
			message={isLoadingSprints
				? "Finding recent sprints…"
				: "Calculating sprint performance…"}
		/>
	{:else if hasReport}
		<section class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<MetricCard
				label="Done points"
				value={formatNumber(totalDonePoints)}
				subtitle={configuration.statusMapping.done}
				tone="mint"
			/>
			<MetricCard
				label="Projected points"
				value={formatNumber(totalProjectedPoints)}
				subtitle={`${configuration.statusMapping.done} + QA pipeline`}
				tone="violet"
			/>
			<MetricCard
				label="Tracked tickets"
				value={String(totalTickets)}
				subtitle="Across mapped statuses"
			/>
			<MetricCard
				label="Bounce count"
				value={formatNumber(totalBounceCount)}
				subtitle="Quality loop signal"
				tone={totalBounceCount > 0 ? "coral" : "neutral"}
			/>
		</section>

		<section class="surface-card mt-6 overflow-hidden rounded-2xl">
			<div
				class="flex flex-col gap-2 border-b border-line/70 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
			>
				<div>
					<h2 class="font-bold text-white">Developer scoreboard</h2>
					<p class="mt-1 text-xs text-muted">
						Ranked by done points, then projected points.
					</p>
				</div>
				<div
					class="flex flex-wrap gap-3 text-[0.68rem] font-semibold text-muted"
				>
					<span
						><i
							class="mr-1.5 inline-block size-2 rounded-full bg-mint"
						></i>Done</span
					>
					<span
						><i class="mr-1.5 inline-block size-2 rounded-full bg-violet"></i>QA
						pipeline</span
					>
				</div>
			</div>

			{#if summaries.length === 0}
				<div class="px-6 py-16 text-center">
					<p class="text-lg font-bold text-white">No tracked tickets</p>
					<p class="mt-2 text-sm text-muted">
						No issues matched the three configured sprint statuses.
					</p>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full min-w-[52rem] border-collapse text-left">
						<thead
							class="bg-canvas/35 text-[0.67rem] uppercase tracking-[0.1em] text-muted"
						>
							<tr>
								<th class="px-6 py-3 font-semibold">Developer</th>
								<th class="px-4 py-3 text-right font-semibold">Done</th>
								<th class="px-4 py-3 text-right font-semibold">QA</th>
								<th class="px-4 py-3 text-right font-semibold">Ready</th>
								<th class="px-4 py-3 text-right font-semibold">Projected</th>
								<th class="px-4 py-3 text-right font-semibold">Bounces</th>
								<th class="px-6 py-3 font-semibold">Tickets</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-line/55">
							{#each summaries as summary, rank (summary.developer)}
								<tr class="transition-colors hover:bg-panel-soft/45">
									<td class="px-6 py-4">
										<div class="flex items-center gap-3">
											<span class="w-5 font-mono text-xs text-muted"
												>{String(rank + 1).padStart(
													2,
													"0",
												)}</span
											><span
												class="grid size-9 place-items-center rounded-xl bg-mint/10 text-xs font-bold text-mint"
												>{developerInitials(
													summary.developer,
												)}</span
											><span class="font-semibold text-ice"
												>{summary.developer}</span
											>
										</div>
									</td>
									<td
										class="metric-value px-4 py-4 text-right font-bold text-mint"
									>
										{formatNumber(summary.donePoints)}
									</td>
									<td class="metric-value px-4 py-4 text-right text-ice">
										{formatNumber(
											summary.qualityAssurancePoints,
										)}
									</td>
									<td class="metric-value px-4 py-4 text-right text-ice">
										{formatNumber(
											summary.readyForQualityAssurancePoints,
										)}
									</td>
									<td class="metric-value px-4 py-4 text-right text-violet">
										{formatNumber(
											projectedSprintPoints(summary),
										)}
									</td>
									<td
										class="metric-value px-4 py-4 text-right"
										class:text-coral={summary.bounceCount >
											0}
									>
										{formatNumber(summary.bounceCount)}
									</td>
									<td class="px-6 py-4">
										<details class="max-w-xs">
											<summary
												class="cursor-pointer text-xs font-semibold text-muted hover:text-ice"
											>
												{summary.tickets.length}
												{summary.tickets.length === 1
													? "ticket"
													: "tickets"}
											</summary>
											<p
												class="mt-2 text-xs leading-5 text-muted"
												title={summary.tickets
													.map(
														(ticket) =>
															ticket.summary,
													)
													.join(" · ")}
											>
												{summary.tickets
													.map(sprintTicketDisplay)
													.join(", ")}
											</p>
										</details>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>

		{#if comparisonSprint && comparisons.length > 0}
			<section class="surface-card mt-6 rounded-2xl p-5 sm:p-6">
				<div
					class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"
				>
					<div>
						<p class="eyebrow">Velocity shift</p>
						<h2 class="mt-2 text-lg font-bold text-white">
							Compared with {comparisonSprint.name}
						</h2>
					</div>
					<p class="text-xs text-muted">
						Positive values mean more points in the selected sprint.
					</p>
				</div>
				<div class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
					{#each comparisons as comparison (comparison.developer)}
						<article class="rounded-xl border border-line/65 bg-canvas/30 p-4">
							<div class="flex items-center justify-between gap-3">
								<h3 class="truncate font-semibold text-ice">
									{comparison.developer}
								</h3>
								<span
									class={`metric-value text-lg font-bold ${deltaClass(comparison.projectedPointsDelta)}`}
									>{formatDelta(
										comparison.projectedPointsDelta,
									)}</span
								>
							</div>
							<div class="mt-3 grid grid-cols-3 gap-2 text-xs">
								<p class="text-muted">
									Done
									<span
										class={`ml-1 font-mono ${deltaClass(comparison.donePointsDelta)}`}
										>{formatDelta(
											comparison.donePointsDelta,
										)}</span
									>
								</p>
								<p class="text-muted">
									QA
									<span
										class={`ml-1 font-mono ${deltaClass(comparison.qualityAssurancePointsDelta)}`}
										>{formatDelta(
											comparison.qualityAssurancePointsDelta,
										)}</span
									>
								</p>
								<p class="text-muted">
									Bounce
									<span
										class={`ml-1 font-mono ${deltaClass(-comparison.bounceCountDelta)}`}
										>{formatDelta(
											comparison.bounceCountDelta,
										)}</span
									>
								</p>
							</div>
						</article>
					{/each}
				</div>
			</section>
		{/if}
	{/if}
</main>

<style>
.is-rotating {
	display: inline-block;
	animation: rotate 0.8s linear infinite;
}

@keyframes rotate {
	to {
		transform: rotate(360deg);
	}
}
</style>
