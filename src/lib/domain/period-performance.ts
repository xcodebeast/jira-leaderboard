import type { JiraIssue } from "./jira";

export interface ResolvedDateRange {
	label: string;
	startDate: string;
	endDate: string;
	endDateExclusive: string;
}

export interface DeveloperResolvedSummary {
	developer: string;
	resolvedPoints: number;
	resolvedTickets: number;
}

export interface DeveloperResolvedComparison {
	developer: string;
	baselinePoints: number;
	comparisonPoints: number;
	pointsDelta: number;
	pointsChange: string;
	baselineTickets: number;
	comparisonTickets: number;
	ticketsDelta: number;
}

interface CalendarDate {
	year: number;
	month: number;
	day: number;
}

function isLeapYear(year: number): boolean {
	return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
	const monthLengths = [
		31,
		isLeapYear(year) ? 29 : 28,
		31,
		30,
		31,
		30,
		31,
		31,
		30,
		31,
		30,
		31,
	];
	return monthLengths[month - 1] ?? 0;
}

function parseCalendarDate(value: string, fieldName: string): CalendarDate {
	const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!dateMatch) {
		throw new Error(`Invalid date for ${fieldName}: ${value}. Use YYYY-MM-DD.`);
	}

	const year = Number(dateMatch[1]);
	const month = Number(dateMatch[2]);
	const day = Number(dateMatch[3]);
	if (
		year < 1 ||
		month < 1 ||
		month > 12 ||
		day < 1 ||
		day > daysInMonth(year, month)
	) {
		throw new Error(`Invalid date for ${fieldName}: ${value}. Use YYYY-MM-DD.`);
	}

	return { year, month, day };
}

function formatCalendarDate(date: CalendarDate): string {
	return `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function nextCalendarDate(date: CalendarDate): CalendarDate {
	if (date.day < daysInMonth(date.year, date.month)) {
		return { ...date, day: date.day + 1 };
	}

	if (date.month < 12) {
		return { year: date.year, month: date.month + 1, day: 1 };
	}

	return { year: date.year + 1, month: 1, day: 1 };
}

export function createResolvedDateRange(
	startDate: string,
	endDate: string,
	label?: string,
): ResolvedDateRange {
	parseCalendarDate(startDate, "range start");
	const parsedEndDate = parseCalendarDate(endDate, "range end");
	if (endDate < startDate) {
		throw new Error(
			`Range end date ${endDate} must be on or after start date ${startDate}`,
		);
	}

	return {
		label: label?.trim() || `${startDate} through ${endDate}`,
		startDate,
		endDate,
		endDateExclusive: formatCalendarDate(nextCalendarDate(parsedEndDate)),
	};
}

export function buildProjectScopeQuery(projectKey: string): string {
	const escapedProjectKey = projectKey
		.replaceAll("\\", "\\\\")
		.replaceAll('"', '\\"');
	return `project = "${escapedProjectKey}"`;
}

export function buildResolvedIssuesQuery(
	scopeQuery: string,
	range: ResolvedDateRange,
): string {
	const conditions = [
		`(${scopeQuery})`,
		"resolution is not EMPTY",
		`resolved >= "${range.startDate}"`,
		`resolved < "${range.endDateExclusive}"`,
	].join(" AND ");
	return `${conditions} ORDER BY resolved ASC, key ASC`;
}

function emptyResolvedSummary(developer: string): DeveloperResolvedSummary {
	return { developer, resolvedPoints: 0, resolvedTickets: 0 };
}

export function summarizeResolvedIssues(
	issues: JiraIssue[],
): DeveloperResolvedSummary[] {
	const summariesByDeveloper = new Map<string, DeveloperResolvedSummary>();

	for (const issue of issues) {
		if (!issue.resolutionDate) {
			continue;
		}

		const summary =
			summariesByDeveloper.get(issue.developer) ??
			emptyResolvedSummary(issue.developer);
		summary.resolvedPoints += issue.storyPoints ?? 0;
		summary.resolvedTickets += 1;
		summariesByDeveloper.set(issue.developer, summary);
	}

	return [...summariesByDeveloper.values()].sort(
		(leftSummary, rightSummary) => {
			if (leftSummary.resolvedPoints !== rightSummary.resolvedPoints) {
				return rightSummary.resolvedPoints - leftSummary.resolvedPoints;
			}

			if (leftSummary.resolvedTickets !== rightSummary.resolvedTickets) {
				return rightSummary.resolvedTickets - leftSummary.resolvedTickets;
			}

			return leftSummary.developer.localeCompare(rightSummary.developer);
		},
	);
}

function normalizeDeveloperName(value: string): string {
	return value
		.trim()
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLocaleLowerCase("en-US");
}

export function filterResolvedSummaries(
	summaries: DeveloperResolvedSummary[],
	developerFilters: string[],
): DeveloperResolvedSummary[] {
	const normalizedFilters = new Set<string>();
	const uniqueFilters = developerFilters.filter((developerFilter) => {
		const normalizedFilter = normalizeDeveloperName(developerFilter);
		if (!normalizedFilter || normalizedFilters.has(normalizedFilter)) {
			return false;
		}

		normalizedFilters.add(normalizedFilter);
		return true;
	});
	if (uniqueFilters.length === 0) {
		return summaries;
	}

	const summariesByDeveloper = new Map(
		summaries.map((summary) => [
			normalizeDeveloperName(summary.developer),
			summary,
		]),
	);
	return uniqueFilters.map((developerFilter) => {
		const trimmedFilter = developerFilter.trim();
		return (
			summariesByDeveloper.get(normalizeDeveloperName(trimmedFilter)) ??
			emptyResolvedSummary(trimmedFilter)
		);
	});
}

function formatPointsChange(
	baselinePoints: number,
	comparisonPoints: number,
): string {
	if (baselinePoints === 0) {
		return comparisonPoints === 0 ? "0.0%" : "New";
	}

	const percentage =
		((comparisonPoints - baselinePoints) / baselinePoints) * 100;
	return `${percentage > 0 ? "+" : ""}${percentage.toFixed(1)}%`;
}

export function compareResolvedSummaries(
	baselineSummaries: DeveloperResolvedSummary[],
	comparisonSummaries: DeveloperResolvedSummary[],
): DeveloperResolvedComparison[] {
	const baselineByDeveloper = new Map(
		baselineSummaries.map((summary) => [summary.developer, summary]),
	);
	const comparisonByDeveloper = new Map(
		comparisonSummaries.map((summary) => [summary.developer, summary]),
	);
	const developers = new Set([
		...baselineByDeveloper.keys(),
		...comparisonByDeveloper.keys(),
	]);

	return [...developers]
		.map((developer) => {
			const baselineSummary =
				baselineByDeveloper.get(developer) ?? emptyResolvedSummary(developer);
			const comparisonSummary =
				comparisonByDeveloper.get(developer) ?? emptyResolvedSummary(developer);
			return {
				developer,
				baselinePoints: baselineSummary.resolvedPoints,
				comparisonPoints: comparisonSummary.resolvedPoints,
				pointsDelta:
					comparisonSummary.resolvedPoints - baselineSummary.resolvedPoints,
				pointsChange: formatPointsChange(
					baselineSummary.resolvedPoints,
					comparisonSummary.resolvedPoints,
				),
				baselineTickets: baselineSummary.resolvedTickets,
				comparisonTickets: comparisonSummary.resolvedTickets,
				ticketsDelta:
					comparisonSummary.resolvedTickets - baselineSummary.resolvedTickets,
			};
		})
		.sort((leftComparison, rightComparison) => {
			if (leftComparison.pointsDelta !== rightComparison.pointsDelta) {
				return rightComparison.pointsDelta - leftComparison.pointsDelta;
			}

			if (
				leftComparison.comparisonPoints !== rightComparison.comparisonPoints
			) {
				return (
					rightComparison.comparisonPoints - leftComparison.comparisonPoints
				);
			}

			return leftComparison.developer.localeCompare(rightComparison.developer);
		});
}

export function totalResolvedSummary(
	developerLabel: string,
	summaries: DeveloperResolvedSummary[],
): DeveloperResolvedSummary {
	return summaries.reduce(
		(total, summary) => ({
			developer: developerLabel,
			resolvedPoints: total.resolvedPoints + summary.resolvedPoints,
			resolvedTickets: total.resolvedTickets + summary.resolvedTickets,
		}),
		emptyResolvedSummary(developerLabel),
	);
}
