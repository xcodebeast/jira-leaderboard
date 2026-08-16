import { describe, expect, test } from "bun:test";
import {
	buildJiraSetupSuggestion,
	buildQualityAssuranceSetupSuggestion,
} from "../src/lib/domain/setup";

describe("Jira setup suggestion", () => {
	test("prefers the board estimation field and limits statuses to the board", () => {
		const suggestion = buildJiraSetupSuggestion(
			{ identifier: 42, name: "Example Scrum Board", type: "scrum" },
			{
				boardIdentifier: 42,
				boardName: "Example Scrum Board",
				boardStatusIdentifiers: ["100", "200", "300"],
				doneColumnStatusIdentifiers: ["300"],
				estimationFieldIdentifier: "customfield_10016",
			},
			[
				{ identifier: "customfield_10016", name: "Estimate", custom: true },
				{ identifier: "customfield_20001", name: "Developer", custom: true },
				{ identifier: "customfield_20002", name: "Bounce Count", custom: true },
			],
			[
				{ identifier: "100", name: "Ready for QA" },
				{ identifier: "200", name: "QA" },
				{ identifier: "300", name: "Released" },
				{ identifier: "400", name: "Not on this board" },
			],
		);

		expect(suggestion.fields.storyPointsFieldIdentifier).toBe(
			"customfield_10016",
		);
		expect(suggestion.statuses).toEqual({
			done: "Released",
			qualityAssurance: "QA",
			readyForQualityAssurance: "Ready for QA",
		});
		expect(suggestion.availableStatuses.map((status) => status.name)).toEqual([
			"QA",
			"Ready for QA",
			"Released",
		]);
	});

	test("does not guess organization-specific custom fields", () => {
		const suggestion = buildJiraSetupSuggestion(
			{ identifier: 42, name: "Example Scrum Board", type: "scrum" },
			{
				boardIdentifier: 42,
				boardName: "Example Scrum Board",
				boardStatusIdentifiers: [],
				doneColumnStatusIdentifiers: [],
				estimationFieldIdentifier: null,
			},
			[{ identifier: "summary", name: "Summary", custom: false }],
			[],
		);

		expect(suggestion.fields).toEqual({
			storyPointsFieldIdentifier: "",
			developerFieldIdentifier: "",
			bounceCountFieldIdentifier: "",
		});
	});

	test("selects the project key when Jira finds exactly one board project", () => {
		const suggestion = buildJiraSetupSuggestion(
			{ identifier: 42, name: "Example Scrum Board", type: "scrum" },
			{
				boardIdentifier: 42,
				boardName: "Example Scrum Board",
				boardStatusIdentifiers: [],
				doneColumnStatusIdentifiers: [],
				estimationFieldIdentifier: null,
			},
			[],
			[],
			[{ key: "DEMO", name: "Demo Project" }],
		);

		expect(suggestion.defaultProjectKey).toBe("DEMO");
		expect(suggestion.availableProjects).toEqual([
			{ key: "DEMO", name: "Demo Project" },
		]);
	});

	test("does not arbitrarily select from a multi-project board", () => {
		const suggestion = buildJiraSetupSuggestion(
			{ identifier: 42, name: "Example Scrum Board", type: "scrum" },
			{
				boardIdentifier: 42,
				boardName: "Example Scrum Board",
				boardStatusIdentifiers: [],
				doneColumnStatusIdentifiers: [],
				estimationFieldIdentifier: null,
			},
			[],
			[],
			[
				{ key: "WEB", name: "Web Application" },
				{ key: "API", name: "API Platform" },
			],
		);

		expect(suggestion.defaultProjectKey).toBe("");
		expect(suggestion.availableProjects.map((project) => project.key)).toEqual([
			"API",
			"WEB",
		]);
	});

	test("suggests Tester and configurable QA statuses for any board type", () => {
		const suggestion = buildQualityAssuranceSetupSuggestion(
			{ identifier: 84, name: "Example QA Board", type: "kanban" },
			{
				boardIdentifier: 84,
				boardName: "Example QA Board",
				boardStatusIdentifiers: ["100", "200", "300"],
				doneColumnStatusIdentifiers: ["300"],
				estimationFieldIdentifier: null,
			},
			[
				{
					identifier: "customfield_10016",
					name: "Story Points",
					custom: true,
				},
				{ identifier: "customfield_30001", name: "Tester", custom: true },
			],
			[
				{ identifier: "100", name: "Ready for QA" },
				{ identifier: "200", name: "In QA" },
				{ identifier: "300", name: "Verified" },
			],
		);

		expect(suggestion.fields).toEqual({
			storyPointsFieldIdentifier: "customfield_10016",
			testerFieldIdentifier: "customfield_30001",
		});
		expect(suggestion.statuses).toEqual({
			done: "Verified",
			readyForQualityAssurance: "Ready for QA",
		});
	});
});
