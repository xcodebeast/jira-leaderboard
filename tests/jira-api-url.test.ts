import { describe, expect, test } from "bun:test";
import {
	isJiraCloudIdentifier,
	jiraApiRequestUrl,
} from "../src/lib/server/jira-api-url";
import {
	createPendingJiraCredentials,
	createScopedJiraCredentials,
} from "../src/lib/server/jira-authentication";

const cloudIdentifier = "12345678-1234-4abc-8def-1234567890ab";
const pendingCredentials = createPendingJiraCredentials({
	jiraSiteUrl: "https://example.atlassian.net",
	emailAddress: "scrum.master@example.com",
	apiToken: "read-only-secret-token",
	issuedAt: "2026-08-13T12:00:00.000Z",
});

describe("Jira API URL routing", () => {
	test("keeps classic tokens on the Jira site origin", () => {
		expect(
			jiraApiRequestUrl(pendingCredentials, "/rest/api/3/myself").toString(),
		).toBe("https://example.atlassian.net/rest/api/3/myself");
	});

	test("preserves the scoped gateway prefix for absolute-looking paths", () => {
		const scopedCredentials = createScopedJiraCredentials(
			pendingCredentials,
			cloudIdentifier,
		);

		expect(
			jiraApiRequestUrl(scopedCredentials, "/rest/api/3/myself").toString(),
		).toBe(
			`https://api.atlassian.com/ex/jira/${cloudIdentifier}/rest/api/3/myself`,
		);
	});

	test("accepts only canonical Atlassian Cloud identifiers", () => {
		expect(isJiraCloudIdentifier(cloudIdentifier)).toBeTrue();
		expect(isJiraCloudIdentifier("../another-site")).toBeFalse();
		expect(() =>
			createScopedJiraCredentials(pendingCredentials, "not-a-cloud-id"),
		).toThrow("Jira returned an invalid Cloud identifier.");
	});
});
