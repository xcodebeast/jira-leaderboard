import { afterEach, describe, expect, mock, test } from "bun:test";
import { loadDevelopmentAllTimeIssues } from "../src/lib/browser/api-client";
import { createPendingJiraCredentials } from "../src/lib/server/jira-authentication";
import {
	JIRA_PAGES_PER_REQUEST,
	JiraClient,
} from "../src/lib/server/jira-client";

const fieldMapping = {
	storyPointsFieldIdentifier: "customfield_1",
	developerFieldIdentifier: "customfield_2",
	bounceCountFieldIdentifier: "customfield_3",
};
const credentials = createPendingJiraCredentials({
	jiraSiteUrl: "https://example.atlassian.net",
	emailAddress: "scrum.master@example.com",
	apiToken: "read-only-secret-token",
	issuedAt: "2026-08-13T12:00:00.000Z",
});
const originalFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = originalFetch;
});

function jsonResponse(payload: unknown): Response {
	return new Response(JSON.stringify(payload), {
		headers: { "Content-Type": "application/json" },
	});
}

/** A Jira search that never runs out of pages, recording the page token each request sent. */
function endlessJiraSearch(): (string | null)[] {
	const sentTokens: (string | null)[] = [];
	globalThis.fetch = mock(async (_input: unknown, init?: RequestInit) => {
		const body = JSON.parse(String(init?.body)) as { nextPageToken?: string };
		sentTokens.push(body.nextPageToken ?? null);
		const page = sentTokens.length;
		return jsonResponse({
			issues: [{ key: `ISSUE-${page}`, fields: {} }],
			nextPageToken: `token-${page}`,
			isLast: false,
		});
	}) as unknown as typeof fetch;
	return sentTokens;
}

describe("Jira issue batches", () => {
	test("one request reads a bounded number of pages and returns where to continue", async () => {
		const sentTokens = endlessJiraSearch();
		const batch = await new JiraClient(credentials).developmentGlobalDoneIssues(
			"Done",
			null,
			fieldMapping,
		);
		expect(sentTokens).toHaveLength(JIRA_PAGES_PER_REQUEST);
		expect(batch.issues).toHaveLength(JIRA_PAGES_PER_REQUEST);
		expect(batch.nextPageToken).toBe(`token-${JIRA_PAGES_PER_REQUEST}`);
	});

	test("a batch continues from the page token it is given", async () => {
		const sentTokens = endlessJiraSearch();
		await new JiraClient(credentials).developmentGlobalDoneIssues(
			"Done",
			null,
			fieldMapping,
			null,
			"token-7",
		);
		expect(sentTokens[0]).toBe("token-7");
	});

	test("a batch ends with a null token on Jira's last page", async () => {
		globalThis.fetch = mock(async () =>
			jsonResponse({ issues: [{ key: "ISSUE-1", fields: {} }], isLast: true }),
		) as unknown as typeof fetch;
		const batch = await new JiraClient(credentials).developmentGlobalDoneIssues(
			"Done",
			null,
			fieldMapping,
		);
		expect(batch).toMatchObject({ nextPageToken: null });
	});

	test("the browser keeps requesting batches until the result is complete", async () => {
		const sentTokens: (string | null)[] = [];
		globalThis.fetch = mock(async (_input: unknown, init?: RequestInit) => {
			const body = JSON.parse(String(init?.body)) as { pageToken?: string };
			sentTokens.push(body.pageToken ?? null);
			const nextPageToken =
				sentTokens.length < 3 ? `batch-${sentTokens.length}` : null;
			return jsonResponse({
				issues: [{ issueKey: `ISSUE-${sentTokens.length}` }],
				nextPageToken,
			});
		}) as unknown as typeof fetch;
		const issues = await loadDevelopmentAllTimeIssues(
			1,
			"global",
			"Done",
			null,
			fieldMapping,
		);
		expect(sentTokens).toEqual([null, "batch-1", "batch-2"]);
		expect(issues.map((issue) => issue.issueKey)).toEqual([
			"ISSUE-1",
			"ISSUE-2",
			"ISSUE-3",
		]);
	});
});
