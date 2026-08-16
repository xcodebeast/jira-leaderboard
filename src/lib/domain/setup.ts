import {
	defaultQualityAssuranceStatusMapping,
	defaultStatusMapping,
	type JiraBoard,
	type JiraField,
	type JiraFieldMapping,
	type JiraProject,
	type JiraStatus,
	type QualityAssuranceFieldMapping,
	type QualityAssuranceStatusMapping,
	type SprintStatusMapping,
} from "./jira";

export interface JiraBoardConfiguration {
	boardIdentifier: number;
	boardName: string;
	boardStatusIdentifiers: string[];
	doneColumnStatusIdentifiers: string[];
	estimationFieldIdentifier: string | null;
}

export interface JiraSetupSuggestion {
	board: JiraBoard;
	fields: JiraFieldMapping;
	statuses: SprintStatusMapping;
	defaultProjectKey: string;
	availableFields: JiraField[];
	availableProjects: JiraProject[];
	availableStatuses: JiraStatus[];
}

export interface QualityAssuranceSetupSuggestion {
	board: JiraBoard;
	fields: QualityAssuranceFieldMapping;
	statuses: QualityAssuranceStatusMapping;
	availableFields: JiraField[];
	availableStatuses: JiraStatus[];
}

function selectFieldIdentifier(
	preferredIdentifier: string | null,
	preferredNames: string[],
	fields: JiraField[],
): string {
	if (
		preferredIdentifier &&
		fields.some((field) => field.identifier === preferredIdentifier)
	) {
		return preferredIdentifier;
	}
	const namedField = fields.find((field) =>
		preferredNames.some(
			(preferredName) =>
				preferredName.toLocaleLowerCase() === field.name.toLocaleLowerCase(),
		),
	);
	return namedField?.identifier ?? "";
}

function selectStatusName(
	preferredName: string,
	fallbackIdentifiers: string[],
	statuses: JiraStatus[],
): string {
	const exactMatch = statuses.find(
		(status) =>
			status.name.toLocaleLowerCase() === preferredName.toLocaleLowerCase(),
	);
	if (exactMatch) {
		return exactMatch.name;
	}

	const fallbackMatch = fallbackIdentifiers
		.map((identifier) =>
			statuses.find((status) => status.identifier === identifier),
		)
		.find((status) => status !== undefined);
	if (fallbackMatch) {
		return fallbackMatch.name;
	}

	return (
		statuses.find((status) =>
			status.name
				.toLocaleLowerCase()
				.includes(preferredName.toLocaleLowerCase()),
		)?.name ?? preferredName
	);
}

export function buildJiraSetupSuggestion(
	board: JiraBoard,
	boardConfiguration: JiraBoardConfiguration,
	allFields: JiraField[],
	allStatuses: JiraStatus[],
	boardProjects: JiraProject[] = [],
): JiraSetupSuggestion {
	const boardStatusIdentifiers = new Set(
		boardConfiguration.boardStatusIdentifiers,
	);
	const boardStatuses = allStatuses.filter((status) =>
		boardStatusIdentifiers.has(status.identifier),
	);
	const availableStatuses =
		boardStatuses.length > 0 ? boardStatuses : allStatuses;
	const sortedFields = [...allFields].sort((leftField, rightField) =>
		leftField.name.localeCompare(rightField.name),
	);
	const sortedStatuses = [...availableStatuses].sort(
		(leftStatus, rightStatus) =>
			leftStatus.name.localeCompare(rightStatus.name),
	);
	const sortedProjects = [...boardProjects].sort((leftProject, rightProject) =>
		leftProject.name.localeCompare(rightProject.name),
	);

	return {
		board,
		fields: {
			storyPointsFieldIdentifier: selectFieldIdentifier(
				boardConfiguration.estimationFieldIdentifier,
				["Story Points", "Story point estimate"],
				allFields,
			),
			developerFieldIdentifier: selectFieldIdentifier(
				null,
				["Developer"],
				allFields,
			),
			bounceCountFieldIdentifier: selectFieldIdentifier(
				null,
				["Bounce Count"],
				allFields,
			),
		},
		statuses: {
			done: selectStatusName(
				defaultStatusMapping.done,
				boardConfiguration.doneColumnStatusIdentifiers,
				availableStatuses,
			),
			qualityAssurance: selectStatusName(
				defaultStatusMapping.qualityAssurance,
				[],
				availableStatuses,
			),
			readyForQualityAssurance: selectStatusName(
				defaultStatusMapping.readyForQualityAssurance,
				[],
				availableStatuses,
			),
		},
		defaultProjectKey: sortedProjects.length === 1 ? sortedProjects[0].key : "",
		availableFields: sortedFields,
		availableProjects: sortedProjects,
		availableStatuses: sortedStatuses,
	};
}

export function buildQualityAssuranceSetupSuggestion(
	board: JiraBoard,
	boardConfiguration: JiraBoardConfiguration,
	allFields: JiraField[],
	allStatuses: JiraStatus[],
): QualityAssuranceSetupSuggestion {
	const boardStatusIdentifiers = new Set(
		boardConfiguration.boardStatusIdentifiers,
	);
	const boardStatuses = allStatuses.filter((status) =>
		boardStatusIdentifiers.has(status.identifier),
	);
	const availableStatuses =
		boardStatuses.length > 0 ? boardStatuses : allStatuses;

	return {
		board,
		fields: {
			storyPointsFieldIdentifier: selectFieldIdentifier(
				boardConfiguration.estimationFieldIdentifier,
				["Story Points", "Story point estimate"],
				allFields,
			),
			testerFieldIdentifier: selectFieldIdentifier(null, ["Tester"], allFields),
		},
		statuses: {
			done: selectStatusName(
				defaultQualityAssuranceStatusMapping.done,
				boardConfiguration.doneColumnStatusIdentifiers,
				availableStatuses,
			),
			readyForQualityAssurance: selectStatusName(
				defaultQualityAssuranceStatusMapping.readyForQualityAssurance,
				[],
				availableStatuses,
			),
		},
		availableFields: [...allFields].sort((leftField, rightField) =>
			leftField.name.localeCompare(rightField.name),
		),
		availableStatuses: [...availableStatuses].sort((leftStatus, rightStatus) =>
			leftStatus.name.localeCompare(rightStatus.name),
		),
	};
}
