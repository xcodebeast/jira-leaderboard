<script lang="ts">
import {
	type ContributorReference,
	contributorIdentityKey,
} from "../domain/contributor";
import { unassignedDeveloperName } from "../domain/jira";
import {
	type DeveloperSprintComparison,
	type DeveloperSprintSummary,
	projectedSprintPoints,
} from "../domain/sprint-performance";
import { formatDelta, formatNumber } from "../presentation/format";
import ContributorButton from "./ContributorButton.svelte";
import SprintTicketLinks from "./SprintTicketLinks.svelte";
import Card from "./ui/Card.svelte";
import EmptyState from "./ui/EmptyState.svelte";
import RankBadge from "./ui/RankBadge.svelte";
import Table from "./ui/Table.svelte";

interface Properties {
	jiraSiteUrl?: string | null;
	summaries: DeveloperSprintSummary[];
	comparisons: DeveloperSprintComparison[];
	comparisonSprint: { name: string } | null;
	onOpenContributor?: (contributor: ContributorReference) => void;
}

let {
	jiraSiteUrl = null,
	summaries,
	comparisons,
	comparisonSprint,
	onOpenContributor,
}: Properties = $props();

function contributorSelectionHandler(
	displayName: string,
): ((contributor: ContributorReference) => void) | undefined {
	return displayName === unassignedDeveloperName
		? undefined
		: onOpenContributor;
}

function deltaClass(value: number): string {
	return value > 0 ? "text-mint" : value < 0 ? "text-coral" : "text-muted";
}
</script>

<Card class="overflow-hidden rounded-[1.2rem]">
	<div
		class="flex flex-col gap-4 border-b border-line/70 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
	>
		<div>
			<div class="flex flex-wrap items-center gap-2">
				<h2 class="text-lg font-extrabold text-ice">Development scoreboard</h2>
			</div>
		</div>
		<div class="flex flex-wrap gap-3 text-[0.68rem] font-bold text-muted">
			<span
				><i
					class="mr-1.5 inline-block size-2 rounded-full bg-mint"
				></i>Delivered</span
			>
			<span
				><i
					class="mr-1.5 inline-block size-2 rounded-full bg-sky"
				></i>Pipeline</span
			>
		</div>
	</div>

	{#if summaries.length === 0}
		<EmptyState
			title="No tracked development work"
			description="No issues matched the configured Done, QA, or Ready for QA statuses for this sprint."
			symbol="◇"
		/>
	{:else}
		<div class="divide-y divide-line/60 md:hidden">
			{#each summaries as summary, rank (contributorIdentityKey(summary.developer, summary.developerAccountIdentifier))}
				<article class={`p-5 ${rank === 0 ? "bg-brand/3" : ""}`}>
					<div class="flex items-center gap-3">
						<RankBadge rank={rank + 1} />
						<ContributorButton
							displayName={summary.developer}
							accountIdentifier={summary.developerAccountIdentifier}
							tone={rank === 0 ? "brand" : "success"}
							detail={`${summary.tickets.length} ${summary.tickets.length === 1 ? "ticket" : "tickets"}`}
							class="flex-1"
							onSelect={contributorSelectionHandler(summary.developer)}
						/>
						<p class="metric-value text-2xl font-extrabold text-brand">
							{formatNumber(projectedSprintPoints(summary))}
						</p>
					</div>
					<dl class="mt-4 grid grid-cols-4 gap-2 text-center">
						<div class="rounded-lg bg-canvas/35 px-2 py-2">
							<dt class="text-[0.62rem] uppercase tracking-wide text-muted">
								Done
							</dt>
							<dd class="metric-value mt-1 font-extrabold text-mint">
								{formatNumber(summary.donePoints)}
							</dd>
						</div>
						<div class="rounded-lg bg-canvas/35 px-2 py-2">
							<dt class="text-[0.62rem] uppercase tracking-wide text-muted">
								In QA
							</dt>
							<dd class="metric-value mt-1 font-bold text-sky">
								{formatNumber(summary.qualityAssurancePoints)}
							</dd>
						</div>
						<div class="rounded-lg bg-canvas/35 px-2 py-2">
							<dt class="text-[0.62rem] uppercase tracking-wide text-muted">
								Ready
							</dt>
							<dd class="metric-value mt-1 font-bold text-ice">
								{formatNumber(
									summary.readyForQualityAssurancePoints,
								)}
							</dd>
						</div>
						<div class="rounded-lg bg-canvas/35 px-2 py-2">
							<dt class="text-[0.62rem] uppercase tracking-wide text-muted">
								Bounces
							</dt>
							<dd
								class:text-coral={summary.bounceCount > 0}
								class="metric-value mt-1 font-bold"
							>
								{formatNumber(summary.bounceCount)}
							</dd>
						</div>
					</dl>
					<details
						class="mt-4 rounded-lg border border-line/65 bg-canvas/25 px-3 py-2.5"
					>
						<summary class="cursor-pointer text-xs font-bold text-muted">
							View sprint work
						</summary>
						<SprintTicketLinks {jiraSiteUrl} tickets={summary.tickets} />
					</details>
				</article>
			{/each}
		</div>

		<Table
			class="hidden md:block"
			label="Development sprint rankings"
			minimumWidth="58rem"
		>
			{#snippet head()}
				<tr>
					<th class="px-6 py-3 font-bold">Developer</th>
					<th class="px-4 py-3 text-right font-bold">Delivered</th>
					<th class="px-4 py-3 text-right font-bold">In QA</th>
					<th class="px-4 py-3 text-right font-bold">Ready</th>
					<th class="px-4 py-3 text-right font-bold">Projected</th>
					<th class="px-4 py-3 text-right font-bold">Bounces</th>
					<th class="px-6 py-3 font-bold">Work</th>
				</tr>
			{/snippet}
			{#snippet body()}
				{#each summaries as summary, rank (contributorIdentityKey(summary.developer, summary.developerAccountIdentifier))}
					<tr
						class={`transition-colors hover:bg-panel-soft/45 ${rank === 0 ? "bg-brand/3" : ""}`}
					>
						<td class="px-6 py-4">
							<div class="flex items-center gap-3">
								<RankBadge rank={rank + 1} />
								<ContributorButton
									displayName={summary.developer}
									accountIdentifier={summary.developerAccountIdentifier}
									tone={rank === 0 ? "brand" : "success"}
									onSelect={contributorSelectionHandler(summary.developer)}
								/>
							</div>
						</td>
						<td
							class="metric-value px-4 py-4 text-right font-extrabold text-mint"
						>
							{formatNumber(summary.donePoints)}
						</td>
						<td class="metric-value px-4 py-4 text-right text-sky">
							{formatNumber(summary.qualityAssurancePoints)}
						</td>
						<td class="metric-value px-4 py-4 text-right text-ice">
							{formatNumber(
								summary.readyForQualityAssurancePoints,
							)}
						</td>
						<td
							class="metric-value px-4 py-4 text-right font-extrabold text-brand"
						>
							{formatNumber(projectedSprintPoints(summary))}
						</td>
						<td
							class="metric-value px-4 py-4 text-right"
							class:text-coral={summary.bounceCount > 0}
						>
							{formatNumber(summary.bounceCount)}
						</td>
						<td class="px-6 py-4">
							<details class="max-w-xs">
								<summary
									class="cursor-pointer text-xs font-bold text-muted hover:text-ice"
								>
									{summary.tickets.length}
									{summary.tickets.length === 1
										? "ticket"
										: "tickets"}
								</summary>
								<SprintTicketLinks {jiraSiteUrl} tickets={summary.tickets} />
							</details>
						</td>
					</tr>
				{/each}
			{/snippet}
		</Table>
	{/if}
</Card>

{#if comparisonSprint && comparisons.length > 0}
	<Card class="mt-6 rounded-[1.2rem] p-5 sm:p-6" accent="info">
		<div
			class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"
		>
			<div>
				<h2 class="mt-2 text-lg font-extrabold text-ice">
					Compared with {comparisonSprint.name}
				</h2>
			</div>
			<p class="text-xs text-muted">
				Positive numbers means more points were delivered this sprint than the
				previous one.
			</p>
		</div>
		<div class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
			{#each comparisons as comparison, index (contributorIdentityKey(comparison.developer, comparison.developerAccountIdentifier))}
				<article class="rounded-xl border border-line/65 bg-canvas/32 p-4">
					<div class="flex items-center justify-between gap-3">
						<div class="flex min-w-0 items-center gap-2.5">
							<ContributorButton
								displayName={comparison.developer}
								accountIdentifier={comparison.developerAccountIdentifier}
								tone={index === 0 &&
								comparison.projectedPointsDelta > 0
									? "brand"
									: "neutral"}
								size="small"
								onSelect={contributorSelectionHandler(comparison.developer)}
							/>
						</div>
						<span
							class={`metric-value text-xl font-extrabold ${deltaClass(comparison.projectedPointsDelta)}`}
						>
							{formatDelta(comparison.projectedPointsDelta)}
						</span>
					</div>
					<div class="mt-4 grid grid-cols-3 gap-2 text-[0.68rem]">
						<p class="text-muted">
							Done
							<span
								class={`ml-1 font-mono font-bold ${deltaClass(comparison.donePointsDelta)}`}
								>{formatDelta(comparison.donePointsDelta)}</span
							>
						</p>
						<p class="text-muted">
							Pipeline
							<span
								class={`ml-1 font-mono font-bold ${deltaClass(comparison.qualityAssurancePointsDelta + comparison.readyForQualityAssurancePointsDelta)}`}
								>{formatDelta(
									comparison.qualityAssurancePointsDelta +
										comparison.readyForQualityAssurancePointsDelta,
								)}</span
							>
						</p>
						<p class="text-muted">
							Bounces
							<span
								class={`ml-1 font-mono font-bold ${deltaClass(-comparison.bounceCountDelta)}`}
								>{formatDelta(
									comparison.bounceCountDelta,
								)}</span
							>
						</p>
					</div>
				</article>
			{/each}
		</div>
	</Card>
{/if}
