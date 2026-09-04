import type { ContributorWorkItem } from "./contributor-performance";

export interface PerformanceRange {
	start: string;
	end: string;
}

export type PerformanceGranularity = "day" | "week" | "month";
export type PerformanceMetric =
	| "completedPoints"
	| "completedTickets"
	| "averagePointsPerTicket"
	| "bounceCount";

export interface PerformanceTotals {
	completedPoints: number;
	completedTickets: number;
	averagePointsPerTicket: number;
	bounceCount: number;
	bouncedTickets: number;
	activeDays: number;
}

export interface PerformanceBucket extends PerformanceTotals, PerformanceRange {
	key: string;
	label: string;
	shortLabel: string;
	partial: boolean;
}

const millisecondsPerDay = 86_400_000;
const dateFormatter = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	year: "numeric",
	timeZone: "UTC",
});
const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	timeZone: "UTC",
});
const monthFormatter = new Intl.DateTimeFormat("en-US", {
	month: "short",
	year: "numeric",
	timeZone: "UTC",
});

export function calendarDate(value: string): string | null {
	const prefix = value.slice(0, 10);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(prefix)) return null;
	const timestamp = Date.parse(`${prefix}T00:00:00Z`);
	return Number.isFinite(timestamp) &&
		new Date(timestamp).toISOString().slice(0, 10) === prefix
		? prefix
		: null;
}

export function shiftDate(value: string, days: number): string {
	return new Date(Date.parse(`${value}T00:00:00Z`) + days * millisecondsPerDay)
		.toISOString()
		.slice(0, 10);
}

export function daysInRange(range: PerformanceRange): number {
	return (
		Math.round(
			(Date.parse(range.end) - Date.parse(range.start)) / millisecondsPerDay,
		) + 1
	);
}

export function dateLabel(value: string): string {
	return dateFormatter.format(new Date(`${value}T00:00:00Z`));
}

export function rangeLabel(range: PerformanceRange): string {
	return range.start === range.end
		? dateLabel(range.start)
		: `${dateLabel(range.start)} – ${dateLabel(range.end)}`;
}

export function workInRange(
	workItems: ContributorWorkItem[],
	range: PerformanceRange,
): ContributorWorkItem[] {
	return workItems.filter((workItem) => {
		const date = calendarDate(workItem.resolutionDate);
		return date !== null && date >= range.start && date <= range.end;
	});
}

export function performanceTotals(
	workItems: ContributorWorkItem[],
): PerformanceTotals {
	const completedPoints = workItems.reduce(
		(total, workItem) => total + workItem.storyPoints,
		0,
	);
	return {
		completedPoints,
		completedTickets: workItems.length,
		averagePointsPerTicket:
			workItems.length > 0 ? completedPoints / workItems.length : 0,
		bounceCount: workItems.reduce(
			(total, workItem) => total + workItem.bounceCount,
			0,
		),
		bouncedTickets: workItems.filter((workItem) => workItem.bounceCount > 0)
			.length,
		activeDays: new Set(
			workItems
				.map((workItem) => calendarDate(workItem.resolutionDate))
				.filter(Boolean),
		).size,
	};
}

export function automaticGranularity(
	range: PerformanceRange,
): PerformanceGranularity {
	const days = daysInRange(range);
	return days <= 45 ? "day" : days <= 180 ? "week" : "month";
}

function bucketStart(
	date: string,
	granularity: PerformanceGranularity,
): string {
	if (granularity === "month") return `${date.slice(0, 7)}-01`;
	if (granularity === "day") return date;
	const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
	return shiftDate(date, -((weekday + 6) % 7));
}

function nextBucket(
	start: string,
	granularity: PerformanceGranularity,
): string {
	if (granularity !== "month")
		return shiftDate(start, granularity === "week" ? 7 : 1);
	const date = new Date(`${start}T00:00:00Z`);
	date.setUTCMonth(date.getUTCMonth() + 1);
	return date.toISOString().slice(0, 10);
}

export function buildPerformanceTimeline(
	workItems: ContributorWorkItem[],
	range: PerformanceRange,
	granularity: PerformanceGranularity,
	asOfDate = new Date().toLocaleDateString("en-CA"),
): PerformanceBucket[] {
	if (
		!calendarDate(range.start) ||
		!calendarDate(range.end) ||
		range.start > range.end
	)
		return [];
	const groupedWork = new Map<string, ContributorWorkItem[]>();
	for (const workItem of workInRange(workItems, range)) {
		const key = bucketStart(workItem.resolutionDate.slice(0, 10), granularity);
		const group = groupedWork.get(key) ?? [];
		group.push(workItem);
		groupedWork.set(key, group);
	}
	const buckets: PerformanceBucket[] = [];
	for (
		let cursor = bucketStart(range.start, granularity);
		cursor <= range.end;
		cursor = nextBucket(cursor, granularity)
	) {
		const naturalEnd = shiftDate(nextBucket(cursor, granularity), -1);
		const start = cursor < range.start ? range.start : cursor;
		const end = naturalEnd > range.end ? range.end : naturalEnd;
		buckets.push({
			key: cursor,
			start,
			end,
			label:
				granularity === "month"
					? monthFormatter.format(new Date(`${cursor}T00:00:00Z`))
					: rangeLabel({ start, end }),
			shortLabel:
				granularity === "month"
					? monthFormatter.format(new Date(`${cursor}T00:00:00Z`))
					: shortDateFormatter.format(new Date(`${start}T00:00:00Z`)),
			partial: start !== cursor || end !== naturalEnd || end === asOfDate,
			...performanceTotals(groupedWork.get(cursor) ?? []),
		});
	}
	return buckets;
}

export function previousPerformanceRange(
	range: PerformanceRange,
): PerformanceRange {
	return {
		start: shiftDate(range.start, -daysInRange(range)),
		end: shiftDate(range.start, -1),
	};
}

export function percentageChange(
	current: number,
	previous: number,
): number | null {
	return previous === 0 ? null : ((current - previous) / previous) * 100;
}

export function movingAverage(
	buckets: PerformanceBucket[],
	metric: PerformanceMetric,
): (number | null)[] {
	return buckets.map((_, index) => {
		const window = buckets.slice(Math.max(0, index - 2), index + 1);
		if (window.length < 3 || window.some((bucket) => bucket.partial))
			return null;
		return window.reduce((total, bucket) => total + bucket[metric], 0) / 3;
	});
}

export function clampPerformanceRange(
	range: PerformanceRange,
	bounds: PerformanceRange,
): PerformanceRange {
	const duration = Math.max(
		1,
		Math.min(daysInRange(range), daysInRange(bounds)),
	);
	let start = range.start < bounds.start ? bounds.start : range.start;
	if (shiftDate(start, duration - 1) > bounds.end)
		start = shiftDate(bounds.end, 1 - duration);
	return { start, end: shiftDate(start, duration - 1) };
}

export function zoomPerformanceRange(
	range: PerformanceRange,
	bounds: PerformanceRange,
	factor: number,
	anchor = 0.5,
): PerformanceRange {
	const duration = daysInRange(range);
	const nextDuration = Math.max(
		1,
		Math.min(daysInRange(bounds), Math.round(duration * factor)),
	);
	const start = shiftDate(
		range.start,
		Math.round((duration - nextDuration) * anchor),
	);
	return clampPerformanceRange(
		{ start, end: shiftDate(start, nextDuration - 1) },
		bounds,
	);
}
