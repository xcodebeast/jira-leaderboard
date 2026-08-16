import { expect, test } from "bun:test";
import { mergeJiraSprints } from "../src/lib/domain/jira";
import {
	buildProjectScopeQuery,
	createResolvedDateRange,
} from "../src/lib/domain/period-performance";
import { buildJiraSetupSuggestion } from "../src/lib/domain/setup";
import {
	connectJiraCredentials,
	createPendingJiraCredentials,
} from "../src/lib/server/jira-authentication";
import { JiraClient } from "../src/lib/server/jira-client";
import { normalizeJiraSiteUrl } from "../src/lib/server/jira-site";

const liveTest = process.env.JIRA_LIVE_TESTS === "1" ? test : test.skip;

function requiredEnvironmentValue(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} is required when JIRA_LIVE_TESTS=1.`);
	}

	return value;
}

function utcDateWithOffset(dayOffset: number): string {
	const date = new Date();
	date.setUTCDate(date.getUTCDate() + dayOffset);
	return date.toISOString().slice(0, 10);
}

liveTest(
	"runs the real read-only Jira workflow",
	async () => {
		const pendingCredentials = createPendingJiraCredentials({
			jiraSiteUrl: normalizeJiraSiteUrl(requiredEnvironmentValue("JIRA_URL")),
			emailAddress: requiredEnvironmentValue("JIRA_EMAIL"),
			apiToken: requiredEnvironmentValue("JIRA_API_TOKEN"),
			issuedAt: new Date().toISOString(),
		});
		const boardIdentifier = Number(requiredEnvironmentValue("JIRA_BOARD_ID"));
		const projectKey = requiredEnvironmentValue("JIRA_PROJECT_KEY");
		if (!Number.isSafeInteger(boardIdentifier) || boardIdentifier <= 0) {
			throw new Error("JIRA_BOARD_ID must be a positive integer.");
		}
		const { credentials } = await connectJiraCredentials(pendingCredentials);
		const client = new JiraClient(credentials);

		const boards = await client.allScrumBoards();
		const board = boards.find(
			(candidate) => candidate.identifier === boardIdentifier,
		);
		expect(board).toBeDefined();
		if (!board) {
			throw new Error(
				`Board ${boardIdentifier} is not available to the live test account.`,
			);
		}

		const [
			configuration,
			fields,
			statuses,
			boardProjects,
			activeSprintPage,
			closedSprintPage,
		] = await Promise.all([
			client.boardConfiguration(boardIdentifier),
			client.fields(),
			client.statuses(),
			client.boardProjects(boardIdentifier),
			client.sprintPage(boardIdentifier, "active", 0, 10),
			client.sprintPage(boardIdentifier, "closed", 0, 10),
		]);
		const suggestion = buildJiraSetupSuggestion(
			board,
			configuration,
			fields,
			statuses,
			boardProjects,
		);
		expect(suggestion.availableFields.length).toBeGreaterThan(0);
		expect(Array.isArray(suggestion.availableProjects)).toBe(true);
		expect(suggestion.availableStatuses.length).toBeGreaterThan(0);

		const sprints = mergeJiraSprints(
			activeSprintPage.sprints,
			closedSprintPage.sprints,
		);
		if (sprints[0]) {
			const sprintIssues = await client.sprintIssues(
				sprints[0].identifier,
				suggestion.fields,
			);
			expect(Array.isArray(sprintIssues)).toBe(true);
		}

		const range = createResolvedDateRange(
			utcDateWithOffset(-6),
			utcDateWithOffset(0),
		);
		const resolvedIssues = await client.resolvedIssues(
			buildProjectScopeQuery(projectKey),
			range,
			suggestion.fields,
		);
		expect(Array.isArray(resolvedIssues)).toBe(true);
	},
	120_000,
);
