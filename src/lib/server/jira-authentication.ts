import type { JiraCredentials } from "./credential-vault";
import { isJiraCloudIdentifier } from "./jira-api-url";
import { JiraClient, JiraRequestError } from "./jira-client";

export interface JiraConnection {
	credentials: JiraCredentials;
}

export function createPendingJiraCredentials(values: {
	jiraSiteUrl: string;
	emailAddress: string;
	apiToken: string;
	issuedAt: string;
}): JiraCredentials {
	return {
		...values,
		authenticationMode: "classic",
		cloudIdentifier: null,
	};
}

export function createScopedJiraCredentials(
	credentials: JiraCredentials,
	cloudIdentifier: string,
): JiraCredentials {
	if (!isJiraCloudIdentifier(cloudIdentifier)) {
		throw new Error("Jira returned an invalid Cloud identifier.");
	}

	return {
		...credentials,
		authenticationMode: "scoped",
		cloudIdentifier,
	};
}

export async function discoverJiraCloudIdentifier(
	jiraSiteUrl: string,
): Promise<string> {
	const discoveryUrl = new URL("/_edge/tenant_info", `${jiraSiteUrl}/`);
	let response: Response;
	try {
		response = await fetch(discoveryUrl, {
			headers: { accept: "application/json" },
			redirect: "error",
			signal: AbortSignal.timeout(15_000),
		});
	} catch {
		throw new JiraRequestError(
			502,
			"Could not discover this Jira site's Cloud identifier. Check the Jira site URL and try again.",
		);
	}
	if (!response.ok) {
		throw new JiraRequestError(
			502,
			"Could not discover this Jira site's Cloud identifier. Check the Jira site URL and try again.",
		);
	}

	let payload: unknown;
	try {
		payload = await response.json();
	} catch {
		throw new JiraRequestError(
			502,
			"Jira returned an invalid Cloud identifier response.",
		);
	}
	const cloudIdentifier =
		payload !== null &&
		typeof payload === "object" &&
		!Array.isArray(payload) &&
		typeof (payload as Record<string, unknown>).cloudId === "string"
			? (payload as Record<string, string>).cloudId
			: "";
	if (!isJiraCloudIdentifier(cloudIdentifier)) {
		throw new JiraRequestError(
			502,
			"Jira returned an invalid Cloud identifier.",
		);
	}

	return cloudIdentifier;
}

function shouldTryScopedAuthentication(error: unknown): boolean {
	return (
		error instanceof JiraRequestError &&
		(error.authenticationFailure || error.statusCode === 403)
	);
}

export async function connectJiraCredentials(
	pendingCredentials: JiraCredentials,
): Promise<JiraConnection> {
	try {
		await new JiraClient(pendingCredentials).verifyConnection();
		return {
			credentials: pendingCredentials,
		};
	} catch (error) {
		if (!shouldTryScopedAuthentication(error)) {
			throw error;
		}
	}

	const cloudIdentifier = await discoverJiraCloudIdentifier(
		pendingCredentials.jiraSiteUrl,
	);
	const scopedCredentials = createScopedJiraCredentials(
		pendingCredentials,
		cloudIdentifier,
	);
	try {
		await new JiraClient(scopedCredentials).verifyConnection();
		return {
			credentials: scopedCredentials,
		};
	} catch (error) {
		if (shouldTryScopedAuthentication(error)) {
			throw new JiraRequestError(
				error instanceof JiraRequestError ? error.statusCode : 401,
				"Jira rejected the token through both classic and scoped authentication. Check the email, token, expiration, and Jira read scopes.",
				error instanceof JiraRequestError ? error.authenticationFailure : true,
			);
		}
		throw error;
	}
}
