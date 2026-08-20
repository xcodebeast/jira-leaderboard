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

export function loadSession(): Promise<SessionStatus> {
	return requestJson<SessionStatus>("/api/session");
}

export function connectJira(credentials: {
	jiraSiteUrl: string;
	emailAddress: string;
	apiToken: string;
}): Promise<ConnectedSession> {
	return requestJson<ConnectedSession>("/api/session", {
		method: "POST",
		body: credentials,
	});
}

export function disconnectJira(): Promise<DisconnectedSession> {
	return requestJson<DisconnectedSession>("/api/session", { method: "DELETE" });
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
	doneStatus: string,
	year: number | null,
	fieldMapping: JiraFieldMapping,
): Promise<JiraIssue[]> {
	const response = await requestJson<{ issues: JiraIssue[] }>(
		"/api/jira/development-all-time-issues",
		{
			method: "POST",
			body: { boardIdentifier, doneStatus, year, fieldMapping },
		},
	);
	return response.issues;
}

export async function loadQualityAssuranceAllTimeIssues(
	boardIdentifier: number,
	doneStatus: string,
	year: number | null,
	fieldMapping: QualityAssuranceFieldMapping,
): Promise<JiraQualityAssuranceIssue[]> {
	const response = await requestJson<{ issues: JiraQualityAssuranceIssue[] }>(
		"/api/jira/quality-assurance-all-time-issues",
		{
			method: "POST",
			body: { boardIdentifier, doneStatus, year, fieldMapping },
		},
	);
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
	return requestJson("/api/jira/period-issues", {
		method: "POST",
		body: request,
	});
}
