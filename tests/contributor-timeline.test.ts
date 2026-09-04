import { describe, expect, test } from "bun:test";
import type { ContributorWorkItem } from "../src/lib/domain/contributor-performance";
import {
	automaticGranularity,
	buildPerformanceTimeline,
	calendarDate,
	clampPerformanceRange,
	daysInRange,
	movingAverage,
	percentageChange,
	performanceTotals,
	previousPerformanceRange,
	workInRange,
	zoomPerformanceRange,
} from "../src/lib/domain/contributor-timeline";

const workItems: ContributorWorkItem[] = [
	{
		issueKey: "APP-1",
		summary: "December delivery",
		resolutionDate: "2024-12-31T23:45:00-0800",
		storyPoints: 5,
		bounceCount: 2,
	},
	{
		issueKey: "APP-2",
		summary: "January delivery",
		resolutionDate: "2025-01-01T00:15:00+1400",
		storyPoints: 8,
		bounceCount: 0,
	},
	{
		issueKey: "APP-3",
		summary: "Unestimated delivery",
		resolutionDate: "2025-01-01T14:00:00Z",
		storyPoints: 0,
		bounceCount: 1,
	},
	{
		issueKey: "APP-4",
		summary: "March delivery",
		resolutionDate: "2025-03-20T12:00:00Z",
		storyPoints: 3,
		bounceCount: 0,
	},
];

describe("contributor timeline", () => {
	test("keeps separate years and fills inactive months across all-time history", () => {
		const buckets = buildPerformanceTimeline(
			workItems,
			{ start: "2024-12-01", end: "2025-03-31" },
			"month",
		);
		expect(
			buckets.map((bucket) => [
				bucket.key,
				bucket.completedPoints,
				bucket.completedTickets,
			]),
		).toEqual([
			["2024-12-01", 5, 1],
			["2025-01-01", 8, 2],
			["2025-02-01", 0, 0],
			["2025-03-01", 3, 1],
		]);
		expect(new Set(buckets.map((bucket) => bucket.label)).size).toBe(4);
	});

	test("uses Jira calendar dates consistently at timezone boundaries and includes both endpoints", () => {
		expect(
			workInRange(workItems, { start: "2024-12-31", end: "2024-12-31" }).map(
				(workItem) => workItem.issueKey,
			),
		).toEqual(["APP-1"]);
		expect(
			workInRange(workItems, { start: "2025-01-01", end: "2025-01-01" }).map(
				(workItem) => workItem.issueKey,
			),
		).toEqual(["APP-2", "APP-3"]);
	});

	test("rejects impossible dates instead of rolling them into the next month", () => {
		expect(calendarDate("2025-02-29T12:00:00Z")).toBeNull();
		expect(calendarDate("2024-02-29T12:00:00Z")).toBe("2024-02-29");
		expect(calendarDate("2025-04-31")).toBeNull();
		expect(calendarDate("2025-13-01")).toBeNull();
		expect(calendarDate("not a date")).toBeNull();
	});

	test("counts tickets with rework separately from number of bounces and retains zero-point work", () => {
		expect(performanceTotals(workItems)).toEqual({
			completedPoints: 16,
			completedTickets: 4,
			averagePointsPerTicket: 4,
			bounceCount: 3,
			bouncedTickets: 2,
			activeDays: 3,
		});
	});

	test("groups weeks from Monday, clips both edges, and does not lose cross-year work", () => {
		const buckets = buildPerformanceTimeline(
			workItems,
			{ start: "2024-12-31", end: "2025-01-08" },
			"week",
		);
		expect(buckets).toHaveLength(2);
		expect(buckets[0]).toMatchObject({
			key: "2024-12-30",
			start: "2024-12-31",
			end: "2025-01-05",
			completedPoints: 13,
			completedTickets: 3,
			partial: true,
		});
		expect(buckets[1]).toMatchObject({
			key: "2025-01-06",
			start: "2025-01-06",
			end: "2025-01-08",
			completedTickets: 0,
			partial: true,
		});
	});

	test("preserves totals when switching between daily, weekly and monthly views", () => {
		for (const granularity of ["day", "week", "month"] as const) {
			const buckets = buildPerformanceTimeline(
				workItems,
				{ start: "2024-12-31", end: "2025-03-20" },
				granularity,
			);
			expect(
				buckets.reduce((total, bucket) => total + bucket.completedPoints, 0),
			).toBe(16);
			expect(
				buckets.reduce((total, bucket) => total + bucket.completedTickets, 0),
			).toBe(4);
		}
	});

	test("marks today as partial even for daily or calendar-aligned ranges", () => {
		const buckets = buildPerformanceTimeline(
			workItems,
			{ start: "2025-01-01", end: "2025-01-02" },
			"day",
			"2025-01-02",
		);
		expect(buckets[0].partial).toBe(false);
		expect(buckets[1].partial).toBe(true);
	});

	test("fills leap days and calculates equal-length preceding periods", () => {
		const range = { start: "2024-02-01", end: "2024-02-29" };
		expect(daysInRange(range)).toBe(29);
		expect(buildPerformanceTimeline([], range, "day")).toHaveLength(29);
		expect(previousPerformanceRange(range)).toEqual({
			start: "2024-01-03",
			end: "2024-01-31",
		});
	});

	test("only calculates a trend from three complete periods, retaining zero activity", () => {
		const buckets = buildPerformanceTimeline(
			workItems,
			{ start: "2024-12-15", end: "2025-04-15" },
			"month",
		);
		const averages = movingAverage(buckets, "completedPoints");
		expect(averages.slice(0, 3)).toEqual([null, null, null]);
		expect(averages[3]).toBeCloseTo(11 / 3);
		expect(averages[4]).toBeNull();
	});

	test("avoids percentages against an empty baseline", () => {
		expect(percentageChange(10, 0)).toBeNull();
		expect(percentageChange(0, 0)).toBeNull();
		expect(percentageChange(15, 10)).toBe(50);
		expect(percentageChange(0, 10)).toBe(-100);
	});

	test("automatically increases detail as the visible range narrows", () => {
		expect(
			automaticGranularity({ start: "2025-01-01", end: "2025-12-31" }),
		).toBe("month");
		expect(
			automaticGranularity({ start: "2025-01-01", end: "2025-03-31" }),
		).toBe("week");
		expect(
			automaticGranularity({ start: "2025-01-01", end: "2025-01-31" }),
		).toBe("day");
	});

	test("zooms and pans within history without losing window duration at edges", () => {
		const bounds = { start: "2025-01-01", end: "2025-01-31" };
		const zoomed = zoomPerformanceRange(bounds, bounds, 0.5);
		expect(daysInRange(zoomed)).toBe(16);
		expect(zoomPerformanceRange(zoomed, bounds, 4)).toEqual(bounds);
		expect(
			clampPerformanceRange({ start: "2024-12-29", end: "2025-01-04" }, bounds),
		).toEqual({ start: "2025-01-01", end: "2025-01-07" });
		expect(
			clampPerformanceRange({ start: "2025-01-29", end: "2025-02-04" }, bounds),
		).toEqual({ start: "2025-01-25", end: "2025-01-31" });
	});

	test("supports a single-day history and clamps zoom to a minimum of one day", () => {
		const range = { start: "2025-01-01", end: "2025-01-01" };
		expect(zoomPerformanceRange(range, range, 0.5)).toEqual(range);
		expect(buildPerformanceTimeline(workItems, range, "day")[0]).toMatchObject({
			completedTickets: 2,
			completedPoints: 8,
		});
	});

	test("handles empty or invalid ranges without invalid chart values", () => {
		expect(performanceTotals([]).averagePointsPerTicket).toBe(0);
		expect(
			buildPerformanceTimeline(
				[],
				{ start: "2025-02-01", end: "2025-01-01" },
				"month",
			),
		).toEqual([]);
		expect(
			buildPerformanceTimeline(
				[],
				{ start: "invalid", end: "2025-01-01" },
				"day",
			),
		).toEqual([]);
	});
});
