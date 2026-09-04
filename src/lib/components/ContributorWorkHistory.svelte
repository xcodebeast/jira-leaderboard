<script lang="ts">
import type { ContributorWorkItem } from "../domain/contributor-performance";
import { dateLabel } from "../domain/contributor-timeline";
import { formatNumber } from "../presentation/format";
import { jiraIssueUrl } from "../presentation/jira";
import Button from "./ui/Button.svelte";
import Card from "./ui/Card.svelte";
import EmptyState from "./ui/EmptyState.svelte";
import Input from "./ui/Input.svelte";
import Select from "./ui/Select.svelte";
import Table from "./ui/Table.svelte";

interface Properties {
	workItems: ContributorWorkItem[];
	jiraSiteUrl: string;
	periodLabel: string;
	isDevelopment: boolean;
	isSelection: boolean;
	onClearSelection: () => void;
}
let {
	workItems,
	jiraSiteUrl,
	periodLabel,
	isDevelopment,
	isSelection,
	onClearSelection,
}: Properties = $props();
let search = $state("");
let sort = $state("newest");
let visibleCount = $state(15);
let filteredWork = $derived(
	workItems
		.filter((workItem) =>
			`${workItem.issueKey} ${workItem.summary}`
				.toLocaleLowerCase()
				.includes(search.trim().toLocaleLowerCase()),
		)
		.sort((left, right) => {
			if (sort === "points")
				return (
					right.storyPoints - left.storyPoints ||
					right.resolutionDate.localeCompare(left.resolutionDate)
				);
			if (sort === "bounces")
				return (
					right.bounceCount - left.bounceCount ||
					right.resolutionDate.localeCompare(left.resolutionDate)
				);
			return sort === "oldest"
				? left.resolutionDate.localeCompare(right.resolutionDate)
				: right.resolutionDate.localeCompare(left.resolutionDate);
		}),
);
</script>

<Card class="mt-6 overflow-hidden rounded-[1.2rem]">
	<div
		class="grid gap-5 border-b border-line/70 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_28rem] xl:items-center"
	>
		<div class="min-w-0">
			<p class="eyebrow">Behind the numbers</p>
			<h2 class="mt-2 text-xl font-extrabold text-ice">
				{isSelection ? "Selected contributions" : "Contribution history"}
				<span class="ml-2 text-sm font-normal text-muted"
					>{workItems.length}
					tickets</span
				>
			</h2>
			<div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
				<p class="text-xs text-muted">{periodLabel}</p>
				{#if isSelection}
					<Button size="small" variant="ghost" onclick={onClearSelection}
						>Clear selection</Button
					>
				{/if}
			</div>
		</div>
		<div class="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
			<div class="min-w-0">
				<Input
					type="search"
					aria-label="Search contributions"
					placeholder="Search tickets…"
					bind:value={search}
					oninput={() => visibleCount = 15}
					class="text-xs"
				/>
			</div>
			<div class="min-w-0">
				<Select
					aria-label="Sort contributions"
					bind:value={sort}
					class="text-xs"
					onchange={() => visibleCount = 15}
				>
					<option value="newest">Newest first</option>
					<option value="oldest">Oldest first</option>
					<option value="points">Most points</option>
					{#if isDevelopment}
						<option value="bounces">Most bounces</option>
					{/if}
				</Select>
			</div>
		</div>
	</div>
	{#if filteredWork.length}
		<Table label="Completed contributions" minimumWidth="36rem">
			{#snippet head()}
				<tr>
					<th class="px-6 py-3">Issue</th>
					<th class="px-4 py-3">Resolved</th>
					<th class="px-4 py-3 text-right">Points</th>
					{#if isDevelopment}
						<th class="px-6 py-3 text-right">Bounces</th>
					{/if}
				</tr>
			{/snippet}
			{#snippet body()}
				{#each filteredWork.slice(0, visibleCount) as workItem (workItem.issueKey)}
					<tr class="transition-colors hover:bg-panel-soft/45">
						<td class="px-6 py-4">
							<a
								class="font-bold text-sky underline decoration-sky/30 underline-offset-2 hover:text-ice"
								href={jiraIssueUrl(jiraSiteUrl, workItem.issueKey)}
								target="_blank"
								rel="noopener noreferrer"
								>{workItem.issueKey}</a
							>
							<p class="mt-1 max-w-3xl text-xs leading-5 text-muted">
								{workItem.summary}
							</p>
						</td>
						<td class="whitespace-nowrap px-4 py-4 text-xs text-muted">
							{dateLabel(workItem.resolutionDate.slice(0, 10))}
						</td>
						<td class="metric-value px-4 py-4 text-right font-bold text-ice">
							{formatNumber(workItem.storyPoints)}
						</td>
						{#if isDevelopment}
							<td class="px-6 py-4 text-right text-xs">
								<span
									class={workItem.bounceCount > 0 ? "rounded-md bg-coral/10 px-2 py-1 text-coral" : "text-muted"}
									>{workItem.bounceCount}</span
								>
							</td>
						{/if}
					</tr>
				{/each}
			{/snippet}
		</Table>
		<div
			class="flex items-center justify-between border-t border-line/60 px-6 py-4 text-xs text-muted"
		>
			<span
				>Showing {Math.min(visibleCount, filteredWork.length)} of
				{filteredWork.length}
				tickets</span
			>
			{#if visibleCount < filteredWork.length}
				<Button size="small" onclick={() => visibleCount += 30}
					>Show more tickets</Button
				>
			{/if}
		</div>
	{:else}
		<EmptyState
			title={search ? "No matching tickets" : "No contributions in this period"}
			description={search ? "Try another issue key or keyword." : "Choose another point on the timeline or widen the date range."}
			symbol="◇"
		/>
	{/if}
</Card>
