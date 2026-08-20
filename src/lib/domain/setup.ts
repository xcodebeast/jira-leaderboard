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

function normalizedDisplayName(name: string): string {
	return name.trim().toLocaleLowerCase();
}

function uniqueFieldsByName(
	fields: JiraField[],
	preferredIdentifiers: string[],
): JiraField[] {
	const preferredIdentifierRanks = new Map(
		preferredIdentifiers.map((identifier, index) => [identifier, index]),
	);
	const fieldsByName = new Map<string, JiraField>();

	for (const field of fields) {
		const normalizedName = normalizedDisplayName(field.name);
		const existingField = fieldsByName.get(normalizedName);
		if (!existingField) {
			fieldsByName.set(normalizedName, field);
			continue;
		}

		const existingRank = preferredIdentifierRanks.get(existingField.identifier);
		const candidateRank = preferredIdentifierRanks.get(field.identifier);
		if (
			candidateRank !== undefined &&
			(existingRank === undefined || candidateRank < existingRank)
		) {
			fieldsByName.set(normalizedName, field);
		}
	}

	return [...fieldsByName.values()].sort((leftField, rightField) =>
		leftField.name.localeCompare(rightField.name),
	);
}

function uniqueStatusesByName(statuses: JiraStatus[]): JiraStatus[] {
	const statusesByName = new Map<string, JiraStatus>();
	for (const status of statuses) {
		const existingStatus = statusesByName.get(status.name);
		if (
			!existingStatus ||
			status.identifier.localeCompare(existingStatus.identifier) < 0
		) {
			statusesByName.set(status.name, status);
		}
	}

	return [...statusesByName.values()].sort((leftStatus, rightStatus) =>
		leftStatus.name.localeCompare(rightStatus.name),
	);
}

export function buildJiraSetupSuggestion(
	board: JiraBoard,
	boardConfiguration: JiraBoardConfiguration,
	allFields: JiraField[],
	allStatuses: JiraStatus[],
	boardProjects: JiraProject[] = [],
	preferredFieldIdentifiers: string[] = [],
): JiraSetupSuggestion {
	const boardStatusIdentifiers = new Set(
		boardConfiguration.boardStatusIdentifiers,
	);
	const boardStatuses = allStatuses.filter((status) =>
		boardStatusIdentifiers.has(status.identifier),
	);
	const suggestedStatuses =
		boardStatuses.length > 0 ? boardStatuses : allStatuses;
	const sortedStatuses = uniqueStatusesByName(allStatuses);
	const sortedProjects = [...boardProjects].sort((leftProject, rightProject) =>
		leftProject.name.localeCompare(rightProject.name),
	);

	const fields = {
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
	};

	return {
		board,
		fields,
		statuses: {
			done: selectStatusName(
				defaultStatusMapping.done,
				boardConfiguration.doneColumnStatusIdentifiers,
				suggestedStatuses,
			),
			qualityAssurance: selectStatusName(
				defaultStatusMapping.qualityAssurance,
				[],
				suggestedStatuses,
			),
			readyForQualityAssurance: selectStatusName(
				defaultStatusMapping.readyForQualityAssurance,
				[],
				suggestedStatuses,
			),
		},
		defaultProjectKey: sortedProjects.length === 1 ? sortedProjects[0].key : "",
		availableFields: uniqueFieldsByName(
			allFields,
			[...preferredFieldIdentifiers, ...Object.values(fields)].filter(Boolean),
		),
		availableProjects: sortedProjects,
		availableStatuses: sortedStatuses,
	};
}

export function buildQualityAssuranceSetupSuggestion(
	board: JiraBoard,
	boardConfiguration: JiraBoardConfiguration,
	allFields: JiraField[],
	allStatuses: JiraStatus[],
	preferredFieldIdentifiers: string[] = [],
): QualityAssuranceSetupSuggestion {
	const boardStatusIdentifiers = new Set(
		boardConfiguration.boardStatusIdentifiers,
	);
	const boardStatuses = allStatuses.filter((status) =>
		boardStatusIdentifiers.has(status.identifier),
	);
	const suggestedStatuses =
		boardStatuses.length > 0 ? boardStatuses : allStatuses;

	const fields = {
		storyPointsFieldIdentifier: selectFieldIdentifier(
			boardConfiguration.estimationFieldIdentifier,
			["Story Points", "Story point estimate"],
			allFields,
		),
		testerFieldIdentifier: selectFieldIdentifier(null, ["Tester"], allFields),
	};

	return {
		board,
		fields,
		statuses: {
			done: selectStatusName(
				defaultQualityAssuranceStatusMapping.done,
				boardConfiguration.doneColumnStatusIdentifiers,
				suggestedStatuses,
			),
			readyForQualityAssurance: selectStatusName(
				defaultQualityAssuranceStatusMapping.readyForQualityAssurance,
				[],
				suggestedStatuses,
			),
		},
		availableFields: uniqueFieldsByName(
			allFields,
			[...preferredFieldIdentifiers, ...Object.values(fields)].filter(Boolean),
		),
		availableStatuses: uniqueStatusesByName(allStatuses),
	};
}
