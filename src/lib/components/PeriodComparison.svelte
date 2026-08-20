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
	import ErrorBanner from "./ErrorBanner.svelte";
	import LoadingState from "./LoadingState.svelte";
	import MetricCard from "./MetricCard.svelte";

	interface Properties {
		configuration: AppConfiguration;
	}

	interface PeriodReport {
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
	let hasInitializedProjectKey = $state(false);
	let usesAdvancedQuery = $state(false);
	let customQuery = $state("");
	let developerFilters = $state("");
	let report = $state<PeriodReport | null>(null);
	let isLoading = $state(false);
	let errorMessage = $state("");

	$effect(() => {
		if (!hasInitializedProjectKey) {
			projectKey = configuration.defaultProjectKey;
			hasInitializedProjectKey = true;
		}
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
		return value > 0
			? "text-mint"
			: value < 0
				? "text-coral"
				: "text-muted";
	}

	function parsedDeveloperFilters(): string[] {
		return developerFilters
			.split(/[,\n]/)
			.map((filter) => filter.trim())
			.filter(Boolean);
	}

	async function runComparison(event?: SubmitEvent): Promise<void> {
		event?.preventDefault();
		isLoading = true;
		errorMessage = "";
		try {
			if (usesAdvancedQuery && !customQuery.trim()) {
				throw new Error(
					"Enter a Jira query before running an advanced comparison.",
				);
			}
			if (!usesAdvancedQuery && !projectKey.trim()) {
				throw new Error("Enter a Jira project key.");
			}

			const scope = usesAdvancedQuery
				? { scopeQuery: customQuery.trim() }
				: { projectKey: projectKey.trim() };
			const [baselineResult, comparisonResult] = await Promise.all([
				loadPeriodIssues({
					startDate: baselineStartDate,
					endDate: baselineEndDate,
					fieldMapping: configuration.fieldMapping,
					...scope,
				}),
				loadPeriodIssues({
					startDate: comparisonStartDate,
					endDate: comparisonEndDate,
					fieldMapping: configuration.fieldMapping,
					...scope,
				}),
			]);
			const filters = parsedDeveloperFilters();
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
	<header>
		<h1
			class="mt-3 text-3xl font-bold tracking-[-0.04em] text-white sm:text-4xl"
		>
			Period comparison
		</h1>
		<p class="mt-2 text-sm text-muted">
			Compare resolved story points and ticket counts across any two date
			ranges.
		</p>
	</header>

	<form
		class="surface-card mt-8 rounded-2xl p-5 sm:p-6"
		onsubmit={runComparison}
	>
		<div class="grid gap-6 lg:grid-cols-2 lg:gap-8">
			<fieldset class="grid gap-4 sm:grid-cols-2">
				<legend class="mb-3 text-sm font-bold text-white">
					Baseline period
				</legend>
				<label class="block sm:col-span-2"
					><span
						class="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
						>Label</span
					><input
						class="field-control"
						bind:value={baselineLabel}
					/></label
				>
				<label class="block"
					><span
						class="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
						>From</span
					><input
						class="field-control"
						type="date"
						bind:value={baselineStartDate}
						required
					/></label
				>
				<label class="block"
					><span
						class="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
						>Through</span
					><input
						class="field-control"
						type="date"
						bind:value={baselineEndDate}
						required
					/></label
				>
			</fieldset>
			<fieldset
				class="grid gap-4 border-t border-line/60 pt-6 sm:grid-cols-2 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0"
			>
				<legend class="mb-3 text-sm font-bold text-white">
					Comparison period
				</legend>
				<label class="block sm:col-span-2"
					><span
						class="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
						>Label</span
					><input
						class="field-control"
						bind:value={comparisonLabel}
					/></label
				>
				<label class="block"
					><span
						class="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
						>From</span
					><input
						class="field-control"
						type="date"
						bind:value={comparisonStartDate}
						required
					/></label
				>
				<label class="block"
					><span
						class="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
						>Through</span
					><input
						class="field-control"
						type="date"
						bind:value={comparisonEndDate}
						required
					/></label
				>
			</fieldset>
		</div>

		<div
			class="mt-7 grid gap-5 border-t border-line/60 pt-6 lg:grid-cols-[1fr_1.4fr]"
		>
			<div>
				<label
					class="flex items-center gap-3 text-sm font-semibold text-ice"
				>
					<input
						class="size-4 accent-mint"
						type="checkbox"
						bind:checked={usesAdvancedQuery}
					/>
					Use advanced JQL scope
				</label>
				{#if usesAdvancedQuery}
					<textarea
						class="field-control mt-3 min-h-24 resize-y font-mono text-xs"
						bind:value={customQuery}
						placeholder="project = DEMO AND component = Platform"
					></textarea>
					<p class="mt-2 text-xs leading-5 text-muted">
						Resolution dates and ordering are added safely by the
						app.
					</p>
				{:else}
					<label class="mt-3 block"
						><span
							class="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
							>Project key</span
						><input
							class="field-control max-w-xs"
							bind:value={projectKey}
							placeholder="DEMO"
							required
						/></label
					>
				{/if}
			</div>
			<label class="block">
				<span
					class="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
					>Developers · optional</span
				>
				<textarea
					class="field-control min-h-24 resize-y"
					bind:value={developerFilters}
					placeholder="Alex Morgan, Bailey Chen"
				></textarea>
				<span class="mt-2 block text-xs leading-5 text-muted"
					>Leave empty for everyone, or separate exact display names
					with commas or new lines.</span
				>
			</label>
		</div>

		<div class="mt-6 flex justify-end">
			<button
				class="primary-button min-w-44"
				type="submit"
				disabled={isLoading}
			>
				{isLoading ? "Comparing…" : "Run comparison"}
				<span aria-hidden="true">→</span>
			</button>
		</div>
	</form>

	{#if errorMessage}
		<div class="mt-6">
			<ErrorBanner
				message={errorMessage}
				onRetry={() => runComparison()}
			/>
		</div>
	{/if}

	{#if isLoading}
		<LoadingState message="Comparing resolved work…" />
	{:else if report}
		<section class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<MetricCard
				label={baselineLabel || "Baseline"}
				value={formatNumber(report.totalComparison.baselinePoints)}
				subtitle={`${report.totalComparison.baselineTickets} resolved tickets`}
			/>
			<MetricCard
				label={comparisonLabel || "Comparison"}
				value={formatNumber(report.totalComparison.comparisonPoints)}
				subtitle={`${report.totalComparison.comparisonTickets} resolved tickets`}
				tone="violet"
			/>
			<MetricCard
				label="Points change"
				value={formatDelta(report.totalComparison.pointsDelta)}
				subtitle={report.totalComparison.pointsChange}
				tone={report.totalComparison.pointsDelta >= 0
					? "mint"
					: "coral"}
			/>
			<MetricCard
				label="Ticket change"
				value={formatDelta(report.totalComparison.ticketsDelta)}
				subtitle="Resolved ticket delta"
				tone={report.totalComparison.ticketsDelta >= 0
					? "mint"
					: "coral"}
			/>
		</section>

		{#if report.comparisons.length === 0}
			<section
				class="surface-card mt-6 rounded-2xl px-6 py-16 text-center"
			>
				<p class="text-lg font-bold text-white">No resolved tickets</p>
				<p class="mt-2 text-sm text-muted">
					Jira found no resolved work in either selected period.
				</p>
			</section>
		{:else}
			<section class="surface-card mt-6 rounded-2xl p-5 sm:p-6">
				<div
					class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
				>
					<div>
						<p class="eyebrow">Points by developer</p>
						<h2 class="mt-2 text-lg font-bold text-white">
							{baselineLabel || "Baseline"}
							vs {comparisonLabel || "Comparison"}
						</h2>
					</div>
					<div class="flex gap-4 text-xs font-semibold text-muted">
						<span
							><i
								class="mr-1.5 inline-block size-2 rounded-full bg-muted"
							></i>
							{baselineLabel || "Baseline"}</span
						><span
							><i
								class="mr-1.5 inline-block size-2 rounded-full bg-violet"
							></i>
							{comparisonLabel || "Comparison"}</span
						>
					</div>
				</div>
				<div class="mt-7 space-y-5">
					{#each report.comparisons as comparison (comparison.developer)}
						<div
							class="grid gap-2 sm:grid-cols-[12rem_1fr_4rem] sm:items-center"
						>
							<p class="truncate text-sm font-semibold text-ice">
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
										class="h-full rounded-full bg-violet"
										style={`width: ${(comparison.comparisonPoints / maximumChartPoints) * 100}%`}
									></div>
								</div>
							</div>
							<p
								class={`metric-value text-right text-sm font-bold ${deltaClass(comparison.pointsDelta)}`}
							>
								{formatDelta(comparison.pointsDelta)}
							</p>
						</div>
					{/each}
				</div>
			</section>

			<section class="surface-card mt-6 overflow-hidden rounded-2xl">
				<div class="border-b border-line/70 px-5 py-5 sm:px-6">
					<h2 class="font-bold text-white">Developer comparison</h2>
					<p class="mt-1 text-xs text-muted">
						Resolved story points and ticket counts.
					</p>
				</div>
				<div class="overflow-x-auto">
					<table
						class="w-full min-w-[46rem] border-collapse text-left"
					>
						<thead
							class="bg-canvas/35 text-[0.67rem] uppercase tracking-[0.1em] text-muted"
						>
							<tr>
								<th class="px-6 py-3 font-semibold"
									>Developer</th
								>
								<th class="px-4 py-3 text-right font-semibold"
									>Baseline</th
								>
								<th class="px-4 py-3 text-right font-semibold"
									>Comparison</th
								>
								<th class="px-4 py-3 text-right font-semibold"
									>Points Δ</th
								>
								<th class="px-4 py-3 text-right font-semibold"
									>Change</th
								>
								<th class="px-6 py-3 text-right font-semibold"
									>Tickets Δ</th
								>
							</tr>
						</thead>
						<tbody class="divide-y divide-line/55">
							{#each report.comparisons as comparison (comparison.developer)}
								<tr class="hover:bg-panel-soft/45">
									<td
										class="px-6 py-4 font-semibold text-ice"
									>
										{comparison.developer}
									</td>
									<td
										class="metric-value px-4 py-4 text-right text-muted"
									>
										{formatNumber(
											comparison.baselinePoints,
										)}
									</td>
									<td
										class="metric-value px-4 py-4 text-right font-bold text-violet"
									>
										{formatNumber(
											comparison.comparisonPoints,
										)}
									</td>
									<td
										class={`metric-value px-4 py-4 text-right font-bold ${deltaClass(comparison.pointsDelta)}`}
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
						</tbody>
					</table>
				</div>
			</section>
		{/if}
	{:else}
		<section
			class="mt-8 rounded-2xl border border-dashed border-line px-6 py-16 text-center"
		>
			<p class="font-mono text-3xl text-violet/70" aria-hidden="true">
				◫
			</p>
			<h2 class="mt-4 text-lg font-bold text-white">
				Choose two periods
			</h2>
			<p class="mt-2 text-sm text-muted">
				The default windows compare the previous 30 days with the most
				recent 30 days.
			</p>
		</section>
	{/if}
</main>
