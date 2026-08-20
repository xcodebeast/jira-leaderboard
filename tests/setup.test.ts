import { describe, expect, test } from "bun:test";
import {
	buildJiraSetupSuggestion,
	buildQualityAssuranceSetupSuggestion,
} from "../src/lib/domain/setup";

describe("Jira setup suggestion", () => {
	test("prefers board suggestions while exposing every Jira status", () => {
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
				{ identifier: "401", name: "Not on this board" },
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
			"Not on this board",
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

	test("deduplicates field labels while preserving the suggested identifiers", () => {
		const suggestion = buildJiraSetupSuggestion(
			{ identifier: 42, name: "Example Scrum Board", type: "scrum" },
			{
				boardIdentifier: 42,
				boardName: "Example Scrum Board",
				boardStatusIdentifiers: [],
				doneColumnStatusIdentifiers: [],
				estimationFieldIdentifier: "customfield_story_current",
			},
			[
				{
					identifier: "customfield_story_legacy",
					name: "story points",
					custom: true,
				},
				{
					identifier: "customfield_story_current",
					name: "Story Points",
					custom: true,
				},
				{
					identifier: "customfield_developer_selected",
					name: "Developer",
					custom: true,
				},
				{
					identifier: "customfield_developer_duplicate",
					name: "Developer",
					custom: true,
				},
				{
					identifier: "customfield_bounce_count",
					name: "Bounce Count",
					custom: true,
				},
			],
			[],
		);

		expect(suggestion.fields).toEqual({
			storyPointsFieldIdentifier: "customfield_story_current",
			developerFieldIdentifier: "customfield_developer_selected",
			bounceCountFieldIdentifier: "customfield_bounce_count",
		});
		expect(suggestion.availableFields).toEqual([
			{
				identifier: "customfield_bounce_count",
				name: "Bounce Count",
				custom: true,
			},
			{
				identifier: "customfield_developer_selected",
				name: "Developer",
				custom: true,
			},
			{
				identifier: "customfield_story_current",
				name: "Story Points",
				custom: true,
			},
		]);
	});

	test("keeps saved duplicate field identifiers available while editing", () => {
		const board = { identifier: 42, name: "Example Board", type: "scrum" };
		const boardConfiguration = {
			boardIdentifier: 42,
			boardName: "Example Board",
			boardStatusIdentifiers: [],
			doneColumnStatusIdentifiers: [],
			estimationFieldIdentifier: "customfield_story_current",
		};
		const fields = [
			{
				identifier: "customfield_story_legacy",
				name: "Story Points",
				custom: true,
			},
			{
				identifier: "customfield_story_current",
				name: "Story Points",
				custom: true,
			},
			{
				identifier: "customfield_tester_legacy",
				name: "Tester",
				custom: true,
			},
			{
				identifier: "customfield_tester_current",
				name: "Tester",
				custom: true,
			},
		];

		const developmentSuggestion = buildJiraSetupSuggestion(
			board,
			boardConfiguration,
			fields,
			[],
			[],
			["customfield_story_legacy"],
		);
		const qualityAssuranceSuggestion = buildQualityAssuranceSetupSuggestion(
			board,
			boardConfiguration,
			fields,
			[],
			["customfield_tester_legacy"],
		);

		expect(
			developmentSuggestion.availableFields.find(
				(field) => field.name === "Story Points",
			)?.identifier,
		).toBe("customfield_story_legacy");
		expect(
			qualityAssuranceSuggestion.availableFields.find(
				(field) => field.name === "Tester",
			)?.identifier,
		).toBe("customfield_tester_legacy");
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
				estimationFieldIdentifier: "customfield_10016",
			},
			[
				{
					identifier: "customfield_10015",
					name: "story points",
					custom: true,
				},
				{
					identifier: "customfield_10016",
					name: "Story Points",
					custom: true,
				},
				{ identifier: "customfield_30001", name: "Tester", custom: true },
				{ identifier: "customfield_30002", name: "Tester", custom: true },
			],
			[
				{ identifier: "100", name: "Ready for QA" },
				{ identifier: "200", name: "In QA" },
				{ identifier: "300", name: "Verified" },
				{ identifier: "400", name: "Done" },
				{ identifier: "401", name: "Done" },
				{ identifier: "500", name: "Not on the QA board" },
			],
		);

		expect(suggestion.fields).toEqual({
			storyPointsFieldIdentifier: "customfield_10016",
			testerFieldIdentifier: "customfield_30001",
		});
		expect(suggestion.availableFields).toEqual([
			{
				identifier: "customfield_10016",
				name: "Story Points",
				custom: true,
			},
			{ identifier: "customfield_30001", name: "Tester", custom: true },
		]);
		expect(suggestion.statuses).toEqual({
			done: "Verified",
			readyForQualityAssurance: "Ready for QA",
		});
		expect(suggestion.availableStatuses.map((status) => status.name)).toEqual([
			"Done",
			"In QA",
			"Not on the QA board",
			"Ready for QA",
			"Verified",
		]);
	});
});
