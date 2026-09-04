<script lang="ts">
import type { DeveloperResolvedComparison } from "../domain/period-performance";
import { formatDelta, formatNumber } from "../presentation/format";
import Avatar from "./ui/Avatar.svelte";
import Card from "./ui/Card.svelte";
import EmptyState from "./ui/EmptyState.svelte";
import MetricCard from "./ui/MetricCard.svelte";
import Table from "./ui/Table.svelte";

interface Properties {
	baselineLabel: string;
	comparisonLabel: string;
	comparisons: DeveloperResolvedComparison[];
	totalComparison: DeveloperResolvedComparison;
}

let {
	baselineLabel,
	comparisonLabel,
	comparisons,
	totalComparison,
}: Properties = $props();

let maximumChartPoints = $derived(
	Math.max(
		1,
		...comparisons.flatMap((comparison) => [
			comparison.baselinePoints,
			comparison.comparisonPoints,
		]),
	),
);

function deltaClass(value: number): string {
	return value > 0 ? "text-mint" : value < 0 ? "text-coral" : "text-muted";
}
</script>

<section
	class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
	aria-label="Period comparison totals"
>
	<MetricCard
		label={baselineLabel}
		value={formatNumber(totalComparison.baselinePoints)}
		subtitle={`${totalComparison.baselineTickets} resolved tickets`}
		context="Starting point"
	/>
	<MetricCard
		label={comparisonLabel}
		value={formatNumber(totalComparison.comparisonPoints)}
		subtitle={`${totalComparison.comparisonTickets} resolved tickets`}
		tone="info"
		context="New window"
	/>
	<MetricCard
		label="Points change"
		value={formatDelta(totalComparison.pointsDelta)}
		subtitle={totalComparison.pointsChange}
		tone={totalComparison.pointsDelta >= 0 ? "success" : "danger"}
		context="Momentum"
	/>
	<MetricCard
		label="Ticket change"
		value={formatDelta(totalComparison.ticketsDelta)}
		subtitle="Resolved ticket delta"
		tone={totalComparison.ticketsDelta >= 0 ? "success" : "danger"}
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
					{baselineLabel}
					vs {comparisonLabel}
				</h2>
			</div>
			<div class="flex gap-4 text-xs font-bold text-muted">
				<span
					><i class="mr-1.5 inline-block size-2 rounded-full bg-muted"></i>
					{baselineLabel}</span
				>
				<span
					><i class="mr-1.5 inline-block size-2 rounded-full bg-sky"></i>
					{comparisonLabel}</span
				>
			</div>
		</div>
		<div class="mt-7 space-y-5">
			{#each comparisons as comparison (comparison.developer)}
				<div class="grid gap-2 sm:grid-cols-[12rem_1fr_4rem] sm:items-center">
					<p class="truncate text-sm font-bold text-ice">
						{comparison.developer}
					</p>
					<div class="space-y-1.5">
						<div class="h-2 overflow-hidden rounded-full bg-line/70">
							<div
								class="h-full rounded-full bg-muted"
								style={`width: ${(comparison.baselinePoints / maximumChartPoints) * 100}%`}
							></div>
						</div>
						<div class="h-2 overflow-hidden rounded-full bg-line/70">
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
			<h2 class="text-lg font-extrabold text-ice">Developer movement</h2>
			<p class="mt-1 text-xs text-muted">
				Resolved story points and ticket counts.
			</p>
		</div>

		<div class="divide-y divide-line/55 md:hidden">
			{#each comparisons as comparison (comparison.developer)}
				<article class="p-5">
					<div class="flex items-center justify-between gap-3">
						<div class="flex min-w-0 items-center gap-3">
							<Avatar name={comparison.developer} tone="info" />
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
					<dl class="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
						<div class="rounded-lg bg-canvas/35 p-2">
							<dt class="text-muted">Baseline</dt>
							<dd class="metric-value mt-1 font-bold text-ice">
								{formatNumber(comparison.baselinePoints)}
							</dd>
						</div>
						<div class="rounded-lg bg-canvas/35 p-2">
							<dt class="text-muted">Comparison</dt>
							<dd class="metric-value mt-1 font-bold text-sky">
								{formatNumber(comparison.comparisonPoints)}
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
					<th class="px-4 py-3 text-right font-bold">Baseline</th>
					<th class="px-4 py-3 text-right font-bold">Comparison</th>
					<th class="px-4 py-3 text-right font-bold">Points Δ</th>
					<th class="px-4 py-3 text-right font-bold">Change</th>
					<th class="px-6 py-3 text-right font-bold">Tickets Δ</th>
				</tr>
			{/snippet}
			{#snippet body()}
				{#each comparisons as comparison (comparison.developer)}
					<tr class="transition-colors hover:bg-panel-soft/45">
						<td class="px-6 py-4 font-bold text-ice">
							{comparison.developer}
						</td>
						<td class="metric-value px-4 py-4 text-right text-muted">
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
