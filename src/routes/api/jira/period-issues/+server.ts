import {
	buildProjectScopeQuery,
	createResolvedDateRange,
	type ResolvedDateRange,
} from "$lib/domain/period-performance";
import {
	apiErrorResponse,
	apiJson,
	ClientInputError,
	readJsonObject,
	requiredString,
} from "$lib/server/api";
import { parseFieldMapping } from "$lib/server/field-mapping";
import { JiraClient } from "$lib/server/jira-client";
import { requireCredentialSession } from "$lib/server/session";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ cookies, request }) => {
	try {
		const payload = await readJsonObject(request);
		const startDate = requiredString(
			payload,
			"startDate",
			"a range start date",
			10,
		);
		const endDate = requiredString(payload, "endDate", "a range end date", 10);
		const scopeQuery =
			typeof payload.scopeQuery === "string" && payload.scopeQuery.trim()
				? requiredString(payload, "scopeQuery", "a Jira query", 2_000)
				: buildProjectScopeQuery(
						requiredString(payload, "projectKey", "a Jira project key", 100),
					);
		const fieldMapping = parseFieldMapping(payload);
		let range: ResolvedDateRange;
		try {
			range = createResolvedDateRange(startDate, endDate);
		} catch (error) {
			throw new ClientInputError(
				error instanceof Error ? error.message : "Select a valid date range.",
			);
		}
		const client = new JiraClient(requireCredentialSession(cookies));
		const issues = await client.resolvedIssues(scopeQuery, range, fieldMapping);
		return apiJson({ issues, range });
	} catch (error) {
		return apiErrorResponse(error);
	}
};
