<script lang="ts">
import { loadPeriodIssues } from "../browser/api-client";
import type { AppConfiguration } from "../browser/configuration";
import {
	compareResolvedSummaries,
	type DeveloperResolvedComparison,
	filterResolvedSummaries,
	summarizeResolvedIssues,
	totalResolvedSummary,
} from "../domain/period-performance";
import {
	SHARED_SNAPSHOT_VERSION,
	type SharedDeveloperResolvedComparison,
	type SharedPeriodComparisonSnapshot,
} from "../snapshot/schema";
import PeriodComparisonReport from "./PeriodComparisonReport.svelte";
import ShareSnapshotButton from "./ShareSnapshotButton.svelte";
import Alert from "./ui/Alert.svelte";
import Button from "./ui/Button.svelte";
import Card from "./ui/Card.svelte";
import Checkbox from "./ui/Checkbox.svelte";
import EmptyState from "./ui/EmptyState.svelte";
import Field from "./ui/Field.svelte";
import Input from "./ui/Input.svelte";
import LoadingState from "./ui/LoadingState.svelte";
import Textarea from "./ui/Textarea.svelte";

interface Properties {
	configuration: AppConfiguration;
}

interface PeriodReport {
	baselineLabel: string;
	baselineStartDate: string;
	baselineEndDate: string;
	comparisonLabel: string;
	comparisonStartDate: string;
	comparisonEndDate: string;
	scopeLabel: string;
	comparisons: DeveloperResolvedComparison[];
	totalComparison: DeveloperResolvedComparison;
}

let { configuration }: Properties = $props();

function dateWithOffset(dayOffset: number): string {
	const date = new Date();
	date.setHours(12, 0, 0, 0);
	date.setDate(date.getDate() + dayOffset);
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

let baselineLabel = $state("Baseline");
let baselineStartDate = $state(dateWithOffset(-59));
let baselineEndDate = $state(dateWithOffset(-30));
let comparisonLabel = $state("Comparison");
let comparisonStartDate = $state(dateWithOffset(-29));
let comparisonEndDate = $state(dateWithOffset(0));
let projectKey = $state("");
let lastConfiguredProjectKey = $state<string | null>(null);
let usesAdvancedQuery = $state(false);
let customQuery = $state("");
let developerFilters = $state("");
let report = $state<PeriodReport | null>(null);
let reportRevision = $state(0);
let isLoading = $state(false);
let errorMessage = $state("");

$effect(() => {
	const configuredProjectKey = configuration.defaultProjectKey;
	if (
		lastConfiguredProjectKey === null ||
		projectKey === lastConfiguredProjectKey
	) {
		projectKey = configuredProjectKey;
	}
	lastConfiguredProjectKey = configuredProjectKey;
});

function parsedDeveloperFilters(filterText: string): string[] {
	return filterText
		.split(/[,\n]/)
		.map((filter) => filter.trim())
		.filter(Boolean);
}

function createSharedComparison(
	comparison: DeveloperResolvedComparison,
): SharedDeveloperResolvedComparison {
	return {
		developer: comparison.developer,
		baselinePoints: comparison.baselinePoints,
		comparisonPoints: comparison.comparisonPoints,
		pointsDelta: comparison.pointsDelta,
		pointsChange: comparison.pointsChange,
		baselineTickets: comparison.baselineTickets,
		comparisonTickets: comparison.comparisonTickets,
		ticketsDelta: comparison.ticketsDelta,
	};
}

function createSharedSnapshot(): SharedPeriodComparisonSnapshot {
	const currentReport = report;
	if (!currentReport) {
		throw new Error("Run a comparison before creating a share link.");
	}

	return {
		version: SHARED_SNAPSHOT_VERSION,
		kind: "period-comparison",
		capturedAt: new Date().toISOString(),
		report: {
			scopeLabel: currentReport.scopeLabel,
			baseline: {
				label: currentReport.baselineLabel,
				startDate: currentReport.baselineStartDate,
				endDate: currentReport.baselineEndDate,
			},
			comparison: {
				label: currentReport.comparisonLabel,
				startDate: currentReport.comparisonStartDate,
				endDate: currentReport.comparisonEndDate,
			},
			comparisons: currentReport.comparisons.map(createSharedComparison),
			totalComparison: createSharedComparison(currentReport.totalComparison),
		},
	};
}

async function runComparison(event?: SubmitEvent): Promise<void> {
	event?.preventDefault();
	const requestedBaselineLabel = baselineLabel.trim() || "Baseline";
	const requestedBaselineStartDate = baselineStartDate;
	const requestedBaselineEndDate = baselineEndDate;
	const requestedComparisonLabel = comparisonLabel.trim() || "Comparison";
	const requestedComparisonStartDate = comparisonStartDate;
	const requestedComparisonEndDate = comparisonEndDate;
	const requestedProjectKey = projectKey.trim();
	const requestedCustomQuery = customQuery.trim();
	const requestedDeveloperFilters = developerFilters;
	const requestedAdvancedQuery = usesAdvancedQuery;
	report = null;
	isLoading = true;
	errorMessage = "";
	try {
		if (requestedAdvancedQuery && !requestedCustomQuery) {
			throw new Error(
				"Enter a Jira query before running an advanced comparison.",
			);
		}
		if (!requestedAdvancedQuery && !requestedProjectKey) {
			throw new Error("Enter a Jira project key.");
		}
		if (requestedBaselineStartDate > requestedBaselineEndDate) {
			throw new Error("The baseline start date must be before its end date.");
		}
		if (requestedComparisonStartDate > requestedComparisonEndDate) {
			throw new Error("The comparison start date must be before its end date.");
		}

		const scope = requestedAdvancedQuery
			? { scopeQuery: requestedCustomQuery }
			: { projectKey: requestedProjectKey };
		const [baselineResult, comparisonResult] = await Promise.all([
			loadPeriodIssues({
				startDate: requestedBaselineStartDate,
				endDate: requestedBaselineEndDate,
				fieldMapping: configuration.fieldMapping,
				...scope,
			}),
			loadPeriodIssues({
				startDate: requestedComparisonStartDate,
				endDate: requestedComparisonEndDate,
				fieldMapping: configuration.fieldMapping,
				...scope,
			}),
		]);
		const filters = parsedDeveloperFilters(requestedDeveloperFilters);
		const baselineSummaries = filterResolvedSummaries(
			summarizeResolvedIssues(baselineResult.issues),
			filters,
		);
		const comparisonSummaries = filterResolvedSummaries(
			summarizeResolvedIssues(comparisonResult.issues),
			filters,
		);
		const baselineTotal = totalResolvedSummary(
			"All Developers",
			baselineSummaries,
		);
		const comparisonTotal = totalResolvedSummary(
			"All Developers",
			comparisonSummaries,
		);
		report = {
			baselineLabel: requestedBaselineLabel,
			baselineStartDate: requestedBaselineStartDate,
			baselineEndDate: requestedBaselineEndDate,
			comparisonLabel: requestedComparisonLabel,
			comparisonStartDate: requestedComparisonStartDate,
			comparisonEndDate: requestedComparisonEndDate,
			scopeLabel: requestedAdvancedQuery
				? "Advanced Jira scope"
				: `Project ${requestedProjectKey}`,
			comparisons: compareResolvedSummaries(
				baselineSummaries,
				comparisonSummaries,
			),
			totalComparison: compareResolvedSummaries(
				[baselineTotal],
				[comparisonTotal],
			)[0],
		};
		reportRevision += 1;
	} catch (error) {
		errorMessage =
			error instanceof Error
				? error.message
				: "The period comparison could not be loaded.";
	} finally {
		isLoading = false;
	}
}
</script>

<main class="mx-auto max-w-[94rem] px-5 py-8 sm:px-8 sm:py-10">
	<header
		class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
	>
		<div class="max-w-3xl">
			<h1 class="display-title mt-3 text-4xl leading-none text-ice sm:text-5xl">
				Compare periods
			</h1>
			<p class="mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base">
				Put two delivery windows side by side to spot team movement
			</p>
		</div>
		<ShareSnapshotButton
			createSnapshot={createSharedSnapshot}
			snapshotIdentity={String(reportRevision)}
			disabled={isLoading || !report}
		/>
	</header>

	<Card class="mt-8 rounded-[1.2rem] p-5 sm:p-6" accent="info">
		<form onsubmit={runComparison}>
			<div class="grid gap-6 lg:grid-cols-2 lg:gap-8">
				<fieldset class="grid gap-4 sm:grid-cols-2">
					<legend
						class="mb-1 flex items-center gap-2 text-sm font-extrabold text-ice"
					>
						<span
							class="grid size-6 place-items-center rounded-full bg-muted/15 font-mono text-[0.65rem] text-muted"
							>A</span
						>
						Baseline period
					</legend>
					<Field label="Label" compact class="sm:col-span-2">
						<Input bind:value={baselineLabel} />
					</Field>
					<Field label="From" compact>
						<Input type="date" bind:value={baselineStartDate} required />
					</Field>
					<Field label="Through" compact>
						<Input type="date" bind:value={baselineEndDate} required />
					</Field>
				</fieldset>

				<fieldset
					class="grid gap-4 border-t border-line/60 pt-6 sm:grid-cols-2 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0"
				>
					<legend
						class="mb-1 flex items-center gap-2 text-sm font-extrabold text-ice"
					>
						<span
							class="grid size-6 place-items-center rounded-full bg-sky/15 font-mono text-[0.65rem] text-sky"
							>B</span
						>
						Comparison period
					</legend>
					<Field label="Label" compact class="sm:col-span-2">
						<Input bind:value={comparisonLabel} />
					</Field>
					<Field label="From" compact>
						<Input type="date" bind:value={comparisonStartDate} required />
					</Field>
					<Field label="Through" compact>
						<Input type="date" bind:value={comparisonEndDate} required />
					</Field>
				</fieldset>
			</div>

			<div
				class="mt-7 grid gap-5 border-t border-line/60 pt-6 lg:grid-cols-[1fr_1.4fr]"
			>
				<div>
					<label
						class="flex items-center gap-3 text-sm font-bold text-ice"
						for="uses-advanced-query"
					>
						<Checkbox
							id="uses-advanced-query"
							bind:checked={usesAdvancedQuery}
						/>
						Use advanced JQL scope
					</label>
					{#if usesAdvancedQuery}
						<Field
							label="JQL scope"
							compact
							hint="Resolution dates and ordering are added safely by the app."
							class="mt-3"
						>
							<Textarea
								class="min-h-24 resize-y font-mono text-xs"
								bind:value={customQuery}
								placeholder="project = DEMO AND component = Platform"
							/>
						</Field>
					{:else}
						<Field label="Project key" compact class="mt-3 max-w-xs">
							<Input bind:value={projectKey} placeholder="DEMO" required />
						</Field>
					{/if}
				</div>
				<Field
					label="Developers · optional"
					compact
					hint="Leave empty for everyone, or separate exact display names with commas or new lines."
				>
					<Textarea
						class="min-h-24 resize-y"
						bind:value={developerFilters}
						placeholder="Alex Morgan, Bailey Chen"
					/>
				</Field>
			</div>

			<div class="mt-6 flex justify-end">
				<Button
					variant="primary"
					size="large"
					type="submit"
					loading={isLoading}
					class="min-w-44"
				>
					{isLoading ? "Comparing…" : "Run comparison"}
				</Button>
			</div>
		</form>
	</Card>

	{#if errorMessage}
		<div class="mt-6">
			<Alert message={errorMessage} onRetry={() => runComparison()} />
		</div>
	{/if}

	{#if isLoading && !report}
		<LoadingState message="Comparing resolved work…" />
	{:else if report}
		<PeriodComparisonReport
			baselineLabel={report.baselineLabel}
			comparisonLabel={report.comparisonLabel}
			comparisons={report.comparisons}
			totalComparison={report.totalComparison}
		/>
	{:else}
		<Card class="mt-8 rounded-[1.2rem] border-dashed">
			<EmptyState
				title="Choose two periods"
				description="The default windows compare the previous 30 days with the most recent 30 days."
				symbol="↔"
			/>
		</Card>
	{/if}
</main>
