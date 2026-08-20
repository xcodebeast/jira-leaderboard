<script lang="ts">
import type { QualityAssuranceConfiguration } from "../browser/configuration";
import {
	type TesterSprintSummary,
	totalQualityAssuranceTicketCount,
} from "../domain/quality-assurance-performance";
import { formatNumber } from "../presentation/format";
import Avatar from "./ui/Avatar.svelte";
import Card from "./ui/Card.svelte";
import EmptyState from "./ui/EmptyState.svelte";
import MetricCard from "./ui/MetricCard.svelte";
import RankBadge from "./ui/RankBadge.svelte";
import Table from "./ui/Table.svelte";
import SprintTicketLinks from "./SprintTicketLinks.svelte";

interface Properties {
	configuration: QualityAssuranceConfiguration;
	jiraSiteUrl: string;
	summaries: TesterSprintSummary[];
}

let { configuration, jiraSiteUrl, summaries }: Properties = $props();
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
</script>

<Card class="overflow-hidden rounded-[1.2rem]">
	<div
		class="flex flex-col gap-4 border-b border-line/70 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
	>
		<div>
			<div class="flex flex-wrap items-center gap-2">
				<h2 class="text-lg font-extrabold text-ice">
					Quality assurance scoreboard
				</h2>
			</div>
			<p class="mt-1 text-xs leading-5 text-muted">
				Ranked by cleared points, cleared ticket count, then ready points.
			</p>
		</div>
		<div class="flex flex-wrap gap-3 text-[0.68rem] font-bold text-muted">
			<span
				><i
					class="mr-1.5 inline-block size-2 rounded-full bg-mint"
				></i>Cleared</span
			>
			<span
				><i
					class="mr-1.5 inline-block size-2 rounded-full bg-sky"
				></i>Ready</span
			>
		</div>
	</div>

	{#if summaries.length === 0}
		<EmptyState
			title="No tracked QA work"
			description="No issues on the QA board matched the configured Done or Ready for QA statuses for this sprint."
			symbol="✓"
		/>
	{:else}
		<div class="divide-y divide-line/60 md:hidden">
			{#each summaries as summary, rank (summary.tester)}
				<article class={`p-5 ${rank === 0 ? "bg-brand/3" : ""}`}>
					<div class="flex items-center gap-3">
						<RankBadge rank={rank + 1} />
						<Avatar
							name={summary.tester}
							tone={rank === 0 ? "brand" : "info"}
						/>
						<div class="min-w-0 flex-1">
							<p class="truncate font-extrabold text-ice">
								{summary.tester}
							</p>
							<p class="mt-0.5 text-xs text-muted">
								{totalQualityAssuranceTicketCount(summary)}
								{totalQualityAssuranceTicketCount(summary) === 1
									? "ticket"
									: "tickets"}
							</p>
						</div>
						<p class="metric-value text-2xl font-extrabold text-brand">
							{formatNumber(summary.doneStoryPoints)}
						</p>
					</div>
					<dl class="mt-4 grid grid-cols-3 gap-2 text-center">
						<div class="rounded-lg bg-canvas/35 px-3 py-2">
							<dt class="text-[0.62rem] uppercase tracking-wide text-muted">
								Cleared tickets
							</dt>
							<dd class="metric-value mt-1 font-extrabold text-mint">
								{summary.doneTicketCount}
							</dd>
						</div>
						<div class="rounded-lg bg-canvas/35 px-3 py-2">
							<dt class="text-[0.62rem] uppercase tracking-wide text-muted">
								Ready points
							</dt>
							<dd class="metric-value mt-1 font-extrabold text-sky">
								{formatNumber(
									summary.readyForQualityAssuranceStoryPoints,
								)}
							</dd>
						</div>
						<div class="rounded-lg bg-canvas/35 px-3 py-2">
							<dt class="text-[0.62rem] uppercase tracking-wide text-muted">
								Ready tickets
							</dt>
							<dd class="metric-value mt-1 font-extrabold text-ice">
								{summary.readyForQualityAssuranceTicketCount}
							</dd>
						</div>
					</dl>
					<details
						class="mt-4 rounded-lg border border-line/65 bg-canvas/25 px-3 py-2.5"
					>
						<summary class="cursor-pointer text-xs font-bold text-muted">
							View QA work
						</summary>
						<SprintTicketLinks {jiraSiteUrl} tickets={summary.tickets} />
					</details>
				</article>
			{/each}
		</div>

		<Table
			class="hidden md:block"
			label="Quality assurance sprint rankings"
			minimumWidth="54rem"
		>
			{#snippet head()}
				<tr>
					<th class="px-6 py-3 font-bold">Tester</th>
					<th class="px-4 py-3 text-right font-bold">Cleared points</th>
					<th class="px-4 py-3 text-right font-bold">Cleared tickets</th>
					<th class="px-4 py-3 text-right font-bold">Ready points</th>
					<th class="px-4 py-3 text-right font-bold">Ready tickets</th>
					<th class="px-6 py-3 font-bold">Work</th>
				</tr>
			{/snippet}
			{#snippet body()}
				{#each summaries as summary, rank (summary.tester)}
					<tr
						class={`transition-colors hover:bg-panel-soft/45 ${rank === 0 ? "bg-brand/3" : ""}`}
					>
						<td class="px-6 py-4">
							<div class="flex items-center gap-3">
								<RankBadge rank={rank + 1} />
								<Avatar
									name={summary.tester}
									tone={rank === 0 ? "brand" : "info"}
								/>
								<span class="font-bold text-ice">{summary.tester}</span>
							</div>
						</td>
						<td
							class="metric-value px-4 py-4 text-right font-extrabold text-mint"
						>
							{formatNumber(summary.doneStoryPoints)}
						</td>
						<td class="metric-value px-4 py-4 text-right font-bold text-ice">
							{summary.doneTicketCount}
						</td>
						<td class="metric-value px-4 py-4 text-right font-bold text-sky">
							{formatNumber(
								summary.readyForQualityAssuranceStoryPoints,
							)}
						</td>
						<td class="metric-value px-4 py-4 text-right text-ice">
							{summary.readyForQualityAssuranceTicketCount}
						</td>
						<td class="px-6 py-4">
							<details class="max-w-xs">
								<summary
									class="cursor-pointer text-xs font-bold text-muted hover:text-ice"
								>
									{totalQualityAssuranceTicketCount(summary)}
									{totalQualityAssuranceTicketCount(
										summary,
									) === 1
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
