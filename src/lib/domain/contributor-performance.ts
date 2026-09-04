import type { ContributorReference } from "./contributor";
import { isSameContributor } from "./contributor";
import type { JiraIssue, JiraQualityAssuranceIssue } from "./jira";

export interface ContributorWorkItem {
	issueKey: string;
	summary: string;
	resolutionDate: string;
	storyPoints: number;
	bounceCount: number;
}

export interface ContributorMonthlyPerformance {
	monthIndex: number;
	shortLabel: string;
	label: string;
	completedPoints: number;
	completedTickets: number;
	bounceCount: number;
}

export interface ContributorPerformanceSummary {
	year: number;
	completedPoints: number;
	completedTickets: number;
	averagePointsPerTicket: number;
	bounceCount: number;
	activeMonths: number;
	bestMonth: ContributorMonthlyPerformance | null;
	monthlyPerformance: ContributorMonthlyPerformance[];
	recentWork: ContributorWorkItem[];
}

const monthLabels = [
	["Jan", "January"],
	["Feb", "February"],
	["Mar", "March"],
	["Apr", "April"],
	["May", "May"],
	["Jun", "June"],
	["Jul", "July"],
	["Aug", "August"],
	["Sep", "September"],
	["Oct", "October"],
	["Nov", "November"],
	["Dec", "December"],
] as const;

function contributorReference(
	displayName: string,
	accountIdentifier?: string,
): ContributorReference {
	return {
		displayName,
		accountIdentifier: accountIdentifier ?? null,
	};
}

export function developmentWorkForContributor(
	issues: JiraIssue[],
	contributor: ContributorReference,
	doneStatus: string,
): ContributorWorkItem[] {
	return issues
		.filter(
			(issue) =>
				issue.statusName === doneStatus &&
				issue.resolutionDate !== null &&
				isSameContributor(
					contributorReference(
						issue.developer,
						issue.developerAccountIdentifier,
					),
					contributor,
				),
		)
		.map((issue) => ({
			issueKey: issue.issueKey,
			summary: issue.summary,
			resolutionDate: issue.resolutionDate ?? "",
			storyPoints: issue.storyPoints ?? 0,
			bounceCount: issue.bounceCount,
		}));
}

export function qualityAssuranceWorkForContributor(
	issues: JiraQualityAssuranceIssue[],
	contributor: ContributorReference,
	doneStatus: string,
): ContributorWorkItem[] {
	return issues
		.filter(
			(issue) =>
				issue.statusName === doneStatus &&
				issue.resolutionDate !== undefined &&
				isSameContributor(
					contributorReference(issue.tester, issue.testerAccountIdentifier),
					contributor,
				),
		)
		.map((issue) => ({
			issueKey: issue.issueKey,
			summary: issue.summary,
			resolutionDate: issue.resolutionDate ?? "",
			storyPoints: issue.storyPoints ?? 0,
			bounceCount: 0,
		}));
}

function monthIndexForResolutionDate(
	resolutionDate: string,
	year: number,
): number | null {
	const dateMatch = /^(\d{4})-(\d{2})-\d{2}/.exec(resolutionDate);
	if (!dateMatch || Number(dateMatch[1]) !== year) {
		return null;
	}

	const monthIndex = Number(dateMatch[2]) - 1;
	return monthIndex >= 0 && monthIndex < 12 ? monthIndex : null;
}

export function summarizeContributorPerformance(
	workItems: ContributorWorkItem[],
	year: number,
): ContributorPerformanceSummary {
	const monthlyPerformance = monthLabels.map(
		([shortLabel, label], monthIndex): ContributorMonthlyPerformance => ({
			monthIndex,
			shortLabel,
			label,
			completedPoints: 0,
			completedTickets: 0,
			bounceCount: 0,
		}),
	);
	const workInSelectedYear: ContributorWorkItem[] = [];

	for (const workItem of workItems) {
		const monthIndex = monthIndexForResolutionDate(
			workItem.resolutionDate,
			year,
		);
		if (monthIndex === null) {
			continue;
		}

		const month = monthlyPerformance[monthIndex];
		month.completedPoints += workItem.storyPoints;
		month.completedTickets += 1;
		month.bounceCount += workItem.bounceCount;
		workInSelectedYear.push(workItem);
	}

	const completedPoints = monthlyPerformance.reduce(
		(total, month) => total + month.completedPoints,
		0,
	);
	const completedTickets = monthlyPerformance.reduce(
		(total, month) => total + month.completedTickets,
		0,
	);
	const bounceCount = monthlyPerformance.reduce(
		(total, month) => total + month.bounceCount,
		0,
	);
	const activeMonths = monthlyPerformance.filter(
		(month) => month.completedTickets > 0,
	).length;
	const bestMonth =
		monthlyPerformance
			.filter((month) => month.completedTickets > 0)
			.sort((leftMonth, rightMonth) => {
				if (leftMonth.completedPoints !== rightMonth.completedPoints) {
					return rightMonth.completedPoints - leftMonth.completedPoints;
				}
				if (leftMonth.completedTickets !== rightMonth.completedTickets) {
					return rightMonth.completedTickets - leftMonth.completedTickets;
				}

				return leftMonth.monthIndex - rightMonth.monthIndex;
			})[0] ?? null;

	return {
		year,
		completedPoints,
		completedTickets,
		averagePointsPerTicket:
			completedTickets === 0 ? 0 : completedPoints / completedTickets,
		bounceCount,
		activeMonths,
		bestMonth,
		monthlyPerformance,
		recentWork: [...workInSelectedYear]
			.sort((leftWorkItem, rightWorkItem) => {
				const dateDifference = rightWorkItem.resolutionDate.localeCompare(
					leftWorkItem.resolutionDate,
				);
				return (
					dateDifference ||
					rightWorkItem.issueKey.localeCompare(leftWorkItem.issueKey)
				);
			})
			.slice(0, 8),
	};
}
