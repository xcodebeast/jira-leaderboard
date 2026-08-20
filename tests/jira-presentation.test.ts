import { describe, expect, test } from "bun:test";
import { jiraIssueUrl } from "../src/lib/presentation/jira";

describe("Jira presentation links", () => {
	test("builds a Jira browse URL from the connected site and issue key", () => {
		expect(jiraIssueUrl("https://example.atlassian.net", "TEAM-123")).toBe(
			"https://example.atlassian.net/browse/TEAM-123",
		);
	});

	test("encodes unexpected characters without changing the Jira origin", () => {
		expect(jiraIssueUrl("https://example.atlassian.net/", "TEAM/123")).toBe(
			"https://example.atlassian.net/browse/TEAM%2F123",
		);
	});
});
