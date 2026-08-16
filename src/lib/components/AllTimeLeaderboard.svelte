<script lang="ts">
import type { AllTimeLeaderboardEntry } from "../domain/all-time-performance";

interface Properties {
	title: string;
	description: string;
	contributorLabel: string;
	entries: AllTimeLeaderboardEntry[];
	tone: "mint" | "violet";
}

let { title, description, contributorLabel, entries, tone }: Properties =
	$props();

let maximumCompletedPoints = $derived(
	Math.max(1, ...entries.map((entry) => entry.completedPoints)),
);

const numberFormatter = new Intl.NumberFormat("en-US", {
	maximumFractionDigits: 1,
});

function formatNumber(value: number): string {
	return numberFormatter.format(value);
}

function contributorInitials(name: string): string {
	return name
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase())
		.join("");
}
</script>

<section class="surface-card overflow-hidden rounded-2xl">
	<div class="border-b border-line/70 px-5 py-5 sm:px-6">
		<h2 class="font-bold text-white">{title}</h2>
		<p class="mt-1 text-xs text-muted">{description}</p>
	</div>

	{#if entries.length === 0}
		<div class="px-6 py-16 text-center">
			<p class="text-lg font-bold text-white">No completed tickets</p>
			<p class="mt-2 text-sm text-muted">
				No board issues matched the configured Done status.
			</p>
		</div>
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full min-w-[34rem] border-collapse text-left">
				<thead
					class="bg-canvas/35 text-[0.67rem] uppercase tracking-[0.1em] text-muted"
				>
					<tr>
						<th class="px-5 py-3 font-semibold sm:px-6">{contributorLabel}</th>
						<th class="px-4 py-3 text-right font-semibold">Done points</th>
						<th class="px-5 py-3 text-right font-semibold sm:px-6">
							Done tickets
						</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-line/55">
					{#each entries as entry, rank (entry.contributor)}
						<tr class="transition-colors hover:bg-panel-soft/45">
							<td class="px-5 py-4 sm:px-6">
								<div class="flex items-center gap-3">
									<span class="w-5 font-mono text-xs text-muted"
										>{String(rank + 1).padStart(2, "0")}</span
									>
									<span
										class={`grid size-9 shrink-0 place-items-center rounded-xl text-xs font-bold ${tone === "mint" ? "bg-mint/10 text-mint" : "bg-violet/10 text-violet"}`}
										>{contributorInitials(entry.contributor)}</span
									>
									<span class="font-semibold text-ice"
										>{entry.contributor}</span
									>
								</div>
							</td>
							<td class="px-4 py-4">
								<div class="flex items-center justify-end gap-3">
									<div
										class="h-1.5 w-16 overflow-hidden rounded-full bg-line sm:w-20"
									>
										<div
											class="h-full rounded-full"
											class:bg-mint={tone === "mint"}
											class:bg-violet={tone === "violet"}
											style={`width: ${(entry.completedPoints / maximumCompletedPoints) * 100}%`}
										></div>
									</div>
									<span
										class="metric-value w-12 text-right font-bold"
										class:text-mint={tone === "mint"}
										class:text-violet={tone === "violet"}
										>{formatNumber(entry.completedPoints)}</span
									>
								</div>
							</td>
							<td
								class="metric-value px-5 py-4 text-right font-semibold text-ice sm:px-6"
							>
								{entry.completedTickets}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
