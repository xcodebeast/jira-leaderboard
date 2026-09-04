import { describe, expect, test } from "bun:test";
import type { JiraQualityAssuranceIssue } from "../src/lib/domain/jira";
import {
	qualityAssuranceTicketDisplay,
	summarizeQualityAssuranceSprintIssues,
} from "../src/lib/domain/quality-assurance-performance";

function createQualityAssuranceIssue(
	overrides: Partial<JiraQualityAssuranceIssue>,
): JiraQualityAssuranceIssue {
	return {
		issueKey: "DEMO-1",
		summary: "",
		statusName: "Done",
		storyPoints: null,
		tester: "Unassigned Tester",
		...overrides,
	};
}

describe("quality assurance performance", () => {
	test("counts both story points and tickets for each configured status", () => {
		const summaries = summarizeQualityAssuranceSprintIssues(
			[
				createQualityAssuranceIssue({
					issueKey: "DEMO-1",
					storyPoints: 8,
					tester: "Alex",
				}),
				createQualityAssuranceIssue({
					issueKey: "DEMO-2",
					storyPoints: null,
					tester: "Alex",
				}),
				createQualityAssuranceIssue({
					issueKey: "DEMO-3",
					statusName: "Ready for QA",
					storyPoints: 5,
					tester: "Alex",
				}),
				createQualityAssuranceIssue({
					issueKey: "DEMO-4",
					statusName: "In QA",
					storyPoints: 13,
					tester: "Alex",
				}),
			],
			{ done: "Done", readyForQualityAssurance: "Ready for QA" },
		);

		expect(summaries).toHaveLength(1);
		expect(summaries[0]).toMatchObject({
			tester: "Alex",
			doneStoryPoints: 8,
			doneTicketCount: 2,
			readyForQualityAssuranceStoryPoints: 5,
			readyForQualityAssuranceTicketCount: 1,
		});
		expect(summaries[0].tickets.map(qualityAssuranceTicketDisplay)).toEqual([
			"DEMO-1 (Done)",
			"DEMO-2 (Done)",
			"DEMO-3 (Ready for QA)",
		]);
	});

	test("ranks by done points and then done ticket count", () => {
		const summaries = summarizeQualityAssuranceSprintIssues(
			[
				createQualityAssuranceIssue({ storyPoints: 5, tester: "Casey" }),
				createQualityAssuranceIssue({ storyPoints: 5, tester: "Bailey" }),
				createQualityAssuranceIssue({
					issueKey: "DEMO-2",
					storyPoints: 0,
					tester: "Bailey",
				}),
			],
			{ done: "Done", readyForQualityAssurance: "Ready for QA" },
		);

		expect(summaries.map((summary) => summary.tester)).toEqual([
			"Bailey",
			"Casey",
		]);
	});

	test("keeps same-name Jira accounts separate in QA standings", () => {
		const summaries = summarizeQualityAssuranceSprintIssues(
			[
				createQualityAssuranceIssue({
					storyPoints: 5,
					tester: "Casey",
					testerAccountIdentifier: "account-one",
				}),
				createQualityAssuranceIssue({
					issueKey: "DEMO-2",
					storyPoints: 3,
					tester: "Casey",
					testerAccountIdentifier: "account-two",
				}),
			],
			{ done: "Done", readyForQualityAssurance: "Ready for QA" },
		);

		expect(summaries).toHaveLength(2);
		expect(
			summaries.map((summary) => summary.testerAccountIdentifier).sort(),
		).toEqual(["account-one", "account-two"]);
	});

	test("keeps unassigned tester work visible in sprint performance", () => {
		const summaries = summarizeQualityAssuranceSprintIssues(
			[createQualityAssuranceIssue({ storyPoints: 3 })],
			{ done: "Done", readyForQualityAssurance: "Ready for QA" },
		);

		expect(summaries).toHaveLength(1);
		expect(summaries[0]).toMatchObject({
			tester: "Unassigned Tester",
			doneStoryPoints: 3,
			doneTicketCount: 1,
		});
	});
});
