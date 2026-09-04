import { describe, expect, test } from "bun:test";
import {
	buildDoneIssuesQuery,
	summarizeDeveloperAllTimeIssues,
	summarizeQualityAssuranceAllTimeIssues,
	totalAllTimeLeaderboard,
} from "../src/lib/domain/all-time-performance";
import type {
	JiraIssue,
	JiraQualityAssuranceIssue,
} from "../src/lib/domain/jira";

function createDeveloperIssue(overrides: Partial<JiraIssue>): JiraIssue {
	return {
		issueKey: "DEMO-1",
		summary: "",
		statusName: "Done",
		resolutionDate: null,
		storyPoints: null,
		developer: "Unassigned Developer",
		bounceCount: 0,
		...overrides,
	};
}

function createQualityAssuranceIssue(
	overrides: Partial<JiraQualityAssuranceIssue>,
): JiraQualityAssuranceIssue {
	return {
		issueKey: "DEMO-1",
		summary: "",
		statusName: "Done",
		storyPoints: null,
		tester: "Unassigned Tester",
		...overrides,
	};
}

describe("all-time performance", () => {
	test("ranks developers by completed points and then completed tickets", () => {
		const entries = summarizeDeveloperAllTimeIssues(
			[
				createDeveloperIssue({ storyPoints: 8, developer: "Alex" }),
				createDeveloperIssue({
					issueKey: "DEMO-2",
					storyPoints: null,
					developer: "Alex",
				}),
				createDeveloperIssue({ storyPoints: 8, developer: "Bailey" }),
				createDeveloperIssue({
					statusName: "Ready for QA",
					storyPoints: 13,
					developer: "Casey",
				}),
			],
			"Done",
		);

		expect(entries).toEqual([
			{ contributor: "Alex", completedPoints: 8, completedTickets: 2 },
			{ contributor: "Bailey", completedPoints: 8, completedTickets: 1 },
		]);
		expect(totalAllTimeLeaderboard(entries)).toEqual({
			completedPoints: 16,
			completedTickets: 3,
		});
	});

	test("uses the Tester field for the quality assurance leaderboard", () => {
		const entries = summarizeQualityAssuranceAllTimeIssues(
			[
				createQualityAssuranceIssue({ storyPoints: 3, tester: "Taylor" }),
				createQualityAssuranceIssue({
					issueKey: "DEMO-2",
					storyPoints: 5,
					tester: "Taylor",
				}),
				createQualityAssuranceIssue({ storyPoints: 5, tester: "Morgan" }),
			],
			"Done",
		);

		expect(entries).toEqual([
			{ contributor: "Taylor", completedPoints: 8, completedTickets: 2 },
			{ contributor: "Morgan", completedPoints: 5, completedTickets: 1 },
		]);
	});

	test("keeps renamed contributors together by Jira account identifier", () => {
		const entries = summarizeDeveloperAllTimeIssues(
			[
				createDeveloperIssue({
					storyPoints: 5,
					developer: "Alex Old",
					developerAccountIdentifier: "account-alex",
				}),
				createDeveloperIssue({
					issueKey: "DEMO-2",
					storyPoints: 8,
					developer: "Alex New",
					developerAccountIdentifier: "account-alex",
				}),
			],
			"Done",
		);

		expect(entries).toEqual([
			{
				contributor: "Alex Old",
				contributorAccountIdentifier: "account-alex",
				completedPoints: 13,
				completedTickets: 2,
			},
		]);
	});

	test("excludes unassigned contributors from both leaderboards and totals", () => {
		const developerEntries = summarizeDeveloperAllTimeIssues(
			[
				createDeveloperIssue({
					storyPoints: 100,
					developer: "Unassigned Developer",
				}),
				createDeveloperIssue({ storyPoints: 8, developer: "Alex" }),
			],
			"Done",
		);
		const qualityAssuranceEntries = summarizeQualityAssuranceAllTimeIssues(
			[
				createQualityAssuranceIssue({
					storyPoints: 100,
					tester: "Unassigned Tester",
				}),
				createQualityAssuranceIssue({ storyPoints: 5, tester: "Taylor" }),
			],
			"Done",
		);

		expect(developerEntries).toEqual([
			{ contributor: "Alex", completedPoints: 8, completedTickets: 1 },
		]);
		expect(totalAllTimeLeaderboard(developerEntries)).toEqual({
			completedPoints: 8,
			completedTickets: 1,
		});
		expect(qualityAssuranceEntries).toEqual([
			{ contributor: "Taylor", completedPoints: 5, completedTickets: 1 },
		]);
		expect(totalAllTimeLeaderboard(qualityAssuranceEntries)).toEqual({
			completedPoints: 5,
			completedTickets: 1,
		});
	});

	test("scopes the Done query to a selected calendar year", () => {
		expect(buildDoneIssuesQuery("Done", 2026, "customfield_20400")).toBe(
			'status = "Done" AND cf[20400] is not EMPTY AND resolved >= "2026-01-01" AND resolved < "2027-01-01"',
		);
	});

	test("uses an unbounded query for all time and safely escapes the status", () => {
		expect(buildDoneIssuesQuery('Done \\ "verified"', null, "assignee")).toBe(
			'status = "Done \\\\ \\"verified\\"" AND assignee is not EMPTY',
		);
	});
});

describe("individual contributor queries", () => {
	test("narrows all-time user-picker history to the selected account", () => {
		expect(
			buildDoneIssuesQuery("Done", null, "customfield_20400", "account-alex"),
		).toBe(
			'status = "Done" AND cf[20400] is not EMPTY AND cf[20400] = "account-alex"',
		);
	});

	test("combines account and year filters while escaping query values", () => {
		const query = buildDoneIssuesQuery(
			"Done",
			2026,
			"assignee",
			'account\\"name',
		);
		expect(query).toContain('assignee = "account\\\\\\"name"');
		expect(query).toContain(
			'resolved >= "2026-01-01" AND resolved < "2027-01-01"',
		);
	});

	test("retains the full query for text contributor fields without account IDs", () => {
		expect(buildDoneIssuesQuery("Done", null, "customfield_20400", null)).toBe(
			buildDoneIssuesQuery("Done", null, "customfield_20400"),
		);
	});
});
