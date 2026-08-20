import { json } from "@sveltejs/kit";
import { ClientInputError } from "./client-input";
import { JiraRequestError } from "./jira-client";
import { SessionConfigurationError, SessionRequiredError } from "./session";

export { ClientInputError, optionalCalendarYear } from "./client-input";

export function apiJson(data: unknown, status = 200): Response {
	return json(data, {
		status,
		headers: { "Cache-Control": "no-store" },
	});
}

export function apiErrorResponse(error: unknown): Response {
	if (error instanceof ClientInputError) {
		return apiJson({ message: error.message }, 400);
	}
	if (error instanceof SessionRequiredError) {
		return apiJson({ message: error.message }, 401);
	}
	if (error instanceof SessionConfigurationError) {
		return apiJson({ message: error.message }, 503);
	}
	if (error instanceof JiraRequestError) {
		return apiJson({ message: error.message }, error.statusCode);
	}

	return apiJson(
		{ message: "The server could not complete this request." },
		500,
	);
}

export async function readJsonObject(
	request: Request,
): Promise<Record<string, unknown>> {
	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		throw new ClientInputError("Send a valid JSON request body.");
	}

	if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
		throw new ClientInputError("The request body must be a JSON object.");
	}

	return payload as Record<string, unknown>;
}

export function requiredString(
	object: Record<string, unknown>,
	propertyName: string,
	label: string,
	maximumLength = 500,
): string {
	const value = object[propertyName];
	if (typeof value !== "string" || !value.trim()) {
		throw new ClientInputError(`Enter ${label}.`);
	}
	const trimmedValue = value.trim();
	if (trimmedValue.length > maximumLength) {
		throw new ClientInputError(`${label} is too long.`);
	}

	return trimmedValue;
}

export function requiredPositiveInteger(
	object: Record<string, unknown>,
	propertyName: string,
	label: string,
): number {
	const value = object[propertyName];
	if (!Number.isSafeInteger(value) || Number(value) <= 0) {
		throw new ClientInputError(`Select a valid ${label}.`);
	}

	return Number(value);
}

export function queryPositiveInteger(
	searchParameters: URLSearchParams,
	propertyName: string,
	label: string,
): number {
	const parsedValue = Number(searchParameters.get(propertyName));
	if (!Number.isSafeInteger(parsedValue) || parsedValue <= 0) {
		throw new ClientInputError(`Select a valid ${label}.`);
	}

	return parsedValue;
}

export function queryNonNegativeInteger(
	searchParameters: URLSearchParams,
	propertyName: string,
	label: string,
	defaultValue: number,
): number {
	const rawValue = searchParameters.get(propertyName);
	if (rawValue === null) {
		return defaultValue;
	}
	const parsedValue = Number(rawValue);
	if (!Number.isSafeInteger(parsedValue) || parsedValue < 0) {
		throw new ClientInputError(`Select a valid ${label}.`);
	}

	return parsedValue;
}

export function queryPositiveIntegerWithMaximum(
	searchParameters: URLSearchParams,
	propertyName: string,
	label: string,
	defaultValue: number,
	maximumValue: number,
): number {
	const rawValue = searchParameters.get(propertyName);
	if (rawValue === null) {
		return defaultValue;
	}
	const parsedValue = Number(rawValue);
	if (
		!Number.isSafeInteger(parsedValue) ||
		parsedValue <= 0 ||
		parsedValue > maximumValue
	) {
		throw new ClientInputError(
			`Select a valid ${label} no greater than ${maximumValue}.`,
		);
	}

	return parsedValue;
}
