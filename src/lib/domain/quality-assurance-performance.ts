import type {
	JiraQualityAssuranceIssue,
	QualityAssuranceStatusMapping,
} from "./jira";

export interface QualityAssuranceSprintTicket {
	issueKey: string;
	summary: string;
	status: string;
}

export interface TesterSprintSummary {
	tester: string;
	doneStoryPoints: number;
	doneTicketCount: number;
	readyForQualityAssuranceStoryPoints: number;
	readyForQualityAssuranceTicketCount: number;
	tickets: QualityAssuranceSprintTicket[];
}

export function qualityAssuranceTicketDisplay(
	ticket: QualityAssuranceSprintTicket,
): string {
	return `${ticket.issueKey} (${ticket.status})`;
}

export function totalQualityAssuranceTicketCount(
	summary: TesterSprintSummary,
): number {
	return summary.doneTicketCount + summary.readyForQualityAssuranceTicketCount;
}

function emptyTesterSprintSummary(tester: string): TesterSprintSummary {
	return {
		tester,
		doneStoryPoints: 0,
		doneTicketCount: 0,
		readyForQualityAssuranceStoryPoints: 0,
		readyForQualityAssuranceTicketCount: 0,
		tickets: [],
	};
}

export function summarizeQualityAssuranceSprintIssues(
	issues: JiraQualityAssuranceIssue[],
	statuses: QualityAssuranceStatusMapping,
): TesterSprintSummary[] {
	const summariesByTester = new Map<string, TesterSprintSummary>();

	for (const issue of issues) {
		if (
			issue.statusName !== statuses.done &&
			issue.statusName !== statuses.readyForQualityAssurance
		) {
			continue;
		}
		const summary =
			summariesByTester.get(issue.tester) ??
			emptyTesterSprintSummary(issue.tester);
		const storyPoints = issue.storyPoints ?? 0;
		if (issue.statusName === statuses.done) {
			summary.doneStoryPoints += storyPoints;
			summary.doneTicketCount += 1;
		} else {
			summary.readyForQualityAssuranceStoryPoints += storyPoints;
			summary.readyForQualityAssuranceTicketCount += 1;
		}
		summary.tickets.push({
			issueKey: issue.issueKey,
			summary: issue.summary,
			status: issue.statusName,
		});
		summariesByTester.set(issue.tester, summary);
	}

	return [...summariesByTester.values()]
		.map((summary) => ({
			...summary,
			tickets: [...summary.tickets].sort((leftTicket, rightTicket) =>
				qualityAssuranceTicketDisplay(leftTicket).localeCompare(
					qualityAssuranceTicketDisplay(rightTicket),
				),
			),
		}))
		.sort((leftSummary, rightSummary) => {
			if (leftSummary.doneStoryPoints !== rightSummary.doneStoryPoints) {
				return rightSummary.doneStoryPoints - leftSummary.doneStoryPoints;
			}
			if (leftSummary.doneTicketCount !== rightSummary.doneTicketCount) {
				return rightSummary.doneTicketCount - leftSummary.doneTicketCount;
			}
			if (
				leftSummary.readyForQualityAssuranceStoryPoints !==
				rightSummary.readyForQualityAssuranceStoryPoints
			) {
				return (
					rightSummary.readyForQualityAssuranceStoryPoints -
					leftSummary.readyForQualityAssuranceStoryPoints
				);
			}

			return leftSummary.tester.localeCompare(rightSummary.tester);
		});
}
