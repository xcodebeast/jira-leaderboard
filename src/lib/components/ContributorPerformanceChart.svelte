<script lang="ts">
import {
	clampPerformanceRange,
	daysInRange,
	movingAverage,
	type PerformanceBucket,
	type PerformanceMetric,
	type PerformanceRange,
	rangeLabel,
	shiftDate,
	zoomPerformanceRange,
} from "../domain/contributor-timeline";
import { formatNumber } from "../presentation/format";
import Button from "./ui/Button.svelte";

interface Properties {
	buckets: PerformanceBucket[];
	metric: PerformanceMetric;
	metricLabel: string;
	range: PerformanceRange;
	bounds: PerformanceRange;
	selectedKey: string | null;
	showBounces: boolean;
	onSelect: (bucket: PerformanceBucket | null) => void;
	onRangeChange: (range: PerformanceRange) => void;
}
let {
	buckets,
	metric,
	metricLabel,
	range,
	bounds,
	selectedKey,
	showBounces,
	onSelect,
	onRangeChange,
}: Properties = $props();
const identifier = $props.id();
let containerWidth = $state(960);
let hoveredKey = $state<string | null>(null);
let dragStart = $state<number | null>(null);
let dragEnd = $state<number | null>(null);
let showAverage = $state(true);
const chartHeight = 300;
const chartLeft = 42;
const chartRight = 20;
const chartTop = 24;
const chartBottom = 42;
let chartWidth = $derived(Math.max(containerWidth, 200));
let plotWidth = $derived(chartWidth - chartLeft - chartRight);
const plotHeight = chartHeight - chartTop - chartBottom;
let maximumValue = $derived.by(() => {
	const peak = Math.max(1, ...buckets.map((bucket) => bucket[metric]));
	const rawStep = (peak * 1.1) / 4;
	const magnitude = 10 ** Math.floor(Math.log10(rawStep));
	const step = Math.ceil(rawStep / magnitude) * magnitude;
	return Math.max(metric === "averagePointsPerTicket" ? step : 1, step) * 4;
});
let averages = $derived(movingAverage(buckets, metric));
let focusedIndex = $derived.by(() => {
	const index = buckets.findIndex(
		(bucket) => bucket.key === (hoveredKey ?? selectedKey),
	);
	return index >= 0 ? index : Math.max(0, buckets.length - 1);
});
let focusedBucket = $derived(buckets[focusedIndex]);
let isZoomed = $derived(
	range.start !== bounds.start || range.end !== bounds.end,
);
let chartPoints = $derived(
	buckets
		.map((bucket, index) => `${xPosition(index)},${yPosition(bucket[metric])}`)
		.join(" "),
);
let areaPath = $derived(
	buckets.length
		? `M ${xPosition(0)} ${chartTop + plotHeight} L ${chartPoints.replaceAll(",", " ")} L ${xPosition(buckets.length - 1)} ${chartTop + plotHeight} Z`
		: "",
);
let averagePath = $derived(
	averages
		.map((value, index) =>
			value === null
				? ""
				: `${index === 0 || averages[index - 1] === null ? "M" : "L"} ${xPosition(index)} ${yPosition(value)}`,
		)
		.join(" "),
);
let tickIndexes = $derived(
	[
		...new Set(
			Array.from({ length: chartWidth < 500 ? 3 : 6 }, (_, index) =>
				Math.round((index * (buckets.length - 1)) / (chartWidth < 500 ? 2 : 5)),
			),
		),
	].filter((index) => index >= 0),
);

function xPosition(index: number): number {
	return (
		chartLeft +
		(buckets.length <= 1
			? plotWidth / 2
			: (index / (buckets.length - 1)) * plotWidth)
	);
}
function yPosition(value: number): number {
	return chartTop + plotHeight * (1 - value / maximumValue);
}
function indexAt(event: PointerEvent): number {
	const rectangle =
		event.currentTarget instanceof HTMLElement
			? event.currentTarget.getBoundingClientRect()
			: null;
	if (!rectangle) return 0;
	const ratio = (event.clientX - rectangle.left - chartLeft) / plotWidth;
	return Math.max(
		0,
		Math.min(buckets.length - 1, Math.round(ratio * (buckets.length - 1))),
	);
}
function beginSelection(event: PointerEvent): void {
	if (event.button !== 0 || !buckets.length) return;
	const target = event.currentTarget as HTMLElement;
	target.setPointerCapture(event.pointerId);
	target.focus({ preventScroll: true });
	dragStart = indexAt(event);
	dragEnd = dragStart;
	hoveredKey = buckets[dragStart].key;
}
function moveSelection(event: PointerEvent): void {
	const index = indexAt(event);
	hoveredKey = buckets[index]?.key ?? null;
	if (dragStart !== null) dragEnd = index;
}
function finishSelection(event: PointerEvent): void {
	if (dragStart === null) return;
	const index = indexAt(event);
	if (Math.abs(index - dragStart) >= 1) {
		const first = buckets[Math.min(index, dragStart)];
		const last = buckets[Math.max(index, dragStart)];
		onRangeChange({ start: first.start, end: last.end });
	} else onSelect(buckets[index]);
	dragStart = null;
	dragEnd = null;
}
function zoom(factor: number): void {
	onRangeChange(zoomPerformanceRange(range, bounds, factor));
}
function pan(direction: number): void {
	const distance = direction * Math.max(1, Math.round(daysInRange(range) / 2));
	onRangeChange(
		clampPerformanceRange(
			{
				start: shiftDate(range.start, distance),
				end: shiftDate(range.end, distance),
			},
			bounds,
		),
	);
}
function enableWheelZoom(element: HTMLElement): { destroy: () => void } {
	function handleWheel(event: WheelEvent): void {
		if (!event.ctrlKey && !event.metaKey) return;
		event.preventDefault();
		const anchor = Math.max(
			0,
			Math.min(
				1,
				(event.clientX - element.getBoundingClientRect().left - chartLeft) /
					plotWidth,
			),
		);
		const factor = Math.max(0.5, Math.min(2, Math.exp(event.deltaY * 0.01)));
		onRangeChange(zoomPerformanceRange(range, bounds, factor, anchor));
	}
	element.addEventListener("wheel", handleWheel, { passive: false });
	return { destroy: () => element.removeEventListener("wheel", handleWheel) };
}
function handleKeyboard(event: KeyboardEvent): void {
	if (
		[
			"ArrowLeft",
			"ArrowRight",
			"Home",
			"End",
			"Enter",
			" ",
			"+",
			"=",
			"-",
			"Escape",
		].includes(event.key)
	)
		event.preventDefault();
	if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
		const index = Math.max(
			0,
			Math.min(
				buckets.length - 1,
				focusedIndex + (event.key === "ArrowLeft" ? -1 : 1),
			),
		);
		hoveredKey = buckets[index]?.key ?? null;
	} else if (event.key === "Home") hoveredKey = buckets[0]?.key ?? null;
	else if (event.key === "End") hoveredKey = buckets.at(-1)?.key ?? null;
	else if (event.key === "Enter" || event.key === " ")
		onSelect(focusedBucket ?? null);
	else if (event.key === "+" || event.key === "=") zoom(0.5);
	else if (event.key === "-") zoom(2);
	else if (event.key === "Escape") {
		dragStart = null;
		dragEnd = null;
		onSelect(null);
	}
}
</script>

<div
	class="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 pb-4"
>
	<div class="flex flex-wrap items-center gap-4 text-xs text-muted">
		<span class="flex items-center gap-2"
			><span class="h-0.5 w-5 bg-sky"></span>{metricLabel}</span
		>
		<label class="flex cursor-pointer items-center gap-2">
			<input type="checkbox" bind:checked={showAverage} class="accent-brand">
			<span
				class="h-0.5 w-4 border-t border-dashed border-brand"
			></span>3-period average
		</label>
	</div>
	<div class="flex gap-1">
		<Button
			size="small"
			variant="ghost"
			aria-label="Pan earlier"
			disabled={range.start <= bounds.start}
			onclick={() => pan(-1)}
			>←</Button
		>
		<Button
			size="small"
			variant="secondary"
			aria-label="Zoom in"
			disabled={daysInRange(range) <= 1}
			onclick={() => zoom(0.5)}
			>＋</Button
		>
		<Button
			size="small"
			variant="secondary"
			aria-label="Zoom out"
			disabled={!isZoomed}
			onclick={() => zoom(2)}
			>−</Button
		>
		<Button
			size="small"
			variant="ghost"
			aria-label="Pan later"
			disabled={range.end >= bounds.end}
			onclick={() => pan(1)}
			>→</Button
		>
		<Button
			size="small"
			variant="ghost"
			disabled={!isZoomed}
			onclick={() => onRangeChange(bounds)}
			>All time</Button
		>
	</div>
</div>

<div class="mt-4 flex flex-wrap items-baseline justify-between gap-2 text-xs">
	<p class="font-semibold text-ice">{rangeLabel(range)}</p>
	<p class="text-muted">
		{buckets.length}
		periods · Drag to zoom · Select a point to see tickets
	</p>
</div>
<div
	class="relative touch-pan-y select-none rounded-lg focus-visible:outline-brand"
	bind:clientWidth={containerWidth}
	use:enableWheelZoom
	role="slider"
	aria-valuemin={0}
	aria-valuemax={Math.max(0, buckets.length - 1)}
	aria-valuenow={focusedIndex}
	aria-valuetext={focusedBucket ? `${focusedBucket.label}: ${formatNumber(focusedBucket[metric])} ${metricLabel.toLowerCase()}` : "No periods"}
	tabindex="0"
	aria-label={`Interactive ${metricLabel.toLowerCase()} timeline`}
	aria-describedby={`${identifier}-instructions`}
	onpointerdown={beginSelection}
	onpointermove={moveSelection}
	onpointerup={finishSelection}
	onpointercancel={() => { dragStart = null; dragEnd = null; }}
	onpointerleave={() => { if (dragStart === null) hoveredKey = null; }}
	onkeydown={handleKeyboard}
>
	<svg
		width="100%"
		height={chartHeight}
		viewBox={`0 0 ${chartWidth} ${chartHeight}`}
		role="img"
		aria-label={`${metricLabel} from ${range.start} to ${range.end}`}
	>
		<defs>
			<linearGradient id={`${identifier}-fill`} x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stop-color="#62c7d3" stop-opacity="0.25" />
				<stop offset="100%" stop-color="#62c7d3" stop-opacity="0.01" />
			</linearGradient>
		</defs>
		{#each [0, 1, 2, 3, 4] as gridLine (gridLine)}
			<line
				x1={chartLeft}
				x2={chartWidth - chartRight}
				y1={chartTop + plotHeight * gridLine / 4}
				y2={chartTop + plotHeight * gridLine / 4}
				stroke="currentColor"
				class="text-line/65"
				stroke-dasharray="3 6"
			/>
			<text
				x={chartLeft - 10}
				y={chartTop + plotHeight * gridLine / 4 + 4}
				text-anchor="end"
				class="fill-muted text-[10px]"
			>
				{formatNumber(maximumValue * (1 - gridLine / 4))}
			</text>
		{/each}
		{#each buckets as bucket, index (bucket.key)}
			{#if bucket.partial}
				<rect
					x={Math.max(chartLeft, xPosition(index) - plotWidth / Math.max(1, buckets.length - 1) / 2)}
					y={chartTop}
					width={buckets.length <= 1 ? plotWidth : plotWidth / (buckets.length - 1) / 2}
					height={plotHeight}
					fill="#f6cf5b"
					fill-opacity="0.05"
				/>
			{/if}
		{/each}
		<path d={areaPath} fill={`url(#${identifier}-fill)`} />
		<polyline
			points={chartPoints}
			fill="none"
			stroke="#62c7d3"
			stroke-width="2.5"
			stroke-linejoin="round"
			stroke-linecap="round"
		/>
		{#if showAverage}
			<path
				d={averagePath}
				fill="none"
				stroke="#f6cf5b"
				stroke-width="2"
				stroke-dasharray="5 5"
			/>
		{/if}
		{#if dragStart !== null && dragEnd !== null}
			<rect
				x={xPosition(Math.min(dragStart, dragEnd))}
				y={chartTop}
				width={Math.max(2, Math.abs(xPosition(dragEnd) - xPosition(dragStart)))}
				height={plotHeight}
				fill="#62c7d3"
				fill-opacity="0.16"
				stroke="#62c7d3"
			/>
		{/if}
		{#if focusedBucket}
			<line
				x1={xPosition(focusedIndex)}
				x2={xPosition(focusedIndex)}
				y1={chartTop}
				y2={chartTop + plotHeight}
				stroke="#a5b1b3"
				stroke-opacity="0.5"
				stroke-dasharray="3 4"
			/>
			<circle
				cx={xPosition(focusedIndex)}
				cy={yPosition(focusedBucket[metric])}
				r="5"
				fill="#141e23"
				stroke="#62c7d3"
				stroke-width="3"
			/>
		{/if}
		{#each tickIndexes as index (index)}
			<text
				x={xPosition(index)}
				y={chartHeight - 14}
				text-anchor={index === 0 ? "start" : index === buckets.length - 1 ? "end" : "middle"}
				class="fill-muted text-[10px]"
			>
				{buckets[index]?.shortLabel}{buckets[index]?.partial ? "*" : ""}
			</text>
		{/each}
	</svg>
</div>

{#if focusedBucket}
	<div
		class="grid gap-3 rounded-xl border border-line/70 bg-canvas-soft/60 p-4 sm:grid-cols-[1.4fr_1fr_1fr_1fr]"
		aria-live="polite"
		aria-atomic="true"
	>
		<div>
			<p class="text-sm font-bold text-ice">{focusedBucket.label}</p>
			<p class="mt-1 text-[11px] text-muted">
				{focusedBucket.partial ? "Partial period · " : ""}
				{selectedKey === focusedBucket.key ? "Selected · tickets below" : "Select to inspect contributions"}
			</p>
		</div>
		<div>
			<p class="text-[11px] text-muted">Points / tickets</p>
			<p class="mt-1 font-bold text-sky">
				{formatNumber(focusedBucket.completedPoints)}
				<span class="font-normal text-muted"
					>/ {focusedBucket.completedTickets}</span
				>
			</p>
		</div>
		<div>
			<p class="text-[11px] text-muted">Average ticket size</p>
			<p class="mt-1 font-bold">
				{formatNumber(focusedBucket.averagePointsPerTicket)}
				<span class="font-normal text-muted">pts</span>
			</p>
		</div>
		<div>
			<p class="text-[11px] text-muted">
				{showBounces ? "Bounces" : "Active days"}
			</p>
			<p class="mt-1 font-bold">
				{showBounces ? focusedBucket.bounceCount : focusedBucket.activeDays}
			</p>
		</div>
	</div>
{/if}

<p
	id={`${identifier}-instructions`}
	class="mt-3 text-[11px] leading-5 text-muted"
>
	Drag or Ctrl/⌘ + scroll to zoom. Arrow keys explore; Enter shows tickets. *
	Partial period. Weeks start Monday. Dashed trend averages three complete
	periods; partial periods are excluded.
</p>
<details class="mt-3 text-xs text-muted">
	<summary class="cursor-pointer py-2">View timeline as a table</summary>
	<div class="max-h-72 overflow-auto">
		<table class="w-full text-left">
			<caption class="screen-reader-only">
				{metricLabel}
				by period
			</caption>
			<thead>
				<tr>
					<th class="py-2">Period</th>
					<th>Points</th>
					<th>Tickets</th>
					{#if showBounces}
						<th>Bounces</th>
					{/if}
				</tr>
			</thead>
			<tbody>
				{#each buckets as bucket (bucket.key)}
					<tr class="border-t border-line/60">
						<td class="py-2">
							<button
								type="button"
								class="text-sky underline underline-offset-2"
								onclick={() => onSelect(bucket)}
							>
								{bucket.label}{bucket.partial ? " (partial)" : ""}
							</button>
						</td>
						<td>{formatNumber(bucket.completedPoints)}</td>
						<td>{bucket.completedTickets}</td>
						{#if showBounces}
							<td>{bucket.bounceCount}</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</details>
