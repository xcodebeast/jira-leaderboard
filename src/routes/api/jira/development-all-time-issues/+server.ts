import {
	apiErrorResponse,
	apiJson,
	leaderboardScope,
	optionalCalendarYear,
	readJsonObject,
	requiredPositiveInteger,
	requiredString,
} from "$lib/server/api";
import { parseFieldMapping } from "$lib/server/field-mapping";
import { JiraClient } from "$lib/server/jira-client";
import { requireCredentialSession } from "$lib/server/session";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ cookies, request }) => {
	try {
		const payload = await readJsonObject(request);
		const boardIdentifier = requiredPositiveInteger(
			payload,
			"boardIdentifier",
			"development board",
		);
		const doneStatus = requiredString(
			payload,
			"doneStatus",
			"Done status",
			200,
		);
		const year = optionalCalendarYear(payload, "year", "leaderboard year");
		const scope = leaderboardScope(payload, "scope");
		const fieldMapping = parseFieldMapping(payload);
		const client = new JiraClient(requireCredentialSession(cookies));
		const issues =
			scope === "global"
				? await client.developmentGlobalDoneIssues(
						doneStatus,
						year,
						fieldMapping,
					)
				: await client.developmentBoardDoneIssues(
						boardIdentifier,
						doneStatus,
						year,
						fieldMapping,
					);

		return apiJson({ issues });
	} catch (error) {
		return apiErrorResponse(error);
	}
};
