import { describe, expect, test } from "bun:test";
import {
	boardIssuePageRequest,
	qualityAssuranceBoardIssuePageRequest,
} from "../src/lib/server/jira-client";

describe("Jira quality assurance issue request", () => {
	test("filters a QA board by a sprint owned by another board", () => {
		const pageRequest = qualityAssuranceBoardIssuePageRequest(
			84,
			374,
			["status", "summary", "customfield_10016", "customfield_30001"],
			"next-page-token",
		);

		expect(pageRequest.pathname).toBe("/rest/software/1.0/board/84/issue");
		expect(pageRequest.pathname).not.toContain("/sprint/");
		expect(pageRequest.query.get("jql")).toBe("sprint = 374");
		expect(pageRequest.query.get("maxResults")).toBe("100");
		expect(pageRequest.query.get("fields")).toBe(
			"status,summary,customfield_10016,customfield_30001",
		);
		expect(pageRequest.query.get("nextPageToken")).toBe("next-page-token");
	});

	test("omits the pagination token from the first page", () => {
		const pageRequest = qualityAssuranceBoardIssuePageRequest(
			84,
			374,
			["summary"],
			null,
		);

		expect(pageRequest.query.has("nextPageToken")).toBe(false);
	});

	test("supports a board-scoped all-time query", () => {
		const pageRequest = boardIssuePageRequest(
			84,
			["summary", "status", "customfield_10016"],
			'status = "Done"',
			null,
		);

		expect(pageRequest.pathname).toBe("/rest/software/1.0/board/84/issue");
		expect(pageRequest.query.get("jql")).toBe('status = "Done"');
		expect(pageRequest.query.get("fields")).toBe(
			"summary,status,customfield_10016",
		);
	});
});
