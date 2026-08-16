import { env } from "$env/dynamic/private";
import {
	apiErrorResponse,
	apiJson,
	ClientInputError,
	readJsonObject,
	requiredString,
} from "$lib/server/api";
import {
	connectJiraCredentials,
	createPendingJiraCredentials,
} from "$lib/server/jira-authentication";
import { normalizeJiraSiteUrl } from "$lib/server/jira-site";
import {
	clearCredentialSession,
	readCredentialSession,
	saveCredentialSession,
} from "$lib/server/session";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ cookies }) => {
	try {
		const credentials = readCredentialSession(cookies);
		return apiJson(
			credentials
				? {
						connected: true,
						jiraSiteUrl: credentials.jiraSiteUrl,
						emailAddress: credentials.emailAddress,
						authenticationMode: credentials.authenticationMode,
					}
				: { connected: false },
		);
	} catch (error) {
		return apiErrorResponse(error);
	}
};

export const POST: RequestHandler = async ({ cookies, request }) => {
	try {
		const payload = await readJsonObject(request);
		const jiraSiteUrl = normalizeJiraSiteUrl(
			requiredString(payload, "jiraSiteUrl", "your Jira site URL"),
			env.JIRA_ALLOWED_HOSTS,
		);
		const emailAddress = requiredString(
			payload,
			"emailAddress",
			"your Jira email",
			320,
		);
		const apiToken = requiredString(
			payload,
			"apiToken",
			"your Jira API token",
			2_000,
		);
		if (!emailAddress.includes("@")) {
			throw new ClientInputError(
				"Enter the email address associated with your Jira token.",
			);
		}

		const pendingCredentials = createPendingJiraCredentials({
			jiraSiteUrl,
			emailAddress,
			apiToken,
			issuedAt: new Date().toISOString(),
		});
		const { credentials } = await connectJiraCredentials(pendingCredentials);
		saveCredentialSession(cookies, credentials);
		return apiJson({
			connected: true,
			jiraSiteUrl,
			emailAddress,
			authenticationMode: credentials.authenticationMode,
		});
	} catch (error) {
		if (
			error instanceof Error &&
			!(error instanceof ClientInputError) &&
			error.message.startsWith("Enter a valid Jira URL")
		) {
			return apiErrorResponse(new ClientInputError(error.message));
		}
		if (
			error instanceof Error &&
			!(error instanceof ClientInputError) &&
			(error.message.startsWith("The Jira URL") ||
				error.message.startsWith("This Jira hostname"))
		) {
			return apiErrorResponse(new ClientInputError(error.message));
		}
		return apiErrorResponse(error);
	}
};

export const DELETE: RequestHandler = async ({ cookies }) => {
	clearCredentialSession(cookies);
	return apiJson({ connected: false });
};
