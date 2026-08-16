<script lang="ts">
import { onMount } from "svelte";
import {
	loadDevelopmentAllTimeIssues,
	loadQualityAssuranceAllTimeIssues,
} from "../browser/api-client";
import type { AppConfiguration } from "../browser/configuration";
import {
	type AllTimeLeaderboardEntry,
	summarizeDeveloperAllTimeIssues,
	summarizeQualityAssuranceAllTimeIssues,
	totalAllTimeLeaderboard,
} from "../domain/all-time-performance";
import AllTimeLeaderboard from "./AllTimeLeaderboard.svelte";
import ErrorBanner from "./ErrorBanner.svelte";
import LoadingState from "./LoadingState.svelte";
import MetricCard from "./MetricCard.svelte";

interface Properties {
	configuration: AppConfiguration;
}

let { configuration }: Properties = $props();
let developerEntries = $state<AllTimeLeaderboardEntry[]>([]);
let qualityAssuranceEntries = $state<AllTimeLeaderboardEntry[]>([]);
let isLoading = $state(true);
let hasReport = $state(false);
let errorMessage = $state("");

let developerTotals = $derived(totalAllTimeLeaderboard(developerEntries));
let qualityAssuranceTotals = $derived(
	totalAllTimeLeaderboard(qualityAssuranceEntries),
);

const numberFormatter = new Intl.NumberFormat("en-US", {
	maximumFractionDigits: 1,
});

function formatNumber(value: number): string {
	return numberFormatter.format(value);
}

async function refreshReport(): Promise<void> {
	isLoading = true;
	errorMessage = "";
	try {
		const [developerIssues, qualityAssuranceIssues] = await Promise.all([
			loadDevelopmentAllTimeIssues(
				configuration.boardIdentifier,
				configuration.statusMapping.done,
				configuration.fieldMapping,
			),
			configuration.qualityAssurance
				? loadQualityAssuranceAllTimeIssues(
						configuration.qualityAssurance.boardIdentifier,
						configuration.qualityAssurance.statusMapping.done,
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
		hasReport = true;
	} catch (error) {
		errorMessage =
			error instanceof Error
				? error.message
				: "All-time performance could not be loaded.";
	} finally {
		isLoading = false;
	}
}

onMount(refreshReport);
</script>

<main class="mx-auto max-w-[94rem] px-5 py-8 sm:px-8 sm:py-10">
	<header
		class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"
	>
		<div>
			<p class="eyebrow">Lifetime achievements</p>
			<h1
				class="mt-3 text-3xl font-bold tracking-[-0.04em] text-white sm:text-4xl"
			>
				All-time leaderboard
			</h1>
			<p class="mt-2 max-w-3xl text-sm leading-6 text-muted">
				Completed work across the configured development and QA boards,
				independent of sprint selection. Only tickets currently in each board’s
				mapped Done status are counted.
			</p>
		</div>
		<button
			class="secondary-button shrink-0"
			type="button"
			onclick={refreshReport}
			disabled={isLoading}
		>
			<span class:is-rotating={isLoading} aria-hidden="true">↻</span>
			Refresh Jira
		</button>
	</header>

	{#if errorMessage}
		<div class="mt-6">
			<ErrorBanner message={errorMessage} onRetry={refreshReport} />
		</div>
	{/if}

	{#if isLoading}
		<LoadingState message="Calculating all-time performance…" />
	{:else if hasReport}
		<section class="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<MetricCard
				label="Developer points"
				value={formatNumber(developerTotals.completedPoints)}
				subtitle={`${developerEntries.length} ranked developers`}
				tone="mint"
			/>
			<MetricCard
				label="Developer tickets"
				value={String(developerTotals.completedTickets)}
				subtitle={configuration.boardName}
			/>
			<MetricCard
				label="QA points"
				value={configuration.qualityAssurance
					? formatNumber(qualityAssuranceTotals.completedPoints)
					: "—"}
				subtitle={configuration.qualityAssurance
					? `${qualityAssuranceEntries.length} ranked testers`
					: "QA board not configured"}
				tone="violet"
			/>
			<MetricCard
				label="QA tickets"
				value={configuration.qualityAssurance
					? String(qualityAssuranceTotals.completedTickets)
					: "—"}
				subtitle={configuration.qualityAssurance?.boardName ?? "Set up in Settings"}
			/>
		</section>

		<div class="mt-6 grid items-start gap-6 xl:grid-cols-2">
			<AllTimeLeaderboard
				title="Developer leaderboard"
				description={`Ranked by Done points, then Done ticket count · ${configuration.boardName}`}
				contributorLabel="Developer"
				entries={developerEntries}
				tone="mint"
			/>

			{#if configuration.qualityAssurance}
				<AllTimeLeaderboard
					title="QA leaderboard"
					description={`Ranked by Done points, then Done ticket count · ${configuration.qualityAssurance.boardName}`}
					contributorLabel="Tester"
					entries={qualityAssuranceEntries}
					tone="violet"
				/>
			{:else}
				<section class="surface-card rounded-2xl px-6 py-16 text-center">
					<p class="text-lg font-bold text-white">QA board not configured</p>
					<p class="mt-2 text-sm leading-6 text-muted">
						Add a QA board and map its Tester field in Settings to enable the
						all-time QA leaderboard.
					</p>
				</section>
			{/if}
		</div>
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
