import type { JiraCredentials } from "./credential-vault";

const cloudIdentifierPattern =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isJiraCloudIdentifier(value: string): boolean {
	return cloudIdentifierPattern.test(value);
}

export function jiraApiBaseUrl(credentials: JiraCredentials): string {
	if (credentials.authenticationMode === "scoped") {
		if (
			!credentials.cloudIdentifier ||
			!isJiraCloudIdentifier(credentials.cloudIdentifier)
		) {
			throw new Error("Scoped Jira credentials require a Cloud identifier.");
		}
		return `https://api.atlassian.com/ex/jira/${credentials.cloudIdentifier}`;
	}

	return credentials.jiraSiteUrl;
}

export function jiraApiRequestUrl(
	credentials: JiraCredentials,
	pathname: string,
): URL {
	const relativePathname = pathname.replace(/^\/+/, "");
	return new URL(relativePathname, `${jiraApiBaseUrl(credentials)}/`);
}
