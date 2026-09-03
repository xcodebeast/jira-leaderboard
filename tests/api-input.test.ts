import { describe, expect, test } from "bun:test";
import {
	leaderboardScope,
	optionalCalendarYear,
} from "../src/lib/server/client-input";

describe("API input validation", () => {
	test("defaults leaderboard scope to the configured board", () => {
		expect(leaderboardScope({}, "scope")).toBe("board");
		expect(leaderboardScope({ scope: "board" }, "scope")).toBe("board");
		expect(leaderboardScope({ scope: "global" }, "scope")).toBe("global");
	});

	test("rejects an unknown leaderboard scope", () => {
		expect(() => leaderboardScope({ scope: "project" }, "scope")).toThrow(
			"Select a valid leaderboard scope.",
		);
	});

	test("defaults a missing leaderboard year to the current year", () => {
		expect(optionalCalendarYear({}, "year", "leaderboard year")).toBe(
			new Date().getUTCFullYear(),
		);
	});

	test("accepts a calendar year or the all-time null value", () => {
		expect(
			optionalCalendarYear({ year: 2024 }, "year", "leaderboard year"),
		).toBe(2024);
		expect(
			optionalCalendarYear({ year: null }, "year", "leaderboard year"),
		).toBeNull();
	});

	test("rejects malformed and out-of-range years", () => {
		for (const year of ["2026", 1999, 9999, 2026.5]) {
			expect(() =>
				optionalCalendarYear({ year }, "year", "leaderboard year"),
			).toThrow("Select a valid leaderboard year or all time.");
		}
	});
});
