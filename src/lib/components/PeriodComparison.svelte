<script lang="ts">
	import { loadPeriodIssues } from "../browser/api-client";
	import type { AppConfiguration } from "../browser/configuration";
	import {
		compareResolvedSummaries,
		type DeveloperResolvedComparison,
		type DeveloperResolvedSummary,
		filterResolvedSummaries,
		summarizeResolvedIssues,
		totalResolvedSummary,
	} from "../domain/period-performance";
	import { formatDelta, formatNumber } from "../presentation/format";
	import Alert from "./ui/Alert.svelte";
	import Avatar from "./ui/Avatar.svelte";
	import Button from "./ui/Button.svelte";
	import Card from "./ui/Card.svelte";
	import Checkbox from "./ui/Checkbox.svelte";
	import EmptyState from "./ui/EmptyState.svelte";
	import Field from "./ui/Field.svelte";
	import Input from "./ui/Input.svelte";
	import LoadingState from "./ui/LoadingState.svelte";
	import MetricCard from "./ui/MetricCard.svelte";
	import Table from "./ui/Table.svelte";
	import Textarea from "./ui/Textarea.svelte";

	interface Properties {
		configuration: AppConfiguration;
	}

	interface PeriodReport {
		baselineLabel: string;
		comparisonLabel: string;
		baselineSummaries: DeveloperResolvedSummary[];
		comparisonSummaries: DeveloperResolvedSummary[];
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

	let maximumChartPoints = $derived(
		Math.max(
			1,
			...(report?.comparisons.flatMap((comparison) => [
				comparison.baselinePoints,
				comparison.comparisonPoints,
			]) ?? []),
		),
	);
	let comparisons = $derived(report?.comparisons ?? []);

	function deltaClass(value: number): string {
		return value > 0
			? "text-mint"
			: value < 0
				? "text-coral"
				: "text-muted";
	}

	function parsedDeveloperFilters(filterText: string): string[] {
		return filterText
			.split(/[,\n]/)
			.map((filter) => filter.trim())
			.filter(Boolean);
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
				throw new Error(
					"The baseline start date must be before its end date.",
				);
			}
			if (requestedComparisonStartDate > requestedComparisonEndDate) {
				throw new Error(
					"The comparison start date must be before its end date.",
				);
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
				comparisonLabel: requestedComparisonLabel,
				baselineSummaries,
				comparisonSummaries,
				comparisons: compareResolvedSummaries(
					baselineSummaries,
					comparisonSummaries,
				),
				totalComparison: compareResolvedSummaries(
					[baselineTotal],
					[comparisonTotal],
				)[0],
			};
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
	<header class="max-w-3xl">
		<h1
			class="display-title mt-3 text-4xl leading-none text-ice sm:text-5xl"
		>
			Compare periods
		</h1>
		<p class="mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base">
			Put two delivery windows side by side to spot team movement
		</p>
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
						<Input
							type="date"
							bind:value={baselineStartDate}
							required
						/>
					</Field>
					<Field label="Through" compact>
						<Input
							type="date"
							bind:value={baselineEndDate}
							required
						/>
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
						<Input
							type="date"
							bind:value={comparisonStartDate}
							required
						/>
					</Field>
					<Field label="Through" compact>
						<Input
							type="date"
							bind:value={comparisonEndDate}
							required
						/>
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
						<Field
							label="Project key"
							compact
							class="mt-3 max-w-xs"
						>
							<Input
								bind:value={projectKey}
								placeholder="DEMO"
								required
							/>
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
		<section
			class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
			aria-label="Period comparison totals"
		>
			<MetricCard
				label={report.baselineLabel}
				value={formatNumber(report.totalComparison.baselinePoints)}
				subtitle={`${report.totalComparison.baselineTickets} resolved tickets`}
				context="Starting point"
			/>
			<MetricCard
				label={report.comparisonLabel}
				value={formatNumber(report.totalComparison.comparisonPoints)}
				subtitle={`${report.totalComparison.comparisonTickets} resolved tickets`}
				tone="info"
				context="New window"
			/>
			<MetricCard
				label="Points change"
				value={formatDelta(report.totalComparison.pointsDelta)}
				subtitle={report.totalComparison.pointsChange}
				tone={report.totalComparison.pointsDelta >= 0
					? "success"
					: "danger"}
				context="Momentum"
			/>
			<MetricCard
				label="Ticket change"
				value={formatDelta(report.totalComparison.ticketsDelta)}
				subtitle="Resolved ticket delta"
				tone={report.totalComparison.ticketsDelta >= 0
					? "success"
					: "danger"}
				context="Throughput"
			/>
		</section>

		{#if comparisons.length === 0}
			<Card class="mt-6 rounded-[1.2rem]">
				<EmptyState
					title="No resolved tickets"
					description="Jira found no resolved work in either selected period."
					symbol="◇"
				/>
			</Card>
		{:else}
			<Card class="mt-6 rounded-[1.2rem] p-5 sm:p-6">
				<div
					class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
				>
					<div>
						<p class="eyebrow">Points by developer</p>
						<h2 class="mt-2 text-lg font-extrabold text-ice">
							{report.baselineLabel}
							vs {report.comparisonLabel}
						</h2>
					</div>
					<div class="flex gap-4 text-xs font-bold text-muted">
						<span
							><i
								class="mr-1.5 inline-block size-2 rounded-full bg-muted"
							></i>
							{report.baselineLabel}</span
						>
						<span
							><i
								class="mr-1.5 inline-block size-2 rounded-full bg-sky"
							></i>
							{report.comparisonLabel}</span
						>
					</div>
				</div>
				<div class="mt-7 space-y-5">
					{#each comparisons as comparison (comparison.developer)}
						<div
							class="grid gap-2 sm:grid-cols-[12rem_1fr_4rem] sm:items-center"
						>
							<p class="truncate text-sm font-bold text-ice">
								{comparison.developer}
							</p>
							<div class="space-y-1.5">
								<div
									class="h-2 overflow-hidden rounded-full bg-line/70"
								>
									<div
										class="h-full rounded-full bg-muted"
										style={`width: ${(comparison.baselinePoints / maximumChartPoints) * 100}%`}
									></div>
								</div>
								<div
									class="h-2 overflow-hidden rounded-full bg-line/70"
								>
									<div
										class="h-full rounded-full bg-sky"
										style={`width: ${(comparison.comparisonPoints / maximumChartPoints) * 100}%`}
									></div>
								</div>
							</div>
							<p
								class={`metric-value text-right text-sm font-extrabold ${deltaClass(comparison.pointsDelta)}`}
							>
								{formatDelta(comparison.pointsDelta)}
							</p>
						</div>
					{/each}
				</div>
			</Card>

			<Card class="mt-6 overflow-hidden rounded-[1.2rem]">
				<div class="border-b border-line/70 px-5 py-5 sm:px-6">
					<h2 class="text-lg font-extrabold text-ice">
						Developer movement
					</h2>
					<p class="mt-1 text-xs text-muted">
						Resolved story points and ticket counts.
					</p>
				</div>

				<div class="divide-y divide-line/55 md:hidden">
					{#each comparisons as comparison (comparison.developer)}
						<article class="p-5">
							<div
								class="flex items-center justify-between gap-3"
							>
								<div class="flex min-w-0 items-center gap-3">
									<Avatar
										name={comparison.developer}
										tone="info"
									/>
									<p class="truncate font-extrabold text-ice">
										{comparison.developer}
									</p>
								</div>
								<p
									class={`metric-value text-xl font-extrabold ${deltaClass(comparison.pointsDelta)}`}
								>
									{formatDelta(comparison.pointsDelta)}
								</p>
							</div>
							<dl
								class="mt-4 grid grid-cols-2 gap-2 text-center text-xs"
							>
								<div class="rounded-lg bg-canvas/35 p-2">
									<dt class="text-muted">Baseline</dt>
									<dd
										class="metric-value mt-1 font-bold text-ice"
									>
										{formatNumber(
											comparison.baselinePoints,
										)}
									</dd>
								</div>
								<div class="rounded-lg bg-canvas/35 p-2">
									<dt class="text-muted">Comparison</dt>
									<dd
										class="metric-value mt-1 font-bold text-sky"
									>
										{formatNumber(
											comparison.comparisonPoints,
										)}
									</dd>
								</div>
								<div class="rounded-lg bg-canvas/35 p-2">
									<dt class="text-muted">Points change</dt>
									<dd
										class={`metric-value mt-1 font-bold ${deltaClass(comparison.pointsDelta)}`}
									>
										{comparison.pointsChange}
									</dd>
								</div>
								<div class="rounded-lg bg-canvas/35 p-2">
									<dt class="text-muted">Tickets Δ</dt>
									<dd
										class={`metric-value mt-1 font-bold ${deltaClass(comparison.ticketsDelta)}`}
									>
										{formatDelta(comparison.ticketsDelta)}
									</dd>
								</div>
							</dl>
						</article>
					{/each}
				</div>

				<Table
					class="hidden md:block"
					label="Developer period comparison"
					minimumWidth="48rem"
				>
					{#snippet head()}
						<tr>
							<th class="px-6 py-3 font-bold">Developer</th>
							<th class="px-4 py-3 text-right font-bold"
								>Baseline</th
							>
							<th class="px-4 py-3 text-right font-bold"
								>Comparison</th
							>
							<th class="px-4 py-3 text-right font-bold"
								>Points Δ</th
							>
							<th class="px-4 py-3 text-right font-bold"
								>Change</th
							>
							<th class="px-6 py-3 text-right font-bold"
								>Tickets Δ</th
							>
						</tr>
					{/snippet}
					{#snippet body()}
						{#each comparisons as comparison (comparison.developer)}
							<tr
								class="transition-colors hover:bg-panel-soft/45"
							>
								<td class="px-6 py-4 font-bold text-ice">
									{comparison.developer}
								</td>
								<td
									class="metric-value px-4 py-4 text-right text-muted"
								>
									{formatNumber(comparison.baselinePoints)}
								</td>
								<td
									class="metric-value px-4 py-4 text-right font-extrabold text-sky"
								>
									{formatNumber(comparison.comparisonPoints)}
								</td>
								<td
									class={`metric-value px-4 py-4 text-right font-extrabold ${deltaClass(comparison.pointsDelta)}`}
								>
									{formatDelta(comparison.pointsDelta)}
								</td>
								<td
									class={`px-4 py-4 text-right font-mono text-xs ${deltaClass(comparison.pointsDelta)}`}
								>
									{comparison.pointsChange}
								</td>
								<td
									class={`metric-value px-6 py-4 text-right ${deltaClass(comparison.ticketsDelta)}`}
								>
									{formatDelta(comparison.ticketsDelta)}
								</td>
							</tr>
						{/each}
					{/snippet}
				</Table>
			</Card>
		{/if}
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
