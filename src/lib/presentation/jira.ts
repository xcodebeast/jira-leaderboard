export function jiraIssueUrl(jiraSiteUrl: string, issueKey: string): string {
	return new URL(
		`/browse/${encodeURIComponent(issueKey)}`,
		`${jiraSiteUrl}/`,
	).toString();
}
