import { describe, expect, test } from "bun:test";
import {
	defaultStatusMapping,
	findPreviousClosedSprint,
	type JiraIssue,
	type JiraSprint,
	mergeJiraSprints,
	unassignedDeveloperName,
} from "../src/lib/domain/jira";
import {
	compareSprintSummaries,
	type DeveloperSprintSummary,
	projectedSprintPoints,
	sprintTicketDisplay,
	summarizeSprintIssues,
} from "../src/lib/domain/sprint-performance";

function createIssue(overrides: Partial<JiraIssue>): JiraIssue {
	return {
		issueKey: "DEMO-1",
		summary: "",
		statusName: "Done",
		resolutionDate: null,
		storyPoints: null,
		developer: unassignedDeveloperName,
		bounceCount: 0,
		...overrides,
	};
}

function createSprintSummary(
	developer: string,
	donePoints: number,
	qualityAssurancePoints: number,
	readyPoints: number,
	bounceCount: number,
): DeveloperSprintSummary {
	return {
		developer,
		donePoints,
		qualityAssurancePoints,
		readyForQualityAssurancePoints: readyPoints,
		bounceCount,
		tickets: [],
	};
}

describe("sprint performance", () => {
	test("summarizes completed and upcoming points from the Developer field", () => {
		const summaries = summarizeSprintIssues(
			[
				createIssue({
					issueKey: "DEMO-1",
					storyPoints: 8,
					developer: "Alex",
					bounceCount: 1,
				}),
				createIssue({
					issueKey: "DEMO-2",
					statusName: "QA",
					storyPoints: 2,
					developer: "Alex",
					bounceCount: 3,
				}),
				createIssue({
					issueKey: "DEMO-3",
					statusName: "Ready for QA",
					storyPoints: 4,
					developer: "Alex",
					bounceCount: 2,
				}),
				createIssue({
					issueKey: "DEMO-4",
					storyPoints: 8,
					developer: "Bailey",
				}),
				createIssue({
					issueKey: "DEMO-5",
					statusName: "In Progress",
					storyPoints: 13,
					developer: "Alex",
					bounceCount: 99,
				}),
			],
			defaultStatusMapping,
		);

		expect(summaries).toHaveLength(2);
		expect(summaries[0]).toMatchObject({
			developer: "Alex",
			donePoints: 8,
			qualityAssurancePoints: 2,
			readyForQualityAssurancePoints: 4,
			bounceCount: 6,
		});
		expect(projectedSprintPoints(summaries[0])).toBe(14);
		expect(summaries[0].tickets.map(sprintTicketDisplay).join(", ")).toBe(
			"DEMO-1 (Done), DEMO-2 (QA), DEMO-3 (Ready for QA)",
		);
		expect(summaries[1]).toMatchObject({
			developer: "Bailey",
			donePoints: 8,
			bounceCount: 0,
		});
	});

	test("keeps unassigned work visible", () => {
		const summaries = summarizeSprintIssues(
			[createIssue({ issueKey: "DEMO-6" })],
			defaultStatusMapping,
		);

		expect(summaries).toEqual([
			{
				developer: unassignedDeveloperName,
				donePoints: 0,
				qualityAssurancePoints: 0,
				readyForQualityAssurancePoints: 0,
				bounceCount: 0,
				tickets: [{ issueKey: "DEMO-6", summary: "", status: "Done" }],
			},
		]);
	});

	test("compares current and previous sprint values", () => {
		const comparisons = compareSprintSummaries(
			[
				createSprintSummary("Alex", 8, 2, 4, 6),
				createSprintSummary("Bailey", 8, 0, 0, 0),
			],
			[
				createSprintSummary("Alex", 5, 1, 0, 2),
				createSprintSummary("Casey", 3, 0, 2, 1),
			],
		);

		expect(comparisons).toEqual([
			{
				developer: "Bailey",
				donePointsDelta: 8,
				qualityAssurancePointsDelta: 0,
				readyForQualityAssurancePointsDelta: 0,
				projectedPointsDelta: 8,
				bounceCountDelta: 0,
			},
			{
				developer: "Alex",
				donePointsDelta: 3,
				qualityAssurancePointsDelta: 1,
				readyForQualityAssurancePointsDelta: 4,
				projectedPointsDelta: 8,
				bounceCountDelta: 4,
			},
			{
				developer: "Casey",
				donePointsDelta: -3,
				qualityAssurancePointsDelta: 0,
				readyForQualityAssurancePointsDelta: -2,
				projectedPointsDelta: -5,
				bounceCountDelta: -1,
			},
		]);
	});

	test("selects the latest closed sprint before the current sprint", () => {
		const currentSprint: JiraSprint = {
			identifier: 300,
			name: "Sprint 30",
			state: "active",
			startDate: "2026-08-01T00:00:00.000Z",
			endDate: "2026-08-14T00:00:00.000Z",
			completeDate: null,
		};
		const previousSprint: JiraSprint = {
			...currentSprint,
			identifier: 299,
			name: "Sprint 29",
			state: "closed",
			endDate: "2026-07-31T00:00:00.000Z",
			completeDate: "2026-07-31T12:00:00.000Z",
		};
		const olderSprint: JiraSprint = {
			...previousSprint,
			identifier: 298,
			name: "Sprint 28",
			completeDate: "2026-07-17T12:00:00.000Z",
		};

		expect(
			findPreviousClosedSprint(currentSprint, [olderSprint, previousSprint]),
		).toEqual(previousSprint);
	});

	test("merges paginated sprint results without duplicates", () => {
		const sharedSprint: JiraSprint = {
			identifier: 400,
			name: "Sprint 40",
			state: "closed",
			startDate: "2026-08-01T00:00:00.000Z",
			endDate: "2026-08-14T00:00:00.000Z",
			completeDate: "2026-08-14T12:00:00.000Z",
		};
		const activeSprint: JiraSprint = {
			...sharedSprint,
			identifier: 401,
			name: "Sprint 41",
			state: "active",
			completeDate: null,
		};

		expect(
			mergeJiraSprints([sharedSprint], [activeSprint, sharedSprint]).map(
				(sprint) => sprint.identifier,
			),
		).toEqual([401, 400]);
	});
});
