import { describe, expect, test } from "bun:test";
import {
	developmentWorkForContributor,
	qualityAssuranceWorkForContributor,
	summarizeContributorPerformance,
} from "../src/lib/domain/contributor-performance";
import type {
	JiraIssue,
	JiraQualityAssuranceIssue,
} from "../src/lib/domain/jira";

function developmentIssue(overrides: Partial<JiraIssue>): JiraIssue {
	return {
		issueKey: "DEMO-1",
		summary: "Completed work",
		statusName: "Done",
		resolutionDate: "2026-01-15T12:00:00.000+0000",
		storyPoints: 5,
		developer: "Alex",
		bounceCount: 1,
		...overrides,
	};
}

function qualityAssuranceIssue(
	overrides: Partial<JiraQualityAssuranceIssue>,
): JiraQualityAssuranceIssue {
	return {
		issueKey: "QA-1",
		summary: "Verified work",
		statusName: "Done",
		resolutionDate: "2026-03-10T12:00:00.000+0000",
		storyPoints: 3,
		tester: "Casey",
		...overrides,
	};
}

describe("contributor performance", () => {
	test("matches renamed development work by Jira account identifier", () => {
		const work = developmentWorkForContributor(
			[
				developmentIssue({
					developer: "Alex Old",
					developerAccountIdentifier: "account-alex",
				}),
				developmentIssue({
					issueKey: "DEMO-2",
					developer: "Alex New",
					developerAccountIdentifier: "account-alex",
				}),
				developmentIssue({
					issueKey: "DEMO-3",
					developer: "Alex New",
					developerAccountIdentifier: "different-account",
				}),
			],
			{ displayName: "Alex New", accountIdentifier: "account-alex" },
			"Done",
		);

		expect(work.map((workItem) => workItem.issueKey)).toEqual([
			"DEMO-1",
			"DEMO-2",
		]);
	});

	test("falls back to normalized names for text contributor fields", () => {
		const work = qualityAssuranceWorkForContributor(
			[qualityAssuranceIssue({ tester: "Élodie" })],
			{ displayName: "elodie", accountIdentifier: null },
			"Done",
		);

		expect(work).toHaveLength(1);
	});

	test("builds monthly totals, averages, peak month, and recent work", () => {
		const summary = summarizeContributorPerformance(
			[
				{
					issueKey: "DEMO-1",
					summary: "January delivery",
					resolutionDate: "2026-01-15T12:00:00.000+0000",
					storyPoints: 5,
					bounceCount: 1,
				},
				{
					issueKey: "DEMO-2",
					summary: "March delivery",
					resolutionDate: "2026-03-20T12:00:00.000+0000",
					storyPoints: 8,
					bounceCount: 2,
				},
				{
					issueKey: "OLD-1",
					summary: "Previous year",
					resolutionDate: "2025-12-20T12:00:00.000+0000",
					storyPoints: 13,
					bounceCount: 4,
				},
			],
			2026,
		);

		expect(summary.completedPoints).toBe(13);
		expect(summary.completedTickets).toBe(2);
		expect(summary.averagePointsPerTicket).toBe(6.5);
		expect(summary.bounceCount).toBe(3);
		expect(summary.activeMonths).toBe(2);
		expect(summary.bestMonth?.label).toBe("March");
		expect(summary.monthlyPerformance[2]).toMatchObject({
			completedPoints: 8,
			completedTickets: 1,
		});
		expect(summary.recentWork.map((workItem) => workItem.issueKey)).toEqual([
			"DEMO-2",
			"DEMO-1",
		]);
	});
});
