import type { JiraSprintState } from "$lib/domain/jira";
import {
	apiErrorResponse,
	apiJson,
	ClientInputError,
	queryNonNegativeInteger,
	queryPositiveInteger,
	queryPositiveIntegerWithMaximum,
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
		const requestedState = url.searchParams.get("state") ?? "closed";
		if (requestedState !== "active" && requestedState !== "closed") {
			throw new ClientInputError("Select a valid Jira sprint state.");
		}
		const state: JiraSprintState = requestedState;
		const startAt = queryNonNegativeInteger(
			url.searchParams,
			"startAt",
			"sprint page offset",
			0,
		);
		const maxResults = queryPositiveIntegerWithMaximum(
			url.searchParams,
			"maxResults",
			"sprint page size",
			25,
			50,
		);
		const client = new JiraClient(requireCredentialSession(cookies));
		return apiJson(
			await client.sprintPage(boardIdentifier, state, startAt, maxResults),
		);
	} catch (error) {
		return apiErrorResponse(error);
	}
};
