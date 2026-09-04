export const unassignedDeveloperName = "Unassigned Developer";
export const unassignedTesterName = "Unassigned Tester";

export interface JiraIssue {
	issueKey: string;
	summary: string;
	statusName: string | null;
	resolutionDate: string | null;
	storyPoints: number | null;
	developer: string;
	developerAccountIdentifier?: string;
	bounceCount: number;
}

export interface JiraSprint {
	identifier: number;
	name: string;
	state: string;
	startDate: string | null;
	endDate: string | null;
	completeDate: string | null;
}

export type JiraSprintState = "active" | "closed";

export interface JiraSprintPage {
	sprints: JiraSprint[];
	startAt: number;
	maxResults: number;
	total: number | null;
	isLast: boolean;
	nextStartAt: number | null;
}

export interface JiraBoard {
	identifier: number;
	name: string;
	type: string;
}

export interface JiraProject {
	key: string;
	name: string;
}

export interface JiraField {
	identifier: string;
	name: string;
	custom: boolean | null;
}

export interface JiraStatus {
	identifier: string;
	name: string;
}

export interface JiraFieldMapping {
	storyPointsFieldIdentifier: string;
	developerFieldIdentifier: string;
	bounceCountFieldIdentifier: string;
}

export interface QualityAssuranceFieldMapping {
	storyPointsFieldIdentifier: string;
	testerFieldIdentifier: string;
}

export interface QualityAssuranceStatusMapping {
	done: string;
	readyForQualityAssurance: string;
}

export interface JiraQualityAssuranceIssue {
	issueKey: string;
	summary: string;
	statusName: string | null;
	resolutionDate?: string;
	storyPoints: number | null;
	tester: string;
	testerAccountIdentifier?: string;
}

export interface SprintStatusMapping {
	done: string;
	qualityAssurance: string;
	readyForQualityAssurance: string;
}

export const defaultStatusMapping: SprintStatusMapping = {
	done: "Done",
	qualityAssurance: "QA",
	readyForQualityAssurance: "Ready for QA",
};

export const defaultQualityAssuranceStatusMapping: QualityAssuranceStatusMapping =
	{
		done: "Done",
		readyForQualityAssurance: "Ready for QA",
	};

export function jiraSprintSortTime(sprint: JiraSprint): number {
	const candidateDate =
		sprint.completeDate ?? sprint.endDate ?? sprint.startDate;
	if (!candidateDate) {
		return sprint.identifier;
	}

	const timestamp = Date.parse(candidateDate);
	return Number.isNaN(timestamp) ? sprint.identifier : timestamp;
}

export function sortJiraSprints(sprints: JiraSprint[]): JiraSprint[] {
	return [...sprints].sort((leftSprint, rightSprint) => {
		const leftActive = leftSprint.state === "active";
		const rightActive = rightSprint.state === "active";
		if (leftActive !== rightActive) {
			return leftActive ? -1 : 1;
		}

		return jiraSprintSortTime(rightSprint) - jiraSprintSortTime(leftSprint);
	});
}

export function mergeJiraSprints(
	...sprintGroups: JiraSprint[][]
): JiraSprint[] {
	const sprintsByIdentifier = new Map<number, JiraSprint>();
	for (const sprint of sprintGroups.flat()) {
		sprintsByIdentifier.set(sprint.identifier, sprint);
	}

	return sortJiraSprints([...sprintsByIdentifier.values()]);
}

export function findPreviousClosedSprint(
	currentSprint: JiraSprint,
	sprints: JiraSprint[],
): JiraSprint | null {
	const candidates = sprints.filter((sprint) => {
		if (
			sprint.state !== "closed" ||
			sprint.identifier === currentSprint.identifier
		) {
			return false;
		}

		return (
			currentSprint.state !== "closed" ||
			jiraSprintSortTime(sprint) < jiraSprintSortTime(currentSprint)
		);
	});

	return (
		candidates.sort(
			(leftSprint, rightSprint) =>
				jiraSprintSortTime(rightSprint) - jiraSprintSortTime(leftSprint),
		)[0] ?? null
	);
}
