<script lang="ts">
import { onDestroy, onMount } from "svelte";
import {
	loadDevelopmentAllTimeIssues,
	loadQualityAssuranceAllTimeIssues,
} from "../browser/api-client";
import type { AppConfiguration } from "../browser/configuration";
import type { ContributorProfileSelection } from "../domain/contributor";
import {
	type ContributorWorkItem,
	developmentWorkForContributor,
	qualityAssuranceWorkForContributor,
} from "../domain/contributor-performance";
import {
	automaticGranularity,
	buildPerformanceTimeline,
	calendarDate,
	daysInRange,
	type PerformanceBucket,
	type PerformanceGranularity,
	type PerformanceMetric,
	type PerformanceRange,
	percentageChange,
	performanceTotals,
	previousPerformanceRange,
	rangeLabel,
	workInRange,
} from "../domain/contributor-timeline";
import { formatNumber } from "../presentation/format";
import ContributorPerformanceChart from "./ContributorPerformanceChart.svelte";
import ContributorWorkHistory from "./ContributorWorkHistory.svelte";
import Alert from "./ui/Alert.svelte";
import Badge from "./ui/Badge.svelte";
import Button from "./ui/Button.svelte";
import Card from "./ui/Card.svelte";
import EmptyState from "./ui/EmptyState.svelte";
import Field from "./ui/Field.svelte";
import Icon from "./ui/Icon.svelte";
import LoadingState from "./ui/LoadingState.svelte";
import MetricCard from "./ui/MetricCard.svelte";
import Select from "./ui/Select.svelte";

interface Properties {
	configuration: AppConfiguration;
	jiraSiteUrl: string;
	selection: ContributorProfileSelection;
	onBack: () => void;
}
let { configuration, jiraSiteUrl, selection, onBack }: Properties = $props();
const today = new Date().toLocaleDateString("en-CA");
let range = $state<PerformanceRange>({ start: today, end: today });
let workItems = $state<ContributorWorkItem[]>([]);
let hasLoaded = $state(false);
let isLoading = $state(true);
let errorMessage = $state("");
let loadedAt = $state("");
let loadRevision = 0;
let granularitySelection = $state<PerformanceGranularity | "auto">("auto");
let metric = $state<PerformanceMetric>("completedPoints");
let selectedBucket = $state<PerformanceBucket | null>(null);
let isDevelopment = $derived(selection.role === "development");
let roleLabel = $derived(isDevelopment ? "Developer" : "Quality assurance");
let pointsLabel = $derived(
	isDevelopment ? "Delivered points" : "Cleared points",
);
let earliestDate = $derived(
	workItems.reduce(
		(earliest, workItem) =>
			workItem.resolutionDate.slice(0, 10) < earliest
				? workItem.resolutionDate.slice(0, 10)
				: earliest,
		today,
	),
);
let historyBounds = $derived({ start: earliestDate, end: today });
let chartBounds = $derived({
	start: range.start < earliestDate ? range.start : earliestDate,
	end: today,
});
let effectiveGranularity = $derived(
	granularitySelection === "auto"
		? automaticGranularity(range)
		: granularitySelection,
);
let visibleWork = $derived(workInRange(workItems, range));
let totals = $derived(performanceTotals(visibleWork));
let previousRange = $derived(previousPerformanceRange(range));
let previousTotals = $derived(
	performanceTotals(workInRange(workItems, previousRange)),
);
let hasComparison = $derived(previousRange.end >= earliestDate);
let buckets = $derived(
	buildPerformanceTimeline(workItems, range, effectiveGranularity),
);
let monthlyBuckets = $derived(
	buildPerformanceTimeline(workItems, range, "month"),
);
let activeMonths = $derived(
	monthlyBuckets.filter((bucket) => bucket.completedTickets > 0).length,
);
let completeBuckets = $derived(buckets.filter((bucket) => !bucket.partial));
let bestBucket = $derived(
	[...completeBuckets]
		.filter((bucket) => bucket.completedTickets > 0)
		.sort(
			(left, right) =>
				right[metric] - left[metric] ||
				right.completedTickets - left.completedTickets,
		)[0],
);
let metricLabel = $derived(
	metric === "completedPoints"
		? pointsLabel
		: metric === "completedTickets"
			? "Completed tickets"
			: metric === "bounceCount"
				? "Bounces"
				: "Average ticket size",
);
let showingAllTime = $derived(
	range.start === historyBounds.start && range.end === historyBounds.end,
);
let periodLabel = $derived(showingAllTime ? "All time" : "Visible range");
let selectedWork = $derived(
	selectedBucket ? workInRange(visibleWork, selectedBucket) : visibleWork,
);
let projects = $derived.by(() => {
	const groups = new Map<string, ContributorWorkItem[]>();
	for (const workItem of visibleWork) {
		const project = workItem.issueKey.replace(/-\d+$/, "");
		const group = groups.get(project) ?? [];
		group.push(workItem);
		groups.set(project, group);
	}
	return [...groups]
		.map(([name, work]) => ({ name, ...performanceTotals(work) }))
		.sort((left, right) => right.completedTickets - left.completedTickets);
});

function changeDescription(current: number, previous: number): string {
	if (!hasComparison) return "No earlier history to compare";
	const change = percentageChange(current, previous);
	if (change === null)
		return previous === 0 && current === 0
			? "No completions in either period"
			: "No completions in the previous period";
	return `${change > 0 ? "+" : ""}${formatNumber(change)}% vs previous ${daysInRange(range)} days`;
}
function updateRange(nextRange: PerformanceRange): void {
	range = nextRange;
	selectedBucket = null;
}
async function loadPerformance(): Promise<void> {
	const revision = ++loadRevision;
	isLoading = true;
	errorMessage = "";
	try {
		let loadedWork: ContributorWorkItem[];
		if (selection.role === "development") {
			const issues = await loadDevelopmentAllTimeIssues(
				configuration.boardIdentifier,
				selection.scope,
				configuration.statusMapping.done,
				null,
				configuration.fieldMapping,
				selection.contributor.accountIdentifier,
			);
			loadedWork = developmentWorkForContributor(
				issues,
				selection.contributor,
				configuration.statusMapping.done,
			);
		} else {
			const qualityAssurance = configuration.qualityAssurance;
			if (!qualityAssurance)
				throw new Error(
					"Quality assurance performance is no longer configured.",
				);
			const issues = await loadQualityAssuranceAllTimeIssues(
				qualityAssurance.boardIdentifier,
				selection.scope,
				qualityAssurance.statusMapping.done,
				null,
				qualityAssurance.fieldMapping,
				selection.contributor.accountIdentifier,
			);
			loadedWork = qualityAssuranceWorkForContributor(
				issues,
				selection.contributor,
				qualityAssurance.statusMapping.done,
			);
		}
		if (revision !== loadRevision) return;
		const shouldShowAllTime = !hasLoaded || showingAllTime;
		workItems = loadedWork.filter((workItem) => {
			const date = calendarDate(workItem.resolutionDate);
			return date !== null && date <= today;
		});
		hasLoaded = true;
		loadedAt = new Date().toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});
		selectedBucket = null;
		if (shouldShowAllTime) updateRange(historyBounds);
	} catch (error) {
		if (revision === loadRevision)
			errorMessage =
				error instanceof Error
					? error.message
					: "Contributor performance could not be loaded.";
	} finally {
		if (revision === loadRevision) isLoading = false;
	}
}
onMount(() => {
	void loadPerformance();
});
onDestroy(() => {
	loadRevision += 1;
});
</script>

<main
	class="mx-auto max-w-[94rem] px-5 py-8 sm:px-8 sm:py-10"
	data-contributor-profile
>
	<div class="flex items-center justify-between gap-4">
		<Button variant="ghost" size="small" onclick={onBack}
			><Icon name="arrowLeft" size={16} />Back to scoreboard</Button
		>
		<p class="hidden text-xs text-muted sm:block">
			{isLoading ? "Loading full history…" : loadedAt ? `Updated ${loadedAt}` : ""}
		</p>
	</div>
	<header
		class="mt-6 flex flex-col justify-between gap-6 border-b border-line/70 pb-7 sm:flex-row sm:items-center"
	>
		<div class="min-w-0">
			<h1
				class="display-title break-words text-4xl leading-tight text-ice sm:text-5xl"
			>
				{selection.contributor.displayName}
			</h1>
			<div class="mt-3 flex flex-wrap items-center gap-2">
				<Badge tone={isDevelopment ? "success" : "info"}>{roleLabel}</Badge>
				<span class="text-xs text-muted"
					>{selection.sourceLabel}
					·
					{selection.scope === "global" ? "All Jira projects" : "Current board"}</span
				>
			</div>
		</div>
		<Button variant="secondary" onclick={loadPerformance} loading={isLoading}
			>{isLoading ? "Loading history…" : "Refresh data"}</Button
		>
	</header>
	{#if errorMessage}
		<div class="mt-6">
			<Alert message={errorMessage} onRetry={loadPerformance} />
		</div>
	{/if}
	{#if isLoading && !hasLoaded}
		<LoadingState message="Loading contribution history across all years…" />
	{:else if hasLoaded}
		<section
			class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
			aria-label="Performance totals for visible range"
		>
			<MetricCard
				label={pointsLabel}
				value={formatNumber(totals.completedPoints)}
				subtitle={changeDescription(totals.completedPoints, previousTotals.completedPoints)}
				tone="success"
				context={periodLabel}
			/>
			<MetricCard
				label="Completed tickets"
				value={String(totals.completedTickets)}
				subtitle={changeDescription(totals.completedTickets, previousTotals.completedTickets)}
				tone="info"
				context={periodLabel}
			/>
			<MetricCard
				label="Weekly delivery pace"
				value={formatNumber(totals.completedTickets / daysInRange(range) * 7)}
				subtitle="Tickets / 7 calendar days, including inactive days"
				tone="brand"
				context={periodLabel}
			/>
			<MetricCard
				label="Average ticket size"
				value={formatNumber(totals.averagePointsPerTicket)}
				subtitle="Points / completed ticket; unestimated work counts as 0"
				context={periodLabel}
			/>
		</section>
		<div class="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
			<Card
				class="min-w-0 overflow-hidden rounded-[1.2rem] p-5 sm:p-6"
				accent="info"
			>
				<div
					class="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-start"
				>
					<div>
						<p class="eyebrow">Performance over time</p>
						<h2 class="mt-2 text-2xl font-extrabold">
							{isDevelopment ? "Delivery timeline" : "QA throughput timeline"}
						</h2>
						<p class="mt-2 text-xs text-muted">
							Explore the pace, volume and shape of completed work.
						</p>
					</div>
					<div class="flex flex-wrap gap-3">
						<Field label="Metric" compact
							><Select bind:value={metric} class="py-2 text-xs"
								><option value="completedPoints">Story points</option>
								<option value="completedTickets">Tickets</option>
								<option value="averagePointsPerTicket">Ticket size</option>
								{#if isDevelopment}
									<option value="bounceCount">Bounces</option>
								{/if}</Select
							></Field
						>
						<Field label="Group by" compact
							><Select
								bind:value={granularitySelection}
								onchange={() => selectedBucket = null}
								class="py-2 text-xs"
								><option value="auto">
									Auto · {automaticGranularity(range)}
								</option>
								<option value="month">Month</option>
								<option value="week">Week</option>
								<option value="day">Day</option></Select
							></Field
						>
					</div>
				</div>
				{#if workItems.length}
					<ContributorPerformanceChart
						{buckets}
						{metric}
						{metricLabel}
						{range}
						bounds={chartBounds}
						selectedKey={selectedBucket?.key ?? null}
						showBounces={isDevelopment}
						onSelect={(bucket) => selectedBucket = bucket}
						onRangeChange={(nextRange) => updateRange(nextRange)}
					/>
					{#if !visibleWork.length}
						<p class="mt-4 rounded-lg bg-panel-soft p-3 text-sm text-muted">
							No completed work in this range. Zoom out or choose All time to
							explore more history.
						</p>
					{/if}
				{:else}
					<EmptyState
						title="No completed contributions yet"
						description="No resolved issues match this contributor and scope."
						symbol="◇"
					/>
				{/if}
			</Card>
			<aside
				class="grid gap-4 sm:grid-cols-2 xl:grid-cols-1"
				aria-label="Performance insights"
			>
				<Card class="rounded-[1.2rem] p-5">
					<p class="eyebrow">
						{metric === "bounceCount" ? "Most rework" : "Peak period"}
					</p>
					{#if bestBucket}
						<p class="mt-3 text-xl font-bold">{bestBucket.label}</p>
						<p class="mt-2 text-sm text-sky">
							{formatNumber(bestBucket[metric])}
							{metric === "completedPoints" ? "points" : metric === "completedTickets" ? "tickets" : metric === "bounceCount" ? "bounces" : "pts / ticket"}
						</p>
						<p class="mt-2 text-xs leading-5 text-muted">
							{bestBucket.completedTickets}
							tickets · highest {metricLabel.toLowerCase()} among complete
							{effectiveGranularity}s in view.
						</p>
						<Button
							class="mt-3"
							size="small"
							variant="ghost"
							onclick={() => selectedBucket = bestBucket ?? null}
							>Inspect this period →</Button
						>
					{:else}
						<p class="mt-3 text-sm leading-6 text-muted">
							No complete {effectiveGranularity} with contributions in this
							range.
						</p>
					{/if}
				</Card>
				<Card class="rounded-[1.2rem] p-5">
					<p class="eyebrow">
						Activity & {isDevelopment ? "rework" : "coverage"}
					</p>
					<dl class="mt-4 space-y-4 text-xs">
						<div class="flex justify-between gap-3">
							<dt class="text-muted">Days with completions</dt>
							<dd class="font-bold">{totals.activeDays}</dd>
						</div>
						<div class="flex justify-between gap-3">
							<dt class="text-muted">Months with completions</dt>
							<dd class="font-bold">{activeMonths}/ {monthlyBuckets.length}</dd>
						</div>
						{#if isDevelopment}
							<div class="flex justify-between gap-3">
								<dt class="text-muted">Tickets with bounces</dt>
								<dd class="font-bold text-coral">
									{totals.bouncedTickets}
									/ {totals.completedTickets}
								</dd>
							</div>
							<div class="flex justify-between gap-3">
								<dt class="text-muted">Total bounces</dt>
								<dd class="font-bold">{totals.bounceCount}</dd>
							</div>
						{:else}
							<div class="flex justify-between gap-3">
								<dt class="text-muted">Projects represented</dt>
								<dd class="font-bold">{projects.length}</dd>
							</div>
						{/if}
					</dl>
					<p
						class="mt-4 border-t border-line/60 pt-3 text-[11px] leading-5 text-muted"
					>
						{isDevelopment ? "Bounces are the recorded total on tickets resolved in this range, not the date each bounce happened." : "Activity follows issue resolution dates and the currently assigned Tester field."}
					</p>
				</Card>
				<Card class="rounded-[1.2rem] p-5 sm:col-span-2 xl:col-span-1">
					<p class="eyebrow">Where work landed</p>
					{#each projects.slice(0, 5) as project (project.name)}
						<div class="mt-4">
							<div class="flex justify-between gap-2 text-xs">
								<span class="font-bold">{project.name}</span
								><span class="text-muted"
									>{project.completedTickets}
									tickets · {formatNumber(project.completedPoints)} pts</span
								>
							</div>
							<div class="mt-2 h-1 overflow-hidden rounded-full bg-line">
								<div
									class="h-full rounded-full bg-sky/70"
									style:width={`${project.completedTickets / Math.max(1, totals.completedTickets) * 100}%`}
								></div>
							</div>
						</div>
					{:else}
						<p class="mt-3 text-xs text-muted">
							No project activity in this range.
						</p>
					{/each}
					{#if projects.length > 5}
						<p class="mt-3 text-[11px] text-muted">
							Top 5 of {projects.length} projects, by ticket count.
						</p>
					{/if}
				</Card>
			</aside>
		</div>
		{#key `${range.start}:${range.end}:${selectedBucket?.key ?? "all"}`}
			<ContributorWorkHistory
				workItems={selectedWork}
				{jiraSiteUrl}
				periodLabel={selectedBucket ? rangeLabel(selectedBucket) : rangeLabel(range)}
				{isDevelopment}
				isSelection={selectedBucket !== null}
				onClearSelection={() => selectedBucket = null}
			/>
		{/key}
	{/if}
</main>
