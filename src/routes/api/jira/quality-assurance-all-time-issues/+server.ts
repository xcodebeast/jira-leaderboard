import {
	apiErrorResponse,
	apiJson,
	optionalCalendarYear,
	readJsonObject,
	requiredPositiveInteger,
	requiredString,
} from "$lib/server/api";
import { parseQualityAssuranceFieldMapping } from "$lib/server/field-mapping";
import { JiraClient } from "$lib/server/jira-client";
import { requireCredentialSession } from "$lib/server/session";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ cookies, request }) => {
	try {
		const payload = await readJsonObject(request);
		const boardIdentifier = requiredPositiveInteger(
			payload,
			"boardIdentifier",
			"quality assurance board",
		);
		const doneStatus = requiredString(
			payload,
			"doneStatus",
			"Done status",
			200,
		);
		const year = optionalCalendarYear(payload, "year", "leaderboard year");
		const fieldMapping = parseQualityAssuranceFieldMapping(payload);
		const client = new JiraClient(requireCredentialSession(cookies));

		return apiJson({
			issues: await client.qualityAssuranceBoardDoneIssues(
				boardIdentifier,
				doneStatus,
				year,
				fieldMapping,
			),
		});
	} catch (error) {
		return apiErrorResponse(error);
	}
};
