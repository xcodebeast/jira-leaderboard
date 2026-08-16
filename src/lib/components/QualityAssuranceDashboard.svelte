<script lang="ts">
import { onMount } from "svelte";
import { loadQualityAssuranceSprintIssues } from "../browser/api-client";
import type { QualityAssuranceConfiguration } from "../browser/configuration";
import {
	type ClosedSprintPageRequest,
	initializeSprintHistory,
	loadOlderSprintHistoryPage,
} from "../browser/sprint-history";
import { type JiraSprint, mergeJiraSprints } from "../domain/jira";
import {
	qualityAssuranceTicketDisplay,
	summarizeQualityAssuranceSprintIssues,
	type TesterSprintSummary,
	totalQualityAssuranceTicketCount,
} from "../domain/quality-assurance-performance";
import ErrorBanner from "./ErrorBanner.svelte";
import LoadingState from "./LoadingState.svelte";
import MetricCard from "./MetricCard.svelte";
import SprintSelector from "./SprintSelector.svelte";

interface Properties {
	developmentBoardIdentifier: number;
	developmentBoardName: string;
	configuration: QualityAssuranceConfiguration;
}

let {
	developmentBoardIdentifier,
	developmentBoardName,
	configuration,
}: Properties = $props();
let sprints = $state<JiraSprint[]>([]);
let selectedSprintIdentifier = $state("");
let summaries = $state<TesterSprintSummary[]>([]);
let isLoadingSprints = $state(true);
let isLoadingOlderSprints = $state(false);
let isLoadingReport = $state(false);
let nextClosedSprintPageRequest = $state<ClosedSprintPageRequest | null>(null);
let totalClosedSprints = $state<number | null>(null);
let errorMessage = $state("");
let failedOperation = $state<"list" | "history" | "report">("list");
let hasReport = $state(false);

const numberFormatter = new Intl.NumberFormat("en-US", {
	maximumFractionDigits: 1,
});

let selectedSprint = $derived(
	sprints.find(
		(sprint) => sprint.identifier === Number(selectedSprintIdentifier),
	) ?? null,
);
let totalDoneStoryPoints = $derived(
	summaries.reduce((total, summary) => total + summary.doneStoryPoints, 0),
);
let totalDoneTickets = $derived(
	summaries.reduce((total, summary) => total + summary.doneTicketCount, 0),
);
let totalReadyStoryPoints = $derived(
	summaries.reduce(
		(total, summary) => total + summary.readyForQualityAssuranceStoryPoints,
		0,
	),
);
let totalReadyTickets = $derived(
	summaries.reduce(
		(total, summary) => total + summary.readyForQualityAssuranceTicketCount,
		0,
	),
);
let maximumDoneStoryPoints = $derived(
	Math.max(1, ...summaries.map((summary) => summary.doneStoryPoints)),
);

function formatNumber(value: number): string {
	return numberFormatter.format(value);
}

function testerInitials(name: string): string {
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

async function refreshReport(): Promise<void> {
	if (!selectedSprint) {
		return;
	}
	isLoadingReport = true;
	errorMessage = "";
	try {
		const issues = await loadQualityAssuranceSprintIssues(
			configuration.boardIdentifier,
			selectedSprint.identifier,
			configuration.fieldMapping,
		);
		summaries = summarizeQualityAssuranceSprintIssues(
			issues,
			configuration.statusMapping,
		);
		hasReport = true;
	} catch (error) {
		failedOperation = "report";
		errorMessage =
			error instanceof Error
				? error.message
				: "Quality assurance performance could not be loaded.";
	} finally {
		isLoadingReport = false;
	}
}

async function loadSprintList(): Promise<void> {
	isLoadingSprints = true;
	errorMessage = "";
	try {
		const sprintHistory = await initializeSprintHistory(
			developmentBoardIdentifier,
		);
		sprints = sprintHistory.sprints;
		nextClosedSprintPageRequest = sprintHistory.nextClosedSprintPageRequest;
		totalClosedSprints = sprintHistory.totalClosedSprints;
		const initialSprint =
			sprints.find((sprint) => sprint.state === "active") ?? sprints[0];
		if (!initialSprint) {
			throw new Error("The development board has no active or closed sprints.");
		}
		selectedSprintIdentifier = String(initialSprint.identifier);
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
			developmentBoardIdentifier,
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
				QA performance
			</h1>
			<p class="mt-2 text-sm text-muted">
				Tester-owned work scoped by this board and {developmentBoardName}’s
				sprint.
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
		class="surface-card mt-8 grid gap-5 rounded-2xl p-5 md:grid-cols-[1fr_auto] md:items-end"
	>
		<SprintSelector
			label="Development sprint"
			{sprints}
			selectedIdentifier={selectedSprintIdentifier}
			onSelect={handleSprintChange}
			onLoadOlder={loadOlderSprints}
			hasMore={nextClosedSprintPageRequest !== null}
			isLoadingMore={isLoadingOlderSprints}
			disabled={isLoadingSprints || isLoadingReport}
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
			message={isLoadingSprints ? "Finding recent sprints…" : "Calculating QA performance…"}
		/>
	{:else if hasReport}
		<section class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<MetricCard
				label="Done points"
				value={formatNumber(totalDoneStoryPoints)}
				subtitle={configuration.statusMapping.done}
				tone="mint"
			/>
			<MetricCard
				label="Done tickets"
				value={String(totalDoneTickets)}
				subtitle="Completed QA workload"
			/>
			<MetricCard
				label="Ready points"
				value={formatNumber(totalReadyStoryPoints)}
				subtitle={configuration.statusMapping.readyForQualityAssurance}
				tone="violet"
			/>
			<MetricCard
				label="Ready tickets"
				value={String(totalReadyTickets)}
				subtitle="Current QA queue"
			/>
		</section>

		<section class="surface-card mt-6 overflow-hidden rounded-2xl">
			<div
				class="flex flex-col gap-2 border-b border-line/70 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
			>
				<div>
					<h2 class="font-bold text-white">QA leaderboard</h2>
					<p class="mt-1 text-xs text-muted">
						Ranked by done story points, then done ticket count.
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
						><i
							class="mr-1.5 inline-block size-2 rounded-full bg-violet"
						></i>Ready for QA</span
					>
				</div>
			</div>

			{#if summaries.length === 0}
				<div class="px-6 py-16 text-center">
					<p class="text-lg font-bold text-white">No tracked QA tickets</p>
					<p class="mt-2 text-sm text-muted">
						No issues in this board and sprint matched the configured statuses.
					</p>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full min-w-[54rem] border-collapse text-left">
						<thead
							class="bg-canvas/35 text-[0.67rem] uppercase tracking-[0.1em] text-muted"
						>
							<tr>
								<th class="px-6 py-3 font-semibold">Tester</th>
								<th class="px-4 py-3 text-right font-semibold">Done points</th>
								<th class="px-4 py-3 text-right font-semibold">Done tickets</th>
								<th class="px-4 py-3 text-right font-semibold">Ready points</th>
								<th class="px-4 py-3 text-right font-semibold">
									Ready tickets
								</th>
								<th class="px-6 py-3 font-semibold">Tickets</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-line/55">
							{#each summaries as summary, rank (summary.tester)}
								<tr class="transition-colors hover:bg-panel-soft/45">
									<td class="px-6 py-4">
										<div class="flex items-center gap-3">
											<span class="w-5 font-mono text-xs text-muted"
												>{String(rank + 1).padStart(2, "0")}</span
											>
											<span
												class="grid size-9 place-items-center rounded-xl bg-violet/10 text-xs font-bold text-violet"
												>{testerInitials(summary.tester)}</span
											>
											<span class="font-semibold text-ice"
												>{summary.tester}</span
											>
										</div>
									</td>
									<td class="px-4 py-4">
										<div class="flex items-center justify-end gap-3">
											<div
												class="h-1.5 w-20 overflow-hidden rounded-full bg-line"
											>
												<div
													class="h-full rounded-full bg-mint"
													style={`width: ${(summary.doneStoryPoints / maximumDoneStoryPoints) * 100}%`}
												></div>
											</div>
											<span
												class="metric-value w-9 text-right font-bold text-mint"
												>{formatNumber(summary.doneStoryPoints)}</span
											>
										</div>
									</td>
									<td
										class="metric-value px-4 py-4 text-right font-semibold text-ice"
									>
										{summary.doneTicketCount}
									</td>
									<td class="metric-value px-4 py-4 text-right text-violet">
										{formatNumber(summary.readyForQualityAssuranceStoryPoints)}
									</td>
									<td class="metric-value px-4 py-4 text-right text-ice">
										{summary.readyForQualityAssuranceTicketCount}
									</td>
									<td class="px-6 py-4">
										<details class="max-w-xs">
											<summary
												class="cursor-pointer text-xs font-semibold text-muted hover:text-ice"
											>
												{totalQualityAssuranceTicketCount(summary)}
												{totalQualityAssuranceTicketCount(summary) === 1 ? "ticket" : "tickets"}
											</summary>
											<p
												class="mt-2 text-xs leading-5 text-muted"
												title={summary.tickets.map((ticket) => ticket.summary).join(" · ")}
											>
												{summary.tickets.map(qualityAssuranceTicketDisplay).join(", ")}
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
