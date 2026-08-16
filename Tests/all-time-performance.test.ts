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

	test("escapes the configured Done status before adding it to JQL", () => {
		expect(buildDoneIssuesQuery('Done \\ "verified"')).toBe(
			'status = "Done \\\\ \\"verified\\""',
		);
	});
});
