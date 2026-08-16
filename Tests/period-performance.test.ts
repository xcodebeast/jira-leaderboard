import { describe, expect, test } from "bun:test";
import type { JiraIssue } from "../src/lib/domain/jira";
import { unassignedDeveloperName } from "../src/lib/domain/jira";
import {
	buildProjectScopeQuery,
	buildResolvedIssuesQuery,
	compareResolvedSummaries,
	createResolvedDateRange,
	filterResolvedSummaries,
	summarizeResolvedIssues,
	totalResolvedSummary,
} from "../src/lib/domain/period-performance";

function createResolvedIssue(
	issueKey: string,
	storyPoints: number | null,
	developer: string,
): JiraIssue {
	return {
		issueKey,
		summary: "",
		statusName: "Done",
		resolutionDate: "2025-01-05T10:00:00.000+0000",
		storyPoints,
		developer,
		bounceCount: 0,
	};
}

describe("period performance", () => {
	test("creates an inclusive range with an exclusive query end", () => {
		expect(
			createResolvedDateRange("2025-01-01", "2025-12-31", "Last year"),
		).toEqual({
			label: "Last year",
			startDate: "2025-01-01",
			endDate: "2025-12-31",
			endDateExclusive: "2026-01-01",
		});
		expect(
			createResolvedDateRange("2024-02-29", "2024-02-29").endDateExclusive,
		).toBe("2024-03-01");
	});

	test("rejects impossible dates and reversed ranges", () => {
		expect(() => createResolvedDateRange("2025-02-30", "2025-12-31")).toThrow(
			"Invalid date for range start: 2025-02-30. Use YYYY-MM-DD.",
		);
		expect(() => createResolvedDateRange("2025-12-31", "2025-01-01")).toThrow(
			"Range end date 2025-01-01 must be on or after start date 2025-12-31",
		);
	});

	test("builds the resolved issue query", () => {
		const range = createResolvedDateRange(
			"2025-01-01",
			"2025-12-31",
			"Last year",
		);
		expect(buildResolvedIssuesQuery('project = "DEMO"', range)).toBe(
			'(project = "DEMO") AND resolution is not EMPTY AND resolved >= "2025-01-01" ' +
				'AND resolved < "2026-01-01" ORDER BY resolved ASC, key ASC',
		);
		expect(buildProjectScopeQuery('A\\"B')).toBe('project = "A\\\\\\"B"');
	});

	test("summarizes resolved points from the Developer field", () => {
		const unresolvedIssue = createResolvedIssue("DEMO-5", 13, "Alex");
		unresolvedIssue.resolutionDate = null;
		const summaries = summarizeResolvedIssues([
			createResolvedIssue("DEMO-1", 8, "Alex"),
			createResolvedIssue("DEMO-2", 2, "Alex"),
			createResolvedIssue("DEMO-3", 8, "Bailey"),
			createResolvedIssue("DEMO-4", null, unassignedDeveloperName),
			unresolvedIssue,
		]);

		expect(summaries).toEqual([
			{ developer: "Alex", resolvedPoints: 10, resolvedTickets: 2 },
			{ developer: "Bailey", resolvedPoints: 8, resolvedTickets: 1 },
			{
				developer: unassignedDeveloperName,
				resolvedPoints: 0,
				resolvedTickets: 1,
			},
		]);
	});

	test("compares baseline and comparison periods", () => {
		const comparisons = compareResolvedSummaries(
			[
				{ developer: "Alex", resolvedPoints: 10, resolvedTickets: 2 },
				{ developer: "Casey", resolvedPoints: 5, resolvedTickets: 1 },
			],
			[
				{ developer: "Alex", resolvedPoints: 14, resolvedTickets: 3 },
				{ developer: "Bailey", resolvedPoints: 8, resolvedTickets: 1 },
			],
		);

		expect(comparisons).toEqual([
			{
				developer: "Bailey",
				baselinePoints: 0,
				comparisonPoints: 8,
				pointsDelta: 8,
				pointsChange: "New",
				baselineTickets: 0,
				comparisonTickets: 1,
				ticketsDelta: 1,
			},
			{
				developer: "Alex",
				baselinePoints: 10,
				comparisonPoints: 14,
				pointsDelta: 4,
				pointsChange: "+40.0%",
				baselineTickets: 2,
				comparisonTickets: 3,
				ticketsDelta: 1,
			},
			{
				developer: "Casey",
				baselinePoints: 5,
				comparisonPoints: 0,
				pointsDelta: -5,
				pointsChange: "-100.0%",
				baselineTickets: 1,
				comparisonTickets: 0,
				ticketsDelta: -1,
			},
		]);
	});

	test("filters names without case or accent sensitivity and includes missing rows", () => {
		const summaries = [
			{
				developer: "Renée Martin",
				resolvedPoints: 8,
				resolvedTickets: 1,
			},
			{ developer: "Alex Morgan", resolvedPoints: 10, resolvedTickets: 2 },
		];
		expect(
			filterResolvedSummaries(summaries, ["renee martin", "Taylor Brooks"]),
		).toEqual([
			{
				developer: "Renée Martin",
				resolvedPoints: 8,
				resolvedTickets: 1,
			},
			{ developer: "Taylor Brooks", resolvedPoints: 0, resolvedTickets: 0 },
		]);
	});

	test("totals selected developers", () => {
		expect(
			totalResolvedSummary("All Developers", [
				{ developer: "Alex", resolvedPoints: 10, resolvedTickets: 2 },
				{ developer: "Bailey", resolvedPoints: 8, resolvedTickets: 1 },
			]),
		).toEqual({
			developer: "All Developers",
			resolvedPoints: 18,
			resolvedTickets: 3,
		});
	});
});
