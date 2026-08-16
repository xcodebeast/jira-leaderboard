import { apiErrorResponse, apiJson, ClientInputError } from "$lib/server/api";
import { JiraClient } from "$lib/server/jira-client";
import { requireCredentialSession } from "$lib/server/session";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ cookies, url }) => {
	try {
		const requestedBoardType = url.searchParams.get("boardType") ?? "scrum";
		if (requestedBoardType !== "scrum" && requestedBoardType !== "all") {
			throw new ClientInputError("Select a valid Jira board type.");
		}
		const client = new JiraClient(requireCredentialSession(cookies));
		return apiJson({
			boards: await client.allBoards(
				requestedBoardType === "scrum" ? "scrum" : null,
			),
		});
	} catch (error) {
		return apiErrorResponse(error);
	}
};
