import { describe, expect, test } from "bun:test";
import {
	isShareSnapshotPath,
	originMatchesRequestHost,
} from "../src/lib/server/request-security";

describe("request origin validation", () => {
	test("accepts a same-host browser origin", () => {
		expect(
			originMatchesRequestHost(
				"https://leaderboard.example.com",
				"leaderboard.example.com",
			),
		).toBe(true);
		expect(
			originMatchesRequestHost("http://127.0.0.1:4173", "127.0.0.1:4173"),
		).toBe(true);
	});

	test("rejects cross-origin, malformed, and hostless requests", () => {
		expect(
			originMatchesRequestHost(
				"https://attacker.example",
				"leaderboard.example.com",
			),
		).toBe(false);
		expect(originMatchesRequestHost("null", "leaderboard.example.com")).toBe(
			false,
		);
		expect(
			originMatchesRequestHost("https://leaderboard.example.com", null),
		).toBe(false);
	});
});

describe("share snapshot path detection", () => {
	test("accepts only the share route with an optional trailing slash", () => {
		expect(isShareSnapshotPath("/share")).toBe(true);
		expect(isShareSnapshotPath("/share/")).toBe(true);
		expect(isShareSnapshotPath("/share/example")).toBe(false);
		expect(isShareSnapshotPath("/shared")).toBe(false);
		expect(isShareSnapshotPath("/")).toBe(false);
	});
});
