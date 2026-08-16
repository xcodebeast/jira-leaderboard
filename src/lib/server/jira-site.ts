const defaultAllowedHostPatterns = ["*.atlassian.net"];

function parseAllowedHostPatterns(configuredHosts?: string): string[] {
	const patterns = configuredHosts
		?.split(",")
		.map((host) => host.trim().toLocaleLowerCase())
		.filter(Boolean);
	return patterns && patterns.length > 0
		? patterns
		: defaultAllowedHostPatterns;
}

function hostnameMatchesPattern(hostname: string, pattern: string): boolean {
	if (pattern.startsWith("*.")) {
		const baseHostname = pattern.slice(2);
		return hostname !== baseHostname && hostname.endsWith(`.${baseHostname}`);
	}

	return hostname === pattern;
}

export function normalizeJiraSiteUrl(
	value: string,
	configuredHosts?: string,
): string {
	let siteUrl: URL;
	try {
		siteUrl = new URL(value.trim());
	} catch {
		throw new Error(
			"Enter a valid Jira URL, such as https://company.atlassian.net.",
		);
	}

	if (
		siteUrl.protocol !== "https:" ||
		siteUrl.username ||
		siteUrl.password ||
		siteUrl.search ||
		siteUrl.hash ||
		(siteUrl.pathname !== "/" && siteUrl.pathname !== "")
	) {
		throw new Error(
			"The Jira URL must be an HTTPS site origin without a path or query.",
		);
	}

	const normalizedHostname = siteUrl.hostname.toLocaleLowerCase();
	const allowedPatterns = parseAllowedHostPatterns(configuredHosts);
	if (
		!allowedPatterns.some((pattern) =>
			hostnameMatchesPattern(normalizedHostname, pattern),
		)
	) {
		throw new Error(
			"This Jira hostname is not allowed by the server. Add it to JIRA_ALLOWED_HOSTS.",
		);
	}

	siteUrl.pathname = "";
	return siteUrl.toString().replace(/\/$/, "");
}
