import {
	buildJiraSetupSuggestion,
	buildQualityAssuranceSetupSuggestion,
} from "$lib/domain/setup";
import {
	apiErrorResponse,
	apiJson,
	ClientInputError,
	queryPositiveInteger,
} from "$lib/server/api";
import { JiraClient } from "$lib/server/jira-client";
import { requireCredentialSession } from "$lib/server/session";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ cookies, url }) => {
	try {
		const boardIdentifier = queryPositiveInteger(
			url.searchParams,
			"boardIdentifier",
			"Jira board",
		);
		const setupMode = url.searchParams.get("mode") ?? "development";
		if (setupMode !== "development" && setupMode !== "qualityAssurance") {
			throw new ClientInputError("Select a valid board setup mode.");
		}
		const preferredFieldIdentifiers = url.searchParams
			.getAll("preferredFieldIdentifier")
			.map((identifier) => identifier.trim())
			.filter(Boolean)
			.slice(0, 3);
		const client = new JiraClient(requireCredentialSession(cookies));
		const boardProjectsPromise =
			setupMode === "development"
				? client.boardProjects(boardIdentifier)
				: Promise.resolve([]);
		const [board, boardConfiguration, fields, statuses, boardProjects] =
			await Promise.all([
				client.boardByIdentifier(boardIdentifier),
				client.boardConfiguration(boardIdentifier),
				client.fields(),
				client.statuses(),
				boardProjectsPromise,
			]);
		if (setupMode === "development" && board.type !== "scrum") {
			throw new ClientInputError(
				"Select a Scrum board for development sprint reporting.",
			);
		}

		return apiJson({
			suggestion:
				setupMode === "qualityAssurance"
					? buildQualityAssuranceSetupSuggestion(
							board,
							boardConfiguration,
							fields,
							statuses,
							preferredFieldIdentifiers,
						)
					: buildJiraSetupSuggestion(
							board,
							boardConfiguration,
							fields,
							statuses,
							boardProjects,
							preferredFieldIdentifiers,
						),
		});
	} catch (error) {
		return apiErrorResponse(error);
	}
};
