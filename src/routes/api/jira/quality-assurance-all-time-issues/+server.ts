import {
	apiErrorResponse,
	apiJson,
	leaderboardScope,
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
		const scope = leaderboardScope(payload, "scope");
		const contributorAccountIdentifier =
			payload.contributorAccountIdentifier == null
				? null
				: requiredString(
						payload,
						"contributorAccountIdentifier",
						"contributor account",
						256,
					);
		const fieldMapping = parseQualityAssuranceFieldMapping(payload);
		const client = new JiraClient(requireCredentialSession(cookies));
		const issues =
			scope === "global"
				? await client.qualityAssuranceGlobalDoneIssues(
						doneStatus,
						year,
						fieldMapping,
						contributorAccountIdentifier,
					)
				: await client.qualityAssuranceBoardDoneIssues(
						boardIdentifier,
						doneStatus,
						year,
						fieldMapping,
						contributorAccountIdentifier,
					);

		return apiJson({ issues });
	} catch (error) {
		return apiErrorResponse(error);
	}
};
