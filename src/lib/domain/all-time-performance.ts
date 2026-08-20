import {
	type JiraIssue,
	type JiraQualityAssuranceIssue,
	unassignedDeveloperName,
	unassignedTesterName,
} from "./jira";

export interface AllTimeLeaderboardEntry {
	contributor: string;
	completedPoints: number;
	completedTickets: number;
}

interface CompletedIssue {
	statusName: string | null;
	storyPoints: number | null;
	contributor: string;
}

function emptyLeaderboardEntry(contributor: string): AllTimeLeaderboardEntry {
	return {
		contributor,
		completedPoints: 0,
		completedTickets: 0,
	};
}

function summarizeCompletedIssues(
	issues: CompletedIssue[],
	doneStatus: string,
): AllTimeLeaderboardEntry[] {
	const entriesByContributor = new Map<string, AllTimeLeaderboardEntry>();

	for (const issue of issues) {
		if (issue.statusName !== doneStatus) {
			continue;
		}

		const entry =
			entriesByContributor.get(issue.contributor) ??
			emptyLeaderboardEntry(issue.contributor);
		entry.completedPoints += issue.storyPoints ?? 0;
		entry.completedTickets += 1;
		entriesByContributor.set(issue.contributor, entry);
	}

	return [...entriesByContributor.values()].sort((leftEntry, rightEntry) => {
		if (leftEntry.completedPoints !== rightEntry.completedPoints) {
			return rightEntry.completedPoints - leftEntry.completedPoints;
		}
		if (leftEntry.completedTickets !== rightEntry.completedTickets) {
			return rightEntry.completedTickets - leftEntry.completedTickets;
		}

		return leftEntry.contributor.localeCompare(rightEntry.contributor);
	});
}

export function summarizeDeveloperAllTimeIssues(
	issues: JiraIssue[],
	doneStatus: string,
): AllTimeLeaderboardEntry[] {
	return summarizeCompletedIssues(
		issues
			.filter((issue) => issue.developer !== unassignedDeveloperName)
			.map((issue) => ({
				statusName: issue.statusName,
				storyPoints: issue.storyPoints,
				contributor: issue.developer,
			})),
		doneStatus,
	);
}

export function summarizeQualityAssuranceAllTimeIssues(
	issues: JiraQualityAssuranceIssue[],
	doneStatus: string,
): AllTimeLeaderboardEntry[] {
	return summarizeCompletedIssues(
		issues
			.filter((issue) => issue.tester !== unassignedTesterName)
			.map((issue) => ({
				statusName: issue.statusName,
				storyPoints: issue.storyPoints,
				contributor: issue.tester,
			})),
		doneStatus,
	);
}

export function totalAllTimeLeaderboard(entries: AllTimeLeaderboardEntry[]): {
	completedPoints: number;
	completedTickets: number;
} {
	return entries.reduce(
		(total, entry) => ({
			completedPoints: total.completedPoints + entry.completedPoints,
			completedTickets: total.completedTickets + entry.completedTickets,
		}),
		{ completedPoints: 0, completedTickets: 0 },
	);
}

export function buildDoneIssuesQuery(
	doneStatus: string,
	year: number | null,
): string {
	const escapedStatus = doneStatus
		.replaceAll("\\", "\\\\")
		.replaceAll('"', '\\"');
	const statusCondition = `status = "${escapedStatus}"`;
	if (year === null) {
		return statusCondition;
	}

	return `${statusCondition} AND resolved >= "${year}-01-01" AND resolved < "${year + 1}-01-01"`;
}
