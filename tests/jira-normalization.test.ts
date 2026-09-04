import { describe, expect, test } from "bun:test";
import {
	type JiraFieldMapping,
	type QualityAssuranceFieldMapping,
	unassignedDeveloperName,
	unassignedTesterName,
} from "../src/lib/domain/jira";
import {
	normalizeJiraIssue,
	normalizeJiraQualityAssuranceIssue,
} from "../src/lib/server/jira-client";

const fixtureFieldMapping: JiraFieldMapping = {
	storyPointsFieldIdentifier: "customfield_10016",
	developerFieldIdentifier: "customfield_20001",
	bounceCountFieldIdentifier: "customfield_20002",
};

const qualityAssuranceFieldMapping: QualityAssuranceFieldMapping = {
	storyPointsFieldIdentifier: "customfield_10016",
	testerFieldIdentifier: "customfield_30001",
};

describe("Jira issue normalization", () => {
	test("reads numeric and user custom fields", () => {
		expect(
			normalizeJiraIssue(
				{
					key: "DEMO-101",
					fields: Object.fromEntries([
						["summary", "Ship the leaderboard"],
						["status", { name: "QA" }],
						["resolutiondate", "2026-08-13T12:00:00.000+0000"],
						["customfield_10016", 8],
						[
							"customfield_20001",
							[{ displayName: "Alex", accountId: "account-alex" }],
						],
						["customfield_20002", "2"],
					]),
				},
				fixtureFieldMapping,
			),
		).toEqual({
			issueKey: "DEMO-101",
			summary: "Ship the leaderboard",
			statusName: "QA",
			resolutionDate: "2026-08-13T12:00:00.000+0000",
			storyPoints: 8,
			developer: "Alex",
			developerAccountIdentifier: "account-alex",
			bounceCount: 2,
		});
	});

	test("supports text developers, multiple users, and missing assignments", () => {
		const textDeveloper = normalizeJiraIssue(
			{
				key: "DEMO-1",
				fields: Object.fromEntries([["customfield_20001", "Bailey"]]),
			},
			fixtureFieldMapping,
		);
		const multipleDevelopers = normalizeJiraIssue(
			{
				key: "DEMO-2",
				fields: Object.fromEntries([
					[
						"customfield_20001",
						[{ displayName: "Bailey" }, { emailAddress: "casey@example.com" }],
					],
				]),
			},
			fixtureFieldMapping,
		);
		const unassignedIssue = normalizeJiraIssue(
			{ key: "DEMO-3", fields: {} },
			fixtureFieldMapping,
		);

		expect(textDeveloper.developer).toBe("Bailey");
		expect(multipleDevelopers.developer).toBe("Bailey, casey@example.com");
		expect(unassignedIssue.developer).toBe(unassignedDeveloperName);
	});

	test("normalizes the Tester field independently for QA issues", () => {
		const assignedIssue = normalizeJiraQualityAssuranceIssue(
			{
				key: "DEMO-7",
				fields: Object.fromEntries([
					["summary", "Verify the leaderboard"],
					["status", { name: "Done" }],
					["resolutiondate", "2026-08-14T12:00:00.000+0000"],
					["customfield_10016", "5"],
					[
						"customfield_30001",
						{ displayName: "Casey", accountId: "account-casey" },
					],
				]),
			},
			qualityAssuranceFieldMapping,
		);
		const unassignedIssue = normalizeJiraQualityAssuranceIssue(
			{ key: "DEMO-8", fields: {} },
			qualityAssuranceFieldMapping,
		);

		expect(assignedIssue).toEqual({
			issueKey: "DEMO-7",
			summary: "Verify the leaderboard",
			statusName: "Done",
			resolutionDate: "2026-08-14T12:00:00.000+0000",
			storyPoints: 5,
			tester: "Casey",
			testerAccountIdentifier: "account-casey",
		});
		expect(unassignedIssue.tester).toBe(unassignedTesterName);
	});
});
