import type { LeaderboardScope } from "../domain/all-time-performance";
import type {
	JiraBoard,
	JiraFieldMapping,
	JiraIssue,
	JiraQualityAssuranceIssue,
	JiraSprintPage,
	JiraSprintState,
	QualityAssuranceFieldMapping,
} from "../domain/jira";
import type { ResolvedDateRange } from "../domain/period-performance";
import type {
	JiraSetupSuggestion,
	QualityAssuranceSetupSuggestion,
} from "../domain/setup";
import { clearLeaderboardCache } from "./leaderboard-cache";

export interface ConnectedSession {
	connected: true;
	jiraSiteUrl: string;
	emailAddress: string;
	authenticationMode: "classic" | "scoped";
	currentUser?: {
		accountIdentifier: string | null;
		displayName: string;
		emailAddress: string | null;
	};
}

export interface DisconnectedSession {
	connected: false;
}

export type SessionStatus = ConnectedSession | DisconnectedSession;

interface RequestOptions {
	method?: "GET" | "POST" | "DELETE";
	body?: unknown;
}

export class BrowserApiError extends Error {
	readonly statusCode: number;

	constructor(statusCode: number, message: string) {
		super(message);
		this.name = "BrowserApiError";
		this.statusCode = statusCode;
	}
}

async function requestJson<ResponseData>(
	pathname: string,
	options: RequestOptions = {},
): Promise<ResponseData> {
	const headers = new Headers();
	if (options.body !== undefined) {
		headers.set("Content-Type", "application/json");
	}
	const response = await fetch(pathname, {
		method: options.method ?? "GET",
		headers,
		body: options.body === undefined ? undefined : JSON.stringify(options.body),
		credentials: "same-origin",
	});
	const payload = (await response.json().catch(() => null)) as Record<
		string,
		unknown
	> | null;
	if (!response.ok) {
		throw new BrowserApiError(
			response.status,
			typeof payload?.message === "string"
				? payload.message
				: "The request could not be completed.",
		);
	}

	return payload as ResponseData;
}

/** API requests one paged result may take; each covers up to 500 Jira issues. */
const MAXIMUM_ISSUE_BATCHES = 1_000;

interface IssueBatchResponse<Issue> {
	issues: Issue[];
	nextPageToken: string | null;
}

/**
 * Posts to a paged issue endpoint until it has every issue. The server reads a bounded
 * number of Jira pages per request and returns a `nextPageToken` to continue from.
 */
async function requestAllIssues<
	Issue,
	Response extends IssueBatchResponse<Issue>,
>(pathname: string, body: Record<string, unknown>): Promise<Response> {
	let response = await requestJson<Response>(pathname, {
		method: "POST",
		body,
	});
	const issues = [...response.issues];
	for (let batch = 1; response.nextPageToken; batch += 1) {
		if (batch >= MAXIMUM_ISSUE_BATCHES) {
			throw new BrowserApiError(502, "Jira returned too many result pages.");
		}
		response = await requestJson<Response>(pathname, {
			method: "POST",
			body: { ...body, pageToken: response.nextPageToken },
		});
		issues.push(...response.issues);
	}

	return { ...response, issues };
}

export async function loadSession(): Promise<SessionStatus> {
	const session = await requestJson<SessionStatus>("/api/session");
	if (!session.connected) clearLeaderboardCache();
	return session;
}

export async function connectJira(credentials: {
	jiraSiteUrl: string;
	emailAddress: string;
	apiToken: string;
}): Promise<ConnectedSession> {
	const session = await requestJson<ConnectedSession>("/api/session", {
		method: "POST",
		body: credentials,
	});
	clearLeaderboardCache();
	return session;
}

export async function disconnectJira(): Promise<DisconnectedSession> {
	try {
		return await requestJson<DisconnectedSession>("/api/session", {
			method: "DELETE",
		});
	} finally {
		clearLeaderboardCache();
	}
}

export async function loadBoards(
	boardType: "scrum" | "all" = "scrum",
): Promise<JiraBoard[]> {
	const searchParameters = new URLSearchParams({ boardType });
	const response = await requestJson<{ boards: JiraBoard[] }>(
		`/api/jira/boards?${searchParameters}`,
	);
	return response.boards;
}

export async function loadDevelopmentSetupSuggestion(
	boardIdentifier: number,
	preferredFieldIdentifiers: string[] = [],
): Promise<JiraSetupSuggestion> {
	const searchParameters = new URLSearchParams({
		boardIdentifier: String(boardIdentifier),
		mode: "development",
	});
	for (const fieldIdentifier of preferredFieldIdentifiers) {
		searchParameters.append("preferredFieldIdentifier", fieldIdentifier);
	}
	const response = await requestJson<{ suggestion: JiraSetupSuggestion }>(
		`/api/jira/setup?${searchParameters}`,
	);
	return response.suggestion;
}

export async function loadQualityAssuranceSetupSuggestion(
	boardIdentifier: number,
	preferredFieldIdentifiers: string[] = [],
): Promise<QualityAssuranceSetupSuggestion> {
	const searchParameters = new URLSearchParams({
		boardIdentifier: String(boardIdentifier),
		mode: "qualityAssurance",
	});
	for (const fieldIdentifier of preferredFieldIdentifiers) {
		searchParameters.append("preferredFieldIdentifier", fieldIdentifier);
	}
	const response = await requestJson<{
		suggestion: QualityAssuranceSetupSuggestion;
	}>(`/api/jira/setup?${searchParameters}`);
	return response.suggestion;
}

export function loadSprintPage(
	boardIdentifier: number,
	state: JiraSprintState,
	startAt: number,
	maxResults: number,
): Promise<JiraSprintPage> {
	const searchParameters = new URLSearchParams({
		boardIdentifier: String(boardIdentifier),
		state,
		startAt: String(startAt),
		maxResults: String(maxResults),
	});
	return requestJson<JiraSprintPage>(`/api/jira/sprints?${searchParameters}`);
}

export async function loadSprintIssues(
	sprintIdentifier: number,
	fieldMapping: JiraFieldMapping,
): Promise<JiraIssue[]> {
	const response = await requestJson<{ issues: JiraIssue[] }>(
		"/api/jira/sprint-issues",
		{
			method: "POST",
			body: { sprintIdentifier, fieldMapping },
		},
	);
	return response.issues;
}

export async function loadQualityAssuranceSprintIssues(
	boardIdentifier: number,
	sprintIdentifier: number,
	fieldMapping: QualityAssuranceFieldMapping,
): Promise<JiraQualityAssuranceIssue[]> {
	const response = await requestJson<{
		issues: JiraQualityAssuranceIssue[];
	}>("/api/jira/quality-assurance-sprint-issues", {
		method: "POST",
		body: { boardIdentifier, sprintIdentifier, fieldMapping },
	});
	return response.issues;
}

export async function loadDevelopmentAllTimeIssues(
	boardIdentifier: number,
	scope: LeaderboardScope,
	doneStatus: string,
	year: number | null,
	fieldMapping: JiraFieldMapping,
	contributorAccountIdentifier: string | null = null,
): Promise<JiraIssue[]> {
	const response = await requestAllIssues<
		JiraIssue,
		IssueBatchResponse<JiraIssue>
	>("/api/jira/development-all-time-issues", {
		boardIdentifier,
		scope,
		doneStatus,
		year,
		fieldMapping,
		contributorAccountIdentifier,
	});
	return response.issues;
}

export async function loadQualityAssuranceAllTimeIssues(
	boardIdentifier: number,
	scope: LeaderboardScope,
	doneStatus: string,
	year: number | null,
	fieldMapping: QualityAssuranceFieldMapping,
	contributorAccountIdentifier: string | null = null,
): Promise<JiraQualityAssuranceIssue[]> {
	const response = await requestAllIssues<
		JiraQualityAssuranceIssue,
		IssueBatchResponse<JiraQualityAssuranceIssue>
	>("/api/jira/quality-assurance-all-time-issues", {
		boardIdentifier,
		scope,
		doneStatus,
		year,
		fieldMapping,
		contributorAccountIdentifier,
	});
	return response.issues;
}

interface PeriodIssueRequest {
	startDate: string;
	endDate: string;
	projectKey?: string;
	scopeQuery?: string;
	fieldMapping: JiraFieldMapping;
}

export async function loadPeriodIssues(request: PeriodIssueRequest): Promise<{
	issues: JiraIssue[];
	range: ResolvedDateRange;
}> {
	const response = await requestAllIssues<
		JiraIssue,
		IssueBatchResponse<JiraIssue> & { range: ResolvedDateRange }
	>("/api/jira/period-issues", { ...request });
	return { issues: response.issues, range: response.range };
}
