<script lang="ts">
import PeriodComparisonReport from "$lib/components/PeriodComparisonReport.svelte";
import Badge from "$lib/components/ui/Badge.svelte";
import Card from "$lib/components/ui/Card.svelte";
import type { SharedPeriodComparisonSnapshot } from "$lib/snapshot/schema";

interface Properties {
	snapshot: SharedPeriodComparisonSnapshot;
}

let { snapshot }: Properties = $props();
</script>

<section aria-labelledby="shared-period-heading">
	<Card class="rounded-[1.2rem] p-5 sm:p-6" accent="brand">
		<div
			class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"
		>
			<div>
				<div class="flex flex-wrap items-center gap-3">
					<p class="eyebrow">Period comparison</p>
					<Badge tone="info">Resolved work</Badge>
				</div>
				<h2
					id="shared-period-heading"
					class="display-title mt-3 text-3xl text-ice sm:text-4xl"
				>
					{snapshot.report.baseline.label}
					vs {snapshot.report.comparison.label}
				</h2>
				<p class="mt-2 text-sm text-muted">{snapshot.report.scopeLabel}</p>
			</div>
			<dl class="grid gap-3 text-sm sm:grid-cols-2 lg:min-w-[34rem]">
				<div class="rounded-xl border border-line/70 bg-canvas/38 px-4 py-3">
					<dt class="text-xs font-bold uppercase tracking-wide text-muted">
						{snapshot.report.baseline.label}
					</dt>
					<dd class="mt-1 font-bold text-ice">
						{snapshot.report.baseline.startDate}
						through {snapshot.report.baseline.endDate}
					</dd>
				</div>
				<div class="rounded-xl border border-line/70 bg-canvas/38 px-4 py-3">
					<dt class="text-xs font-bold uppercase tracking-wide text-muted">
						{snapshot.report.comparison.label}
					</dt>
					<dd class="mt-1 font-bold text-ice">
						{snapshot.report.comparison.startDate}
						through {snapshot.report.comparison.endDate}
					</dd>
				</div>
			</dl>
		</div>
	</Card>

	<PeriodComparisonReport
		baselineLabel={snapshot.report.baseline.label}
		comparisonLabel={snapshot.report.comparison.label}
		comparisons={snapshot.report.comparisons}
		totalComparison={snapshot.report.totalComparison}
	/>
</section>
