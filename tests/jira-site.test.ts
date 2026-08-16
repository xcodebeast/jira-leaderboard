import { describe, expect, test } from "bun:test";
import { normalizeJiraSiteUrl } from "../src/lib/server/jira-site";

describe("Jira site validation", () => {
	test("normalizes an Atlassian Cloud origin", () => {
		expect(normalizeJiraSiteUrl(" https://example.atlassian.net/ ")).toBe(
			"https://example.atlassian.net",
		);
	});

	test("rejects SSRF targets, credentials, and paths", () => {
		expect(() =>
			normalizeJiraSiteUrl("http://example.atlassian.net"),
		).toThrow();
		expect(() => normalizeJiraSiteUrl("https://localhost")).toThrow();
		expect(() => normalizeJiraSiteUrl("https://atlassian.net")).toThrow();
		expect(() =>
			normalizeJiraSiteUrl("https://token@example.atlassian.net"),
		).toThrow();
		expect(() =>
			normalizeJiraSiteUrl("https://example.atlassian.net/wiki"),
		).toThrow();
	});

	test("supports explicit self-hosted allowlist entries", () => {
		expect(
			normalizeJiraSiteUrl("https://jira.example.com", "jira.example.com"),
		).toBe("https://jira.example.com");
	});
});
