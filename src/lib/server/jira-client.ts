import type {
	JiraBoard,
	JiraField,
	JiraFieldMapping,
	JiraIssue,
	JiraProject,
	JiraQualityAssuranceIssue,
	JiraSprint,
	JiraSprintPage,
	JiraSprintState,
	JiraStatus,
	QualityAssuranceFieldMapping,
} from "../domain/jira";
import {
	sortJiraSprints,
	unassignedDeveloperName,
	unassignedTesterName,
} from "../domain/jira";
import type { ResolvedDateRange } from "../domain/period-performance";
import { buildResolvedIssuesQuery } from "../domain/period-performance";
import type { JiraBoardConfiguration } from "../domain/setup";
import type { JiraCredentials } from "./credential-vault";
import { jiraApiRequestUrl } from "./jira-api-url";

type JsonObject = Record<string, unknown>;

interface JiraRequestOptions {
	method?: "GET" | "POST";
	query?: URLSearchParams;
	body?: JsonObject;
}

export interface JiraCurrentUser {
	accountIdentifier: string | null;
	displayName: string;
	emailAddress: string | null;
}

function objectValue(value: unknown): JsonObject | null {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as JsonObject)
		: null;
}

function arrayValue(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

function numberValue(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === "string" && value.trim()) {
		const parsedValue = Number(value);
		return Number.isFinite(parsedValue) ? parsedValue : null;
	}

	return null;
}

function booleanValue(value: unknown): boolean | null {
	return typeof value === "boolean" ? value : null;
}

function requiredObject(value: unknown, description: string): JsonObject {
	const parsedObject = objectValue(value);
	if (!parsedObject) {
		throw new JiraRequestError(502, `Jira returned an invalid ${description}.`);
	}

	return parsedObject;
}

function errorMessageFromPayload(value: unknown): string | null {
	const payload = objectValue(value);
	if (!payload) {
		return null;
	}

	const messages = arrayValue(payload.errorMessages).filter(
		(message): message is string => typeof message === "string",
	);
	const errors = objectValue(payload.errors);
	if (errors) {
		messages.push(
			...Object.values(errors).filter(
				(message): message is string => typeof message === "string",
			),
		);
	}

	return messages.length > 0 ? messages.join(" ") : null;
}

function responseContentType(response: Response): string {
	return response.headers.get("Content-Type")?.toLocaleLowerCase() ?? "";
}

function isJsonResponse(response: Response): boolean {
	const contentType = responseContentType(response);
	return (
		contentType.includes("application/json") || contentType.includes("+json")
	);
}

function safeTextErrorMessage(responseText: string): string | null {
	const normalizedText = responseText.replace(/\s+/g, " ").trim();
	if (
		!normalizedText ||
		normalizedText.startsWith("<") ||
		normalizedText.toLocaleLowerCase().includes("<html")
	) {
		return null;
	}

	return normalizedText.slice(0, 500);
}

function parseJiraBoard(value: unknown): JiraBoard {
	const board = requiredObject(value, "board");
	const identifier = numberValue(board.id);
	const name = stringValue(board.name);
	if (!identifier || !name) {
		throw new JiraRequestError(
			502,
			"Jira returned a board without an identifier or name.",
		);
	}

	return { identifier, name, type: stringValue(board.type) ?? "scrum" };
}

function parseJiraField(value: unknown): JiraField {
	const field = requiredObject(value, "field");
	const identifier = stringValue(field.id);
	const name = stringValue(field.name);
	if (!identifier || !name) {
		throw new JiraRequestError(
			502,
			"Jira returned a field without an identifier or name.",
		);
	}

	return { identifier, name, custom: booleanValue(field.custom) };
}

function parseJiraProject(value: unknown): JiraProject {
	const project = requiredObject(value, "project");
	const key = stringValue(project.key);
	const name = stringValue(project.name);
	if (!key || !name) {
		throw new JiraRequestError(
			502,
			"Jira returned a project without a key or name.",
		);
	}

	return { key, name };
}

function parseJiraStatus(value: unknown): JiraStatus {
	const status = requiredObject(value, "status");
	const identifier = stringValue(status.id);
	const name = stringValue(status.name);
	if (!identifier || !name) {
		throw new JiraRequestError(
			502,
			"Jira returned a status without an identifier or name.",
		);
	}

	return { identifier, name };
}

function parseJiraSprint(value: unknown): JiraSprint {
	const sprint = requiredObject(value, "sprint");
	const identifier = numberValue(sprint.id);
	const name = stringValue(sprint.name);
	const state = stringValue(sprint.state);
	if (!identifier || !name || !state) {
		throw new JiraRequestError(502, "Jira returned an incomplete sprint.");
	}

	return {
		identifier,
		name,
		state,
		startDate: stringValue(sprint.startDate),
		endDate: stringValue(sprint.endDate),
		completeDate: stringValue(sprint.completeDate),
	};
}

function preferredContributorName(value: unknown): string {
	if (typeof value === "string") {
		return value.trim();
	}

	const contributor = objectValue(value);
	if (!contributor) {
		return "";
	}

	for (const propertyName of ["displayName", "name", "emailAddress", "value"]) {
		const candidate = stringValue(contributor[propertyName])?.trim();
		if (candidate) {
			return candidate;
		}
	}

	return "";
}

function parseContributors(value: unknown, unassignedName: string): string {
	const contributorNames = Array.isArray(value)
		? value.map(preferredContributorName).filter(Boolean)
		: [preferredContributorName(value)].filter(Boolean);
	return contributorNames.length > 0
		? contributorNames.join(", ")
		: unassignedName;
}

export function normalizeJiraIssue(
	value: unknown,
	fieldMapping: JiraFieldMapping,
): JiraIssue {
	const rawIssue = requiredObject(value, "issue");
	const fields = objectValue(rawIssue.fields) ?? {};
	const status = objectValue(fields.status);
	return {
		issueKey: stringValue(rawIssue.key) ?? "",
		summary: stringValue(fields.summary) ?? "",
		statusName: status ? stringValue(status.name) : null,
		resolutionDate: stringValue(fields.resolutiondate),
		storyPoints: numberValue(fields[fieldMapping.storyPointsFieldIdentifier]),
		developer: parseContributors(
			fields[fieldMapping.developerFieldIdentifier],
			unassignedDeveloperName,
		),
		bounceCount:
			numberValue(fields[fieldMapping.bounceCountFieldIdentifier]) ?? 0,
	};
}

export function normalizeJiraQualityAssuranceIssue(
	value: unknown,
	fieldMapping: QualityAssuranceFieldMapping,
): JiraQualityAssuranceIssue {
	const rawIssue = requiredObject(value, "issue");
	const fields = objectValue(rawIssue.fields) ?? {};
	const status = objectValue(fields.status);

	return {
		issueKey: stringValue(rawIssue.key) ?? "",
		summary: stringValue(fields.summary) ?? "",
		statusName: status ? stringValue(status.name) : null,
		storyPoints: numberValue(fields[fieldMapping.storyPointsFieldIdentifier]),
		tester: parseContributors(
			fields[fieldMapping.testerFieldIdentifier],
			unassignedTesterName,
		),
	};
}

export function qualityAssuranceBoardIssuePageRequest(
	boardIdentifier: number,
	sprintIdentifier: number,
	requestedFields: string[],
	nextPageToken: string | null,
): { pathname: string; query: URLSearchParams } {
	const query = new URLSearchParams({
		fields: requestedFields.join(","),
		jql: `sprint = ${sprintIdentifier}`,
		maxResults: "100",
	});
	if (nextPageToken) {
		query.set("nextPageToken", nextPageToken);
	}

	return {
		pathname: `/rest/software/1.0/board/${boardIdentifier}/issue`,
		query,
	};
}

export class JiraRequestError extends Error {
	readonly statusCode: number;
	readonly authenticationFailure: boolean;

	constructor(
		statusCode: number,
		message: string,
		authenticationFailure = false,
	) {
		super(message);
		this.name = "JiraRequestError";
		this.statusCode = statusCode;
		this.authenticationFailure = authenticationFailure;
	}
}

export class JiraClient {
	readonly credentials: JiraCredentials;

	constructor(credentials: JiraCredentials) {
		this.credentials = credentials;
	}

	private async request(
		pathname: string,
		options: JiraRequestOptions = {},
	): Promise<unknown> {
		const requestUrl = jiraApiRequestUrl(this.credentials, pathname);
		if (options.query) {
			requestUrl.search = options.query.toString();
		}
		const requestHeaders = new Headers();
		requestHeaders.set("Accept", "application/json");
		requestHeaders.set(
			"Authorization",
			`Basic ${Buffer.from(
				`${this.credentials.emailAddress}:${this.credentials.apiToken}`,
			).toString("base64")}`,
		);
		requestHeaders.set("User-Agent", "JiraLeaderboard/2.0");
		if (options.body) {
			requestHeaders.set("Content-Type", "application/json");
		}

		let response: Response;
		try {
			response = await fetch(requestUrl, {
				method: options.method ?? "GET",
				headers: requestHeaders,
				body: options.body ? JSON.stringify(options.body) : undefined,
				redirect: "error",
				signal: AbortSignal.timeout(30_000),
			});
		} catch (error) {
			if (error instanceof JiraRequestError) {
				throw error;
			}
			throw new JiraRequestError(
				502,
				"Could not reach Jira. Check the site and try again.",
			);
		}

		const responseText = await response.text();
		let responsePayload: unknown = null;
		if (responseText) {
			if (isJsonResponse(response)) {
				try {
					responsePayload = JSON.parse(responseText);
				} catch {
					if (response.ok) {
						throw new JiraRequestError(
							502,
							"Jira returned malformed JSON that the app could not read.",
						);
					}
				}
			} else if (response.ok) {
				throw new JiraRequestError(
					502,
					"Jira returned an unexpected response format.",
				);
			}
		}

		if (!response.ok) {
			const jiraMessage =
				errorMessageFromPayload(responsePayload) ??
				safeTextErrorMessage(responseText);
			if (response.status === 401) {
				throw new JiraRequestError(
					401,
					"Jira rejected the email address or API token. Check both values and try again.",
					true,
				);
			}
			if (response.status === 403) {
				throw new JiraRequestError(
					403,
					jiraMessage ??
						"This Jira account or token cannot view the requested data. Check its Jira permissions and read scopes.",
				);
			}
			if (response.status === 404) {
				throw new JiraRequestError(
					404,
					jiraMessage ??
						"The requested Jira board, sprint, or issue was not found.",
				);
			}
			if (response.status === 429) {
				const retryAfter = response.headers.get("Retry-After");
				throw new JiraRequestError(
					429,
					retryAfter
						? `Jira is limiting requests. Try again in ${retryAfter} seconds.`
						: "Jira is limiting requests. Wait a moment and try again.",
				);
			}

			throw new JiraRequestError(
				response.status >= 500 ? 502 : 400,
				jiraMessage ?? `Jira returned HTTP ${response.status}.`,
			);
		}

		return responsePayload;
	}

	async verifyConnection(): Promise<void> {
		const query = new URLSearchParams({ startAt: "0", maxResults: "1" });
		requiredObject(
			await this.request("/rest/agile/1.0/board", { query }),
			"board page",
		);
	}

	async currentUser(): Promise<JiraCurrentUser> {
		const user = requiredObject(
			await this.request("/rest/api/3/myself"),
			"user",
		);
		const displayName = stringValue(user.displayName);
		if (!displayName) {
			throw new JiraRequestError(
				502,
				"Jira returned a user without a display name.",
			);
		}

		return {
			accountIdentifier: stringValue(user.accountId),
			displayName,
			emailAddress: stringValue(user.emailAddress),
		};
	}

	async allBoards(boardType: "scrum" | null = null): Promise<JiraBoard[]> {
		const boards: JiraBoard[] = [];
		let startAt = 0;
		for (let pageNumber = 0; pageNumber < 500; pageNumber += 1) {
			const query = new URLSearchParams({
				startAt: String(startAt),
				maxResults: "50",
			});
			if (boardType) {
				query.set("type", boardType);
			}
			const page = requiredObject(
				await this.request("/rest/agile/1.0/board", { query }),
				"board page",
			);
			const pageBoards = arrayValue(page.values).map(parseJiraBoard);
			boards.push(...pageBoards);
			const total = numberValue(page.total);
			if (
				pageBoards.length === 0 ||
				booleanValue(page.isLast) === true ||
				(total !== null && boards.length >= total)
			) {
				return boards.sort((leftBoard, rightBoard) =>
					leftBoard.name.localeCompare(rightBoard.name),
				);
			}
			startAt += pageBoards.length;
		}

		throw new JiraRequestError(502, "Jira returned too many board pages.");
	}

	async allScrumBoards(): Promise<JiraBoard[]> {
		return this.allBoards("scrum");
	}

	async boardByIdentifier(boardIdentifier: number): Promise<JiraBoard> {
		return parseJiraBoard(
			await this.request(`/rest/agile/1.0/board/${boardIdentifier}`),
		);
	}

	async boardProjects(boardIdentifier: number): Promise<JiraProject[]> {
		const projectsByKey = new Map<string, JiraProject>();
		let startAt = 0;
		for (let pageNumber = 0; pageNumber < 500; pageNumber += 1) {
			const query = new URLSearchParams({
				startAt: String(startAt),
				maxResults: "50",
			});
			const page = requiredObject(
				await this.request(`/rest/agile/1.0/board/${boardIdentifier}/project`, {
					query,
				}),
				"board project page",
			);
			const pageProjects = arrayValue(page.values).map(parseJiraProject);
			for (const project of pageProjects) {
				projectsByKey.set(project.key, project);
			}
			const total = numberValue(page.total);
			if (
				pageProjects.length === 0 ||
				booleanValue(page.isLast) === true ||
				(total !== null && projectsByKey.size >= total)
			) {
				return [...projectsByKey.values()].sort((leftProject, rightProject) =>
					leftProject.name.localeCompare(rightProject.name),
				);
			}
			startAt += pageProjects.length;
		}

		throw new JiraRequestError(502, "Jira returned too many project pages.");
	}

	async fields(): Promise<JiraField[]> {
		const fields = arrayValue(await this.request("/rest/api/3/field")).map(
			parseJiraField,
		);
		return fields.sort((leftField, rightField) =>
			leftField.name.localeCompare(rightField.name),
		);
	}

	async statuses(): Promise<JiraStatus[]> {
		const statuses = arrayValue(await this.request("/rest/api/3/status")).map(
			parseJiraStatus,
		);
		return statuses.sort((leftStatus, rightStatus) =>
			leftStatus.name.localeCompare(rightStatus.name),
		);
	}

	async boardConfiguration(
		boardIdentifier: number,
	): Promise<JiraBoardConfiguration> {
		const configuration = requiredObject(
			await this.request(
				`/rest/agile/1.0/board/${boardIdentifier}/configuration`,
			),
			"board configuration",
		);
		const columnConfiguration = objectValue(configuration.columnConfig);
		const columns = arrayValue(columnConfiguration?.columns).map((column) =>
			requiredObject(column, "board column"),
		);
		const boardStatusIdentifiers = columns.flatMap((column) =>
			arrayValue(column.statuses)
				.map((status) => stringValue(objectValue(status)?.id))
				.filter((identifier): identifier is string => Boolean(identifier)),
		);
		const lastColumn = columns.at(-1);
		const doneColumnStatusIdentifiers = arrayValue(lastColumn?.statuses)
			.map((status) => stringValue(objectValue(status)?.id))
			.filter((identifier): identifier is string => Boolean(identifier));
		const estimation = objectValue(configuration.estimation);
		const estimationField = objectValue(estimation?.field);

		return {
			boardIdentifier: numberValue(configuration.id) ?? boardIdentifier,
			boardName: stringValue(configuration.name) ?? `Board ${boardIdentifier}`,
			boardStatusIdentifiers,
			doneColumnStatusIdentifiers,
			estimationFieldIdentifier: stringValue(estimationField?.fieldId),
		};
	}

	async sprintPage(
		boardIdentifier: number,
		state: JiraSprintState,
		startAt: number,
		maxResults: number,
	): Promise<JiraSprintPage> {
		const query = new URLSearchParams({
			state,
			startAt: String(startAt),
			maxResults: String(maxResults),
		});
		const page = requiredObject(
			await this.request(`/rest/agile/1.0/board/${boardIdentifier}/sprint`, {
				query,
			}),
			"sprint page",
		);
		const sprints = arrayValue(page.values).map(parseJiraSprint);
		const returnedStartAt = numberValue(page.startAt) ?? startAt;
		const returnedMaxResults = numberValue(page.maxResults) ?? maxResults;
		const total = numberValue(page.total);
		const consumedResults = returnedStartAt + sprints.length;
		const isLast =
			sprints.length === 0 ||
			booleanValue(page.isLast) === true ||
			(total !== null && consumedResults >= total) ||
			(total === null && sprints.length < returnedMaxResults);

		return {
			sprints: sortJiraSprints(sprints),
			startAt: returnedStartAt,
			maxResults: returnedMaxResults,
			total,
			isLast,
			nextStartAt: isLast ? null : consumedResults,
		};
	}

	async sprintIssues(
		sprintIdentifier: number,
		fieldMapping: JiraFieldMapping,
	): Promise<JiraIssue[]> {
		const requestedFields = this.requestedIssueFields(fieldMapping, false);
		const issues: JiraIssue[] = [];
		let nextPageToken: string | null = null;
		for (let pageNumber = 0; pageNumber < 500; pageNumber += 1) {
			const query = new URLSearchParams({
				maxResults: "100",
				fields: requestedFields.join(","),
			});
			if (nextPageToken) {
				query.set("nextPageToken", nextPageToken);
			}
			const page = requiredObject(
				await this.request(
					`/rest/software/1.0/sprint/${sprintIdentifier}/issue`,
					{
						query,
					},
				),
				"sprint issue page",
			);
			const pageIssues = arrayValue(page.issues).map((issue) =>
				normalizeJiraIssue(issue, fieldMapping),
			);
			issues.push(...pageIssues);
			nextPageToken = stringValue(page.nextPageToken);
			if (
				pageIssues.length === 0 ||
				booleanValue(page.isLast) === true ||
				!nextPageToken
			) {
				return issues;
			}
		}

		throw new JiraRequestError(
			502,
			"Jira returned too many sprint issue pages.",
		);
	}

	async qualityAssuranceBoardIssuesForSprint(
		boardIdentifier: number,
		sprintIdentifier: number,
		fieldMapping: QualityAssuranceFieldMapping,
	): Promise<JiraQualityAssuranceIssue[]> {
		const requestedFields = [
			"summary",
			"status",
			fieldMapping.storyPointsFieldIdentifier,
			fieldMapping.testerFieldIdentifier,
		].sort();
		const issues: JiraQualityAssuranceIssue[] = [];
		let nextPageToken: string | null = null;
		for (let pageNumber = 0; pageNumber < 500; pageNumber += 1) {
			const pageRequest = qualityAssuranceBoardIssuePageRequest(
				boardIdentifier,
				sprintIdentifier,
				requestedFields,
				nextPageToken,
			);
			const page = requiredObject(
				await this.request(pageRequest.pathname, { query: pageRequest.query }),
				"quality assurance issue page",
			);
			const pageIssues = arrayValue(page.issues).map((issue) =>
				normalizeJiraQualityAssuranceIssue(issue, fieldMapping),
			);
			issues.push(...pageIssues);
			nextPageToken = stringValue(page.nextPageToken);
			if (
				pageIssues.length === 0 ||
				booleanValue(page.isLast) === true ||
				!nextPageToken
			) {
				return issues;
			}
		}

		throw new JiraRequestError(
			502,
			"Jira returned too many quality assurance issue pages.",
		);
	}

	async resolvedIssues(
		scopeQuery: string,
		range: ResolvedDateRange,
		fieldMapping: JiraFieldMapping,
	): Promise<JiraIssue[]> {
		const requestedFields = this.requestedIssueFields(fieldMapping, true);
		const issues: JiraIssue[] = [];
		let nextPageToken: string | null = null;
		for (let pageNumber = 0; pageNumber < 500; pageNumber += 1) {
			const body: JsonObject = {
				jql: buildResolvedIssuesQuery(scopeQuery, range),
				fields: requestedFields,
				fieldsByKeys: false,
				maxResults: 100,
			};
			if (nextPageToken) {
				body.nextPageToken = nextPageToken;
			}
			const page = requiredObject(
				await this.request("/rest/api/3/search/jql", { method: "POST", body }),
				"resolved issue page",
			);
			const pageIssues = arrayValue(page.issues).map((issue) =>
				normalizeJiraIssue(issue, fieldMapping),
			);
			issues.push(...pageIssues);
			nextPageToken = stringValue(page.nextPageToken);
			if (
				pageIssues.length === 0 ||
				booleanValue(page.isLast) === true ||
				!nextPageToken
			) {
				return issues;
			}
		}

		throw new JiraRequestError(
			502,
			"Jira returned too many resolved issue pages.",
		);
	}

	private requestedIssueFields(
		fieldMapping: JiraFieldMapping,
		includeResolutionDate: boolean,
	): string[] {
		const fields = new Set([
			"summary",
			"status",
			fieldMapping.storyPointsFieldIdentifier,
			fieldMapping.developerFieldIdentifier,
			fieldMapping.bounceCountFieldIdentifier,
		]);
		if (includeResolutionDate) {
			fields.add("resolutiondate");
		}

		return [...fields].sort();
	}
}
