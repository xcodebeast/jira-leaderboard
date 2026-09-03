import type { LeaderboardScope } from "../domain/all-time-performance";

export class ClientInputError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ClientInputError";
	}
}

export function leaderboardScope(
	object: Record<string, unknown>,
	propertyName: string,
): LeaderboardScope {
	const value = object[propertyName] ?? "board";
	if (value !== "board" && value !== "global") {
		throw new ClientInputError("Select a valid leaderboard scope.");
	}

	return value;
}

export function optionalCalendarYear(
	object: Record<string, unknown>,
	propertyName: string,
	label: string,
): number | null {
	const value = object[propertyName];
	if (value === undefined) {
		return new Date().getUTCFullYear();
	}
	if (value === null) {
		return null;
	}
	if (
		!Number.isSafeInteger(value) ||
		Number(value) < 2000 ||
		Number(value) > 9998
	) {
		throw new ClientInputError(`Select a valid ${label} or all time.`);
	}

	return Number(value);
}
