<script lang="ts">
import type { AllTimeLeaderboardEntry } from "../domain/all-time-performance";
import {
	type ContributorReference,
	contributorIdentityKey,
} from "../domain/contributor";
import { formatNumber } from "../presentation/format";
import ContributorButton from "./ContributorButton.svelte";
import Card from "./ui/Card.svelte";
import EmptyState from "./ui/EmptyState.svelte";
import RankBadge from "./ui/RankBadge.svelte";
import Table from "./ui/Table.svelte";

interface Properties {
	title: string;
	description: string;
	contributorLabel: string;
	entries: AllTimeLeaderboardEntry[];
	tone: "success" | "info";
	onOpenContributor?: (contributor: ContributorReference) => void;
}

let { title, contributorLabel, entries, tone, onOpenContributor }: Properties =
	$props();
</script>

<Card class="overflow-hidden rounded-[1.2rem]">
	<div class="border-b border-line/70 px-5 py-5 sm:px-6">
		<h2 class="text-lg font-extrabold text-ice">{title}</h2>
	</div>

	{#if entries.length === 0}
		<EmptyState
			title="No completed work yet"
			description="No board issues matched the configured Done status in this period."
			symbol="◇"
		/>
	{:else}
		<div class="divide-y divide-line/55 md:hidden">
			{#each entries as entry, rank (contributorIdentityKey(entry.contributor, entry.contributorAccountIdentifier))}
				<article class={`p-5 ${rank === 0 ? "bg-brand/3" : ""}`}>
					<div class="flex items-center gap-3">
						<RankBadge rank={rank + 1} />
						<ContributorButton
							displayName={entry.contributor}
							accountIdentifier={entry.contributorAccountIdentifier}
							tone={rank === 0 ? "brand" : tone}
							detail={`${entry.completedTickets} completed ${entry.completedTickets === 1 ? "ticket" : "tickets"}`}
							class="flex-1"
							onSelect={onOpenContributor}
						/>
						<p class="metric-value text-2xl font-extrabold text-brand">
							{formatNumber(entry.completedPoints)}
						</p>
					</div>
				</article>
			{/each}
		</div>

		<Table
			class="hidden md:block"
			label={`${title} rankings`}
			minimumWidth="36rem"
		>
			{#snippet head()}
				<tr>
					<th class="px-6 py-3 font-bold">{contributorLabel}</th>
					<th class="px-4 py-3 text-right font-bold">Completed points</th>
					<th class="px-6 py-3 text-right font-bold">Completed tickets</th>
				</tr>
			{/snippet}
			{#snippet body()}
				{#each entries as entry, rank (contributorIdentityKey(entry.contributor, entry.contributorAccountIdentifier))}
					<tr
						class={`transition-colors hover:bg-panel-soft/45 ${rank === 0 ? "bg-brand/3" : ""}`}
					>
						<td class="px-6 py-4">
							<div class="flex items-center gap-3">
								<RankBadge rank={rank + 1} />
								<ContributorButton
									displayName={entry.contributor}
									accountIdentifier={entry.contributorAccountIdentifier}
									tone={rank === 0 ? "brand" : tone}
									onSelect={onOpenContributor}
								/>
							</div>
						</td>
						<td class="px-4 py-4">
							<div class="ml-auto w-32">
								<div class="mb-1.5 flex justify-end">
									<span class="metric-value font-extrabold text-brand"
										>{formatNumber(
											entry.completedPoints,
										)}</span
									>
								</div>
							</div>
						</td>
						<td class="metric-value px-6 py-4 text-right font-bold text-ice">
							{entry.completedTickets}
						</td>
					</tr>
				{/each}
			{/snippet}
		</Table>
	{/if}
</Card>
