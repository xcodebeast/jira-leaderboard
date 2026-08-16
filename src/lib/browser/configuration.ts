import type {
	JiraFieldMapping,
	QualityAssuranceFieldMapping,
	QualityAssuranceStatusMapping,
	SprintStatusMapping,
} from "../domain/jira";

export interface QualityAssuranceConfiguration {
	boardIdentifier: number;
	boardName: string;
	fieldMapping: QualityAssuranceFieldMapping;
	statusMapping: QualityAssuranceStatusMapping;
}

export interface AppConfiguration {
	version: 2;
	boardIdentifier: number;
	boardName: string;
	fieldMapping: JiraFieldMapping;
	statusMapping: SprintStatusMapping;
	defaultProjectKey: string;
	qualityAssurance: QualityAssuranceConfiguration | null;
}

interface DevelopmentConfigurationValues {
	boardIdentifier: number;
	boardName: string;
	fieldMapping: JiraFieldMapping;
	statusMapping: SprintStatusMapping;
	defaultProjectKey: string;
}

const configurationStorageKey = "jiraLeaderboard.configuration.v2";
const legacyConfigurationStorageKey = "jiraLeaderboard.configuration.v1";
const rememberedJiraSiteStorageKey = "jiraLeaderboard.lastJiraSiteUrl";

function objectValue(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
	return Number.isSafeInteger(value) && Number(value) > 0;
}

function parseDevelopmentConfiguration(
	configuration: Record<string, unknown>,
): DevelopmentConfigurationValues | null {
	const fieldMapping = objectValue(configuration.fieldMapping);
	const statusMapping = objectValue(configuration.statusMapping);
	if (
		!isPositiveInteger(configuration.boardIdentifier) ||
		!isNonEmptyString(configuration.boardName) ||
		!fieldMapping ||
		!isNonEmptyString(fieldMapping.storyPointsFieldIdentifier) ||
		!isNonEmptyString(fieldMapping.developerFieldIdentifier) ||
		!isNonEmptyString(fieldMapping.bounceCountFieldIdentifier) ||
		!statusMapping ||
		!isNonEmptyString(statusMapping.done) ||
		!isNonEmptyString(statusMapping.qualityAssurance) ||
		!isNonEmptyString(statusMapping.readyForQualityAssurance) ||
		!isNonEmptyString(configuration.defaultProjectKey)
	) {
		return null;
	}

	return {
		boardIdentifier: configuration.boardIdentifier,
		boardName: configuration.boardName,
		fieldMapping: {
			storyPointsFieldIdentifier: fieldMapping.storyPointsFieldIdentifier,
			developerFieldIdentifier: fieldMapping.developerFieldIdentifier,
			bounceCountFieldIdentifier: fieldMapping.bounceCountFieldIdentifier,
		},
		statusMapping: {
			done: statusMapping.done,
			qualityAssurance: statusMapping.qualityAssurance,
			readyForQualityAssurance: statusMapping.readyForQualityAssurance,
		},
		defaultProjectKey: configuration.defaultProjectKey,
	};
}

function parseQualityAssuranceConfiguration(
	value: unknown,
): QualityAssuranceConfiguration | null | undefined {
	if (value === null) {
		return null;
	}
	const configuration = objectValue(value);
	const fieldMapping = objectValue(configuration?.fieldMapping);
	const statusMapping = objectValue(configuration?.statusMapping);
	if (
		!configuration ||
		!isPositiveInteger(configuration.boardIdentifier) ||
		!isNonEmptyString(configuration.boardName) ||
		!fieldMapping ||
		!isNonEmptyString(fieldMapping.storyPointsFieldIdentifier) ||
		!isNonEmptyString(fieldMapping.testerFieldIdentifier) ||
		!statusMapping ||
		!isNonEmptyString(statusMapping.done) ||
		!isNonEmptyString(statusMapping.readyForQualityAssurance) ||
		statusMapping.done === statusMapping.readyForQualityAssurance
	) {
		return undefined;
	}

	return {
		boardIdentifier: configuration.boardIdentifier,
		boardName: configuration.boardName,
		fieldMapping: {
			storyPointsFieldIdentifier: fieldMapping.storyPointsFieldIdentifier,
			testerFieldIdentifier: fieldMapping.testerFieldIdentifier,
		},
		statusMapping: {
			done: statusMapping.done,
			readyForQualityAssurance: statusMapping.readyForQualityAssurance,
		},
	};
}

export function parseStoredConfiguration(
	value: unknown,
): AppConfiguration | null {
	const configuration = objectValue(value);
	if (!configuration) {
		return null;
	}
	const developmentConfiguration = parseDevelopmentConfiguration(configuration);
	if (!developmentConfiguration) {
		return null;
	}

	if (configuration.version === 1) {
		return {
			version: 2,
			...developmentConfiguration,
			qualityAssurance: null,
		};
	}
	if (configuration.version !== 2) {
		return null;
	}
	const qualityAssurance = parseQualityAssuranceConfiguration(
		configuration.qualityAssurance,
	);
	if (qualityAssurance === undefined) {
		return null;
	}

	return {
		version: 2,
		...developmentConfiguration,
		qualityAssurance,
	};
}

function parseJsonConfiguration(
	storedValue: string | null,
): AppConfiguration | null {
	if (!storedValue) {
		return null;
	}
	try {
		return parseStoredConfiguration(JSON.parse(storedValue));
	} catch {
		return null;
	}
}

export function loadConfiguration(): AppConfiguration | null {
	const currentConfiguration = parseJsonConfiguration(
		localStorage.getItem(configurationStorageKey),
	);
	if (currentConfiguration) {
		return currentConfiguration;
	}

	const migratedConfiguration = parseJsonConfiguration(
		localStorage.getItem(legacyConfigurationStorageKey),
	);
	if (migratedConfiguration) {
		saveConfiguration(migratedConfiguration);
		localStorage.removeItem(legacyConfigurationStorageKey);
	}
	return migratedConfiguration;
}

export function saveConfiguration(configuration: AppConfiguration): void {
	localStorage.setItem(configurationStorageKey, JSON.stringify(configuration));
}

export function loadRememberedJiraSiteUrl(
	storage: Pick<Storage, "getItem"> = localStorage,
): string {
	return storage.getItem(rememberedJiraSiteStorageKey)?.trim() ?? "";
}

export function saveRememberedJiraSiteUrl(
	jiraSiteUrl: string,
	storage: Pick<Storage, "setItem"> = localStorage,
): void {
	storage.setItem(rememberedJiraSiteStorageKey, jiraSiteUrl);
}

export function clearConfiguration(): void {
	localStorage.removeItem(configurationStorageKey);
	localStorage.removeItem(legacyConfigurationStorageKey);
	localStorage.removeItem(rememberedJiraSiteStorageKey);
}
