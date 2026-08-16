import {
	apiErrorResponse,
	apiJson,
	readJsonObject,
	requiredPositiveInteger,
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
		const sprintIdentifier = requiredPositiveInteger(
			payload,
			"sprintIdentifier",
			"Jira sprint",
		);
		const fieldMapping = parseQualityAssuranceFieldMapping(payload);
		const client = new JiraClient(requireCredentialSession(cookies));

		return apiJson({
			issues: await client.qualityAssuranceBoardIssuesForSprint(
				boardIdentifier,
				sprintIdentifier,
				fieldMapping,
			),
		});
	} catch (error) {
		return apiErrorResponse(error);
	}
};
