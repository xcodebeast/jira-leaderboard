import { contributorIdentityKey } from "./contributor";
import type { JiraIssue, SprintStatusMapping } from "./jira";

export interface SprintTicket {
	issueKey: string;
	summary: string;
	status: string;
}

export interface DeveloperSprintSummary {
	developer: string;
	developerAccountIdentifier?: string;
	donePoints: number;
	qualityAssurancePoints: number;
	readyForQualityAssurancePoints: number;
	bounceCount: number;
	tickets: SprintTicket[];
}

export interface DeveloperSprintComparison {
	developer: string;
	developerAccountIdentifier?: string;
	donePointsDelta: number;
	qualityAssurancePointsDelta: number;
	readyForQualityAssurancePointsDelta: number;
	projectedPointsDelta: number;
	bounceCountDelta: number;
}

export function projectedSprintPoints(summary: DeveloperSprintSummary): number {
	return (
		summary.donePoints +
		summary.qualityAssurancePoints +
		summary.readyForQualityAssurancePoints
	);
}

export function sprintTicketDisplay(ticket: SprintTicket): string {
	return `${ticket.issueKey} (${ticket.status})`;
}

function emptySprintSummary(
	developer: string,
	developerAccountIdentifier?: string,
): DeveloperSprintSummary {
	return {
		developer,
		...(developerAccountIdentifier ? { developerAccountIdentifier } : {}),
		donePoints: 0,
		qualityAssurancePoints: 0,
		readyForQualityAssurancePoints: 0,
		bounceCount: 0,
		tickets: [],
	};
}

export function summarizeSprintIssues(
	issues: JiraIssue[],
	statuses: SprintStatusMapping,
): DeveloperSprintSummary[] {
	const trackedStatuses = new Set([
		statuses.done,
		statuses.qualityAssurance,
		statuses.readyForQualityAssurance,
	]);
	const summariesByDeveloper = new Map<string, DeveloperSprintSummary>();

	for (const issue of issues) {
		if (!issue.statusName || !trackedStatuses.has(issue.statusName)) {
			continue;
		}

		const developerKey = contributorIdentityKey(
			issue.developer,
			issue.developerAccountIdentifier,
		);
		const summary =
			summariesByDeveloper.get(developerKey) ??
			emptySprintSummary(issue.developer, issue.developerAccountIdentifier);
		const storyPoints = issue.storyPoints ?? 0;

		if (issue.statusName === statuses.done) {
			summary.donePoints += storyPoints;
		} else if (issue.statusName === statuses.qualityAssurance) {
			summary.qualityAssurancePoints += storyPoints;
		} else if (issue.statusName === statuses.readyForQualityAssurance) {
			summary.readyForQualityAssurancePoints += storyPoints;
		}

		summary.bounceCount += issue.bounceCount;
		summary.tickets.push({
			issueKey: issue.issueKey,
			summary: issue.summary,
			status: issue.statusName,
		});
		summariesByDeveloper.set(developerKey, summary);
	}

	return [...summariesByDeveloper.values()]
		.map((summary) => ({
			...summary,
			tickets: [...summary.tickets].sort((leftTicket, rightTicket) =>
				sprintTicketDisplay(leftTicket).localeCompare(
					sprintTicketDisplay(rightTicket),
				),
			),
		}))
		.sort((leftSummary, rightSummary) => {
			if (leftSummary.donePoints !== rightSummary.donePoints) {
				return rightSummary.donePoints - leftSummary.donePoints;
			}

			const projectedDifference =
				projectedSprintPoints(rightSummary) -
				projectedSprintPoints(leftSummary);
			return (
				projectedDifference ||
				leftSummary.developer.localeCompare(rightSummary.developer)
			);
		});
}

export function compareSprintSummaries(
	currentSummaries: DeveloperSprintSummary[],
	previousSummaries: DeveloperSprintSummary[],
): DeveloperSprintComparison[] {
	const currentByDeveloper = new Map(
		currentSummaries.map((summary) => [
			contributorIdentityKey(
				summary.developer,
				summary.developerAccountIdentifier,
			),
			summary,
		]),
	);
	const previousByDeveloper = new Map(
		previousSummaries.map((summary) => [
			contributorIdentityKey(
				summary.developer,
				summary.developerAccountIdentifier,
			),
			summary,
		]),
	);
	const developerKeys = new Set([
		...currentByDeveloper.keys(),
		...previousByDeveloper.keys(),
	]);

	return [...developerKeys]
		.map((developerKey) => {
			const currentMatch = currentByDeveloper.get(developerKey);
			const previousMatch = previousByDeveloper.get(developerKey);
			const developer =
				currentMatch?.developer ??
				previousMatch?.developer ??
				"Unknown developer";
			const developerAccountIdentifier =
				currentMatch?.developerAccountIdentifier ??
				previousMatch?.developerAccountIdentifier;
			const currentSummary =
				currentMatch ??
				emptySprintSummary(developer, developerAccountIdentifier);
			const previousSummary =
				previousMatch ??
				emptySprintSummary(developer, developerAccountIdentifier);

			return {
				developer,
				...(developerAccountIdentifier ? { developerAccountIdentifier } : {}),
				donePointsDelta: currentSummary.donePoints - previousSummary.donePoints,
				qualityAssurancePointsDelta:
					currentSummary.qualityAssurancePoints -
					previousSummary.qualityAssurancePoints,
				readyForQualityAssurancePointsDelta:
					currentSummary.readyForQualityAssurancePoints -
					previousSummary.readyForQualityAssurancePoints,
				projectedPointsDelta:
					projectedSprintPoints(currentSummary) -
					projectedSprintPoints(previousSummary),
				bounceCountDelta:
					currentSummary.bounceCount - previousSummary.bounceCount,
			};
		})
		.sort((leftComparison, rightComparison) => {
			if (
				leftComparison.projectedPointsDelta !==
				rightComparison.projectedPointsDelta
			) {
				return (
					rightComparison.projectedPointsDelta -
					leftComparison.projectedPointsDelta
				);
			}

			if (leftComparison.donePointsDelta !== rightComparison.donePointsDelta) {
				return rightComparison.donePointsDelta - leftComparison.donePointsDelta;
			}

			return leftComparison.developer.localeCompare(rightComparison.developer);
		});
}
