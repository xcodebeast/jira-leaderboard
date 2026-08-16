import { describe, expect, test } from "bun:test";
import {
	createNextClosedSprintPageRequest,
	selectRecentClosedSprintPage,
} from "../src/lib/browser/sprint-history";
import type { JiraSprintPage } from "../src/lib/domain/jira";

function createSprintPage(
	startAt: number,
	identifiers: number[],
	datePrefix: string,
	total: number,
): JiraSprintPage {
	return {
		sprints: identifiers.map((identifier, index) => ({
			identifier,
			name: `Sprint ${identifier}`,
			state: "closed",
			startDate: `${datePrefix}-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
			endDate: null,
			completeDate: null,
		})),
		startAt,
		maxResults: 25,
		total,
		isLast: startAt + identifiers.length >= total,
		nextStartAt:
			startAt + identifiers.length >= total
				? null
				: startAt + identifiers.length,
	};
}

describe("sprint history pagination", () => {
	test("chooses the edge containing the most recent closed sprints", () => {
		const firstPage = createSprintPage(0, [1, 2], "2025-01", 52);
		const lastPage = createSprintPage(27, [51, 52], "2026-08", 52);

		expect(selectRecentClosedSprintPage(firstPage, lastPage)).toEqual({
			page: lastPage,
			direction: "lowerOffsets",
		});
	});

	test("paginates backward without overlapping the final partial page", () => {
		const lastPage = createSprintPage(38, [39, 40], "2026-08", 63);
		const middleRequest = createNextClosedSprintPageRequest(
			lastPage,
			"lowerOffsets",
		);
		expect(middleRequest).toEqual({
			startAt: 13,
			maxResults: 25,
			direction: "lowerOffsets",
		});

		const middlePage = createSprintPage(13, [14, 15], "2026-01", 63);
		expect(
			createNextClosedSprintPageRequest(middlePage, "lowerOffsets"),
		).toEqual({
			startAt: 0,
			maxResults: 13,
			direction: "lowerOffsets",
		});
	});
});
