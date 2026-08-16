import type {
	JiraFieldMapping,
	QualityAssuranceFieldMapping,
} from "../domain/jira";
import { ClientInputError, requiredString } from "./api";

const fieldIdentifierPattern = /^(?:customfield_\d+|[a-z][a-z0-9_]{1,99})$/i;

function validatedFieldIdentifier(
	object: Record<string, unknown>,
	propertyName: string,
	label: string,
): string {
	const identifier = requiredString(object, propertyName, label, 100);
	if (!fieldIdentifierPattern.test(identifier)) {
		throw new ClientInputError(`Select a valid ${label}.`);
	}

	return identifier;
}

export function parseFieldMapping(
	payload: Record<string, unknown>,
): JiraFieldMapping {
	const value = payload.fieldMapping;
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new ClientInputError(
			"Select the Story Points, Developer, and Bounce Count fields.",
		);
	}
	const mapping = value as Record<string, unknown>;

	return {
		storyPointsFieldIdentifier: validatedFieldIdentifier(
			mapping,
			"storyPointsFieldIdentifier",
			"Story Points field",
		),
		developerFieldIdentifier: validatedFieldIdentifier(
			mapping,
			"developerFieldIdentifier",
			"Developer field",
		),
		bounceCountFieldIdentifier: validatedFieldIdentifier(
			mapping,
			"bounceCountFieldIdentifier",
			"Bounce Count field",
		),
	};
}

export function parseQualityAssuranceFieldMapping(
	payload: Record<string, unknown>,
): QualityAssuranceFieldMapping {
	const value = payload.fieldMapping;
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new ClientInputError("Select the Story Points and Tester fields.");
	}
	const mapping = value as Record<string, unknown>;

	return {
		storyPointsFieldIdentifier: validatedFieldIdentifier(
			mapping,
			"storyPointsFieldIdentifier",
			"Story Points field",
		),
		testerFieldIdentifier: validatedFieldIdentifier(
			mapping,
			"testerFieldIdentifier",
			"Tester field",
		),
	};
}
