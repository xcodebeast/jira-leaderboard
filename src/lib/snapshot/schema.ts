export const SHARED_SNAPSHOT_VERSION = 1 as const;

export const SHARED_SNAPSHOT_LIMITS = {
	maximumJsonBytes: 512 * 1024,
	maximumCollectionItems: 20_000,
	maximumEntriesPerLeaderboard: 5_000,
	maximumSummariesPerReport: 5_000,
	maximumTicketsPerContributor: 2_000,
	maximumNameCharacters: 256,
	maximumLabelCharacters: 512,
	maximumIssueKeyCharacters: 128,
	maximumIssueSummaryCharacters: 2_000,
	maximumNumericMagnitude: 1_000_000_000_000,
} as const;

export type SharedSnapshotKind = "sprint" | "leaderboard" | "period-comparison";

export interface SharedSprintReference {
	name: string;
	state: "active" | "closed";
	startDate: string | null;
	endDate: string | null;
}

export interface SharedSprintTicket {
	issueKey: string;
	summary: string;
	status: string;
}

export interface SharedDeveloperSprintSummary {
	developer: string;
	donePoints: number;
	qualityAssurancePoints: number;
	readyForQualityAssurancePoints: number;
	bounceCount: number;
	tickets: SharedSprintTicket[];
}

export interface SharedDeveloperSprintComparison {
	developer: string;
	donePointsDelta: number;
	qualityAssurancePointsDelta: number;
	readyForQualityAssurancePointsDelta: number;
	projectedPointsDelta: number;
	bounceCountDelta: number;
}

export interface SharedQualityAssuranceSprintTicket {
	issueKey: string;
	summary: string;
	status: string;
}

export interface SharedTesterSprintSummary {
	tester: string;
	doneStoryPoints: number;
	doneTicketCount: number;
	readyForQualityAssuranceStoryPoints: number;
	readyForQualityAssuranceTicketCount: number;
	tickets: SharedQualityAssuranceSprintTicket[];
}

export interface SharedSprintSnapshot {
	version: typeof SHARED_SNAPSHOT_VERSION;
	kind: "sprint";
	capturedAt: string;
	report: {
		sprint: SharedSprintReference;
		comparisonSprint: SharedSprintReference | null;
		activeScoreboard: "development" | "qualityAssurance";
		development: {
			sourceLabel: string;
			summaries: SharedDeveloperSprintSummary[];
			comparisons: SharedDeveloperSprintComparison[];
		};
		qualityAssurance: {
			sourceLabel: string;
			summaries: SharedTesterSprintSummary[];
		} | null;
	};
}

export interface SharedAllTimeLeaderboardEntry {
	contributor: string;
	completedPoints: number;
	completedTickets: number;
}

export interface SharedLeaderboardSnapshot {
	version: typeof SHARED_SNAPSHOT_VERSION;
	kind: "leaderboard";
	capturedAt: string;
	report: {
		period: {
			label: string;
			year: number | null;
		};
		scope: "board" | "global";
		scopeLabel: string;
		development: {
			sourceLabel: string;
			entries: SharedAllTimeLeaderboardEntry[];
		};
		qualityAssurance: {
			sourceLabel: string;
			entries: SharedAllTimeLeaderboardEntry[];
		} | null;
	};
}

export interface SharedDeveloperResolvedComparison {
	developer: string;
	baselinePoints: number;
	comparisonPoints: number;
	pointsDelta: number;
	pointsChange: string;
	baselineTickets: number;
	comparisonTickets: number;
	ticketsDelta: number;
}

export interface SharedPeriodComparisonSnapshot {
	version: typeof SHARED_SNAPSHOT_VERSION;
	kind: "period-comparison";
	capturedAt: string;
	report: {
		scopeLabel: string;
		baseline: {
			label: string;
			startDate: string;
			endDate: string;
		};
		comparison: {
			label: string;
			startDate: string;
			endDate: string;
		};
		comparisons: SharedDeveloperResolvedComparison[];
		totalComparison: SharedDeveloperResolvedComparison;
	};
}

export type SharedSnapshot =
	| SharedSprintSnapshot
	| SharedLeaderboardSnapshot
	| SharedPeriodComparisonSnapshot;

export type SharedSnapshotValidationErrorCode =
	| "invalid_snapshot"
	| "unsupported_version"
	| "limit_exceeded";

export class SharedSnapshotValidationError extends Error {
	readonly code: SharedSnapshotValidationErrorCode;
	readonly path: string;

	constructor(
		code: SharedSnapshotValidationErrorCode,
		path: string,
		message: string,
	) {
		super(`${path}: ${message}`);
		this.name = "SharedSnapshotValidationError";
		this.code = code;
		this.path = path;
	}
}

interface ValidationBudget {
	collectionItems: number;
}

function validationFailure(
	code: SharedSnapshotValidationErrorCode,
	path: string,
	message: string,
): never {
	throw new SharedSnapshotValidationError(code, path, message);
}

function expectRecord(
	value: unknown,
	path: string,
	expectedKeys: readonly string[],
): Record<string, unknown> {
	if (
		typeof value !== "object" ||
		value === null ||
		Array.isArray(value) ||
		(Object.getPrototypeOf(value) !== Object.prototype &&
			Object.getPrototypeOf(value) !== null)
	) {
		return validationFailure(
			"invalid_snapshot",
			path,
			"must be a plain object",
		);
	}

	const record = value as Record<string, unknown>;
	const expectedKeySet = new Set(expectedKeys);
	for (const actualKey of Object.keys(record)) {
		if (!expectedKeySet.has(actualKey)) {
			validationFailure(
				"invalid_snapshot",
				`${path}.${actualKey}`,
				"is not part of the share-safe snapshot contract",
			);
		}
	}
	for (const expectedKey of expectedKeys) {
		if (!Object.hasOwn(record, expectedKey)) {
			validationFailure(
				"invalid_snapshot",
				`${path}.${expectedKey}`,
				"is required",
			);
		}
	}
	return record;
}

function expectString(
	value: unknown,
	path: string,
	maximumCharacters: number,
	allowEmpty = false,
): string {
	if (typeof value !== "string" || (!allowEmpty && value.length === 0)) {
		return validationFailure(
			"invalid_snapshot",
			path,
			allowEmpty ? "must be a string" : "must be a non-empty string",
		);
	}
	if (value.length > maximumCharacters) {
		return validationFailure(
			"limit_exceeded",
			path,
			`must contain at most ${maximumCharacters} characters`,
		);
	}
	return value;
}

function expectNumber(
	value: unknown,
	path: string,
	options: { integer?: boolean; nonNegative?: boolean } = {},
): number {
	if (
		typeof value !== "number" ||
		!Number.isFinite(value) ||
		Math.abs(value) > SHARED_SNAPSHOT_LIMITS.maximumNumericMagnitude
	) {
		return validationFailure(
			"invalid_snapshot",
			path,
			`must be a finite number with an absolute value no greater than ${SHARED_SNAPSHOT_LIMITS.maximumNumericMagnitude}`,
		);
	}
	if (options.integer && !Number.isInteger(value)) {
		return validationFailure("invalid_snapshot", path, "must be an integer");
	}
	if (options.nonNegative && value < 0) {
		return validationFailure("invalid_snapshot", path, "must not be negative");
	}
	return value;
}

function expectArray(
	value: unknown,
	path: string,
	maximumItems: number,
	budget: ValidationBudget,
): unknown[] {
	if (!Array.isArray(value)) {
		return validationFailure("invalid_snapshot", path, "must be an array");
	}
	if (value.length > maximumItems) {
		return validationFailure(
			"limit_exceeded",
			path,
			`must contain at most ${maximumItems} items`,
		);
	}
	budget.collectionItems += value.length;
	if (budget.collectionItems > SHARED_SNAPSHOT_LIMITS.maximumCollectionItems) {
		return validationFailure(
			"limit_exceeded",
			path,
			`the snapshot must contain at most ${SHARED_SNAPSHOT_LIMITS.maximumCollectionItems} collection items in total`,
		);
	}
	return value;
}

function expectUniqueStringField(
	items: unknown[],
	path: string,
	fieldName: string,
): void {
	const values = new Set<string>();
	for (let index = 0; index < items.length; index += 1) {
		const item = items[index] as Record<string, unknown>;
		const value = item[fieldName] as string;
		if (values.has(value)) {
			validationFailure(
				"invalid_snapshot",
				`${path}[${index}].${fieldName}`,
				`duplicates ${fieldName} ${JSON.stringify(value)}`,
			);
		}
		values.add(value);
	}
}

function expectLiteral<LiteralValue extends string>(
	value: unknown,
	path: string,
	allowedValues: readonly LiteralValue[],
): LiteralValue {
	if (
		typeof value !== "string" ||
		!allowedValues.includes(value as LiteralValue)
	) {
		return validationFailure(
			"invalid_snapshot",
			path,
			`must be one of: ${allowedValues.join(", ")}`,
		);
	}
	return value as LiteralValue;
}

function expectCapturedAt(value: unknown, path: string): string {
	const capturedAt = expectString(value, path, 64);
	const capturedTime = Date.parse(capturedAt);
	if (
		Number.isNaN(capturedTime) ||
		new Date(capturedTime).toISOString() !== capturedAt
	) {
		return validationFailure(
			"invalid_snapshot",
			path,
			"must be an ISO 8601 UTC timestamp",
		);
	}
	return capturedAt;
}

function expectCalendarDate(value: unknown, path: string): string {
	const calendarDate = expectString(value, path, 10);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(calendarDate)) {
		return validationFailure(
			"invalid_snapshot",
			path,
			"must use the YYYY-MM-DD format",
		);
	}
	const timestamp = Date.parse(`${calendarDate}T00:00:00.000Z`);
	if (
		Number.isNaN(timestamp) ||
		new Date(timestamp).toISOString().slice(0, 10) !== calendarDate
	) {
		return validationFailure(
			"invalid_snapshot",
			path,
			"must be a valid calendar date",
		);
	}
	return calendarDate;
}

function expectNullableTimestamp(value: unknown, path: string): string | null {
	if (value === null) {
		return null;
	}
	const timestamp = expectString(value, path, 64);
	if (Number.isNaN(Date.parse(timestamp))) {
		return validationFailure(
			"invalid_snapshot",
			path,
			"must be a valid timestamp or null",
		);
	}
	return timestamp;
}

function validateSprintReference(value: unknown, path: string): void {
	const sprint = expectRecord(value, path, [
		"name",
		"state",
		"startDate",
		"endDate",
	]);
	expectString(
		sprint.name,
		`${path}.name`,
		SHARED_SNAPSHOT_LIMITS.maximumNameCharacters,
	);
	expectLiteral(sprint.state, `${path}.state`, ["active", "closed"]);
	expectNullableTimestamp(sprint.startDate, `${path}.startDate`);
	expectNullableTimestamp(sprint.endDate, `${path}.endDate`);
}

function validateSprintTicket(value: unknown, path: string): void {
	const ticket = expectRecord(value, path, ["issueKey", "summary", "status"]);
	expectString(
		ticket.issueKey,
		`${path}.issueKey`,
		SHARED_SNAPSHOT_LIMITS.maximumIssueKeyCharacters,
	);
	expectString(
		ticket.summary,
		`${path}.summary`,
		SHARED_SNAPSHOT_LIMITS.maximumIssueSummaryCharacters,
		true,
	);
	expectString(
		ticket.status,
		`${path}.status`,
		SHARED_SNAPSHOT_LIMITS.maximumNameCharacters,
	);
}

function validateDeveloperSprintSummary(
	value: unknown,
	path: string,
	budget: ValidationBudget,
): void {
	const summary = expectRecord(value, path, [
		"developer",
		"donePoints",
		"qualityAssurancePoints",
		"readyForQualityAssurancePoints",
		"bounceCount",
		"tickets",
	]);
	expectString(
		summary.developer,
		`${path}.developer`,
		SHARED_SNAPSHOT_LIMITS.maximumNameCharacters,
	);
	expectNumber(summary.donePoints, `${path}.donePoints`, {
		nonNegative: true,
	});
	expectNumber(
		summary.qualityAssurancePoints,
		`${path}.qualityAssurancePoints`,
		{ nonNegative: true },
	);
	expectNumber(
		summary.readyForQualityAssurancePoints,
		`${path}.readyForQualityAssurancePoints`,
		{ nonNegative: true },
	);
	expectNumber(summary.bounceCount, `${path}.bounceCount`, {
		integer: true,
		nonNegative: true,
	});
	const tickets = expectArray(
		summary.tickets,
		`${path}.tickets`,
		SHARED_SNAPSHOT_LIMITS.maximumTicketsPerContributor,
		budget,
	);
	for (const [index, ticket] of tickets.entries()) {
		validateSprintTicket(ticket, `${path}.tickets[${index}]`);
	}
	expectUniqueStringField(tickets, `${path}.tickets`, "issueKey");
}

function validateDeveloperSprintComparison(value: unknown, path: string): void {
	const comparison = expectRecord(value, path, [
		"developer",
		"donePointsDelta",
		"qualityAssurancePointsDelta",
		"readyForQualityAssurancePointsDelta",
		"projectedPointsDelta",
		"bounceCountDelta",
	]);
	expectString(
		comparison.developer,
		`${path}.developer`,
		SHARED_SNAPSHOT_LIMITS.maximumNameCharacters,
	);
	expectNumber(comparison.donePointsDelta, `${path}.donePointsDelta`);
	expectNumber(
		comparison.qualityAssurancePointsDelta,
		`${path}.qualityAssurancePointsDelta`,
	);
	expectNumber(
		comparison.readyForQualityAssurancePointsDelta,
		`${path}.readyForQualityAssurancePointsDelta`,
	);
	expectNumber(comparison.projectedPointsDelta, `${path}.projectedPointsDelta`);
	expectNumber(comparison.bounceCountDelta, `${path}.bounceCountDelta`, {
		integer: true,
	});
}

function validateTesterSprintSummary(
	value: unknown,
	path: string,
	budget: ValidationBudget,
): void {
	const summary = expectRecord(value, path, [
		"tester",
		"doneStoryPoints",
		"doneTicketCount",
		"readyForQualityAssuranceStoryPoints",
		"readyForQualityAssuranceTicketCount",
		"tickets",
	]);
	expectString(
		summary.tester,
		`${path}.tester`,
		SHARED_SNAPSHOT_LIMITS.maximumNameCharacters,
	);
	expectNumber(summary.doneStoryPoints, `${path}.doneStoryPoints`, {
		nonNegative: true,
	});
	expectNumber(summary.doneTicketCount, `${path}.doneTicketCount`, {
		integer: true,
		nonNegative: true,
	});
	expectNumber(
		summary.readyForQualityAssuranceStoryPoints,
		`${path}.readyForQualityAssuranceStoryPoints`,
		{ nonNegative: true },
	);
	expectNumber(
		summary.readyForQualityAssuranceTicketCount,
		`${path}.readyForQualityAssuranceTicketCount`,
		{ integer: true, nonNegative: true },
	);
	const tickets = expectArray(
		summary.tickets,
		`${path}.tickets`,
		SHARED_SNAPSHOT_LIMITS.maximumTicketsPerContributor,
		budget,
	);
	for (const [index, ticket] of tickets.entries()) {
		validateSprintTicket(ticket, `${path}.tickets[${index}]`);
	}
	expectUniqueStringField(tickets, `${path}.tickets`, "issueKey");
}

function validateSprintSnapshotReport(
	value: unknown,
	budget: ValidationBudget,
): void {
	const report = expectRecord(value, "snapshot.report", [
		"sprint",
		"comparisonSprint",
		"activeScoreboard",
		"development",
		"qualityAssurance",
	]);
	validateSprintReference(report.sprint, "snapshot.report.sprint");
	if (report.comparisonSprint !== null) {
		validateSprintReference(
			report.comparisonSprint,
			"snapshot.report.comparisonSprint",
		);
	}
	expectLiteral(report.activeScoreboard, "snapshot.report.activeScoreboard", [
		"development",
		"qualityAssurance",
	]);
	const development = expectRecord(
		report.development,
		"snapshot.report.development",
		["sourceLabel", "summaries", "comparisons"],
	);
	expectString(
		development.sourceLabel,
		"snapshot.report.development.sourceLabel",
		SHARED_SNAPSHOT_LIMITS.maximumLabelCharacters,
	);
	const developmentSummaries = expectArray(
		development.summaries,
		"snapshot.report.development.summaries",
		SHARED_SNAPSHOT_LIMITS.maximumSummariesPerReport,
		budget,
	);
	for (const [index, summary] of developmentSummaries.entries()) {
		validateDeveloperSprintSummary(
			summary,
			`snapshot.report.development.summaries[${index}]`,
			budget,
		);
	}
	expectUniqueStringField(
		developmentSummaries,
		"snapshot.report.development.summaries",
		"developer",
	);
	const developmentComparisons = expectArray(
		development.comparisons,
		"snapshot.report.development.comparisons",
		SHARED_SNAPSHOT_LIMITS.maximumSummariesPerReport,
		budget,
	);
	for (const [index, comparison] of developmentComparisons.entries()) {
		validateDeveloperSprintComparison(
			comparison,
			`snapshot.report.development.comparisons[${index}]`,
		);
	}
	expectUniqueStringField(
		developmentComparisons,
		"snapshot.report.development.comparisons",
		"developer",
	);
	if (report.qualityAssurance === null) {
		return;
	}
	const qualityAssurance = expectRecord(
		report.qualityAssurance,
		"snapshot.report.qualityAssurance",
		["sourceLabel", "summaries"],
	);
	expectString(
		qualityAssurance.sourceLabel,
		"snapshot.report.qualityAssurance.sourceLabel",
		SHARED_SNAPSHOT_LIMITS.maximumLabelCharacters,
	);
	const qualityAssuranceSummaries = expectArray(
		qualityAssurance.summaries,
		"snapshot.report.qualityAssurance.summaries",
		SHARED_SNAPSHOT_LIMITS.maximumSummariesPerReport,
		budget,
	);
	for (const [index, summary] of qualityAssuranceSummaries.entries()) {
		validateTesterSprintSummary(
			summary,
			`snapshot.report.qualityAssurance.summaries[${index}]`,
			budget,
		);
	}
	expectUniqueStringField(
		qualityAssuranceSummaries,
		"snapshot.report.qualityAssurance.summaries",
		"tester",
	);
}

function validateLeaderboardEntry(value: unknown, path: string): void {
	const entry = expectRecord(value, path, [
		"contributor",
		"completedPoints",
		"completedTickets",
	]);
	expectString(
		entry.contributor,
		`${path}.contributor`,
		SHARED_SNAPSHOT_LIMITS.maximumNameCharacters,
	);
	expectNumber(entry.completedPoints, `${path}.completedPoints`, {
		nonNegative: true,
	});
	expectNumber(entry.completedTickets, `${path}.completedTickets`, {
		integer: true,
		nonNegative: true,
	});
}

function validateLeaderboardGroup(
	value: unknown,
	path: string,
	budget: ValidationBudget,
): void {
	const group = expectRecord(value, path, ["sourceLabel", "entries"]);
	expectString(
		group.sourceLabel,
		`${path}.sourceLabel`,
		SHARED_SNAPSHOT_LIMITS.maximumLabelCharacters,
	);
	const entries = expectArray(
		group.entries,
		`${path}.entries`,
		SHARED_SNAPSHOT_LIMITS.maximumEntriesPerLeaderboard,
		budget,
	);
	for (const [index, entry] of entries.entries()) {
		validateLeaderboardEntry(entry, `${path}.entries[${index}]`);
	}
	expectUniqueStringField(entries, `${path}.entries`, "contributor");
}

function validateLeaderboardSnapshotReport(
	value: unknown,
	budget: ValidationBudget,
): void {
	const report = expectRecord(value, "snapshot.report", [
		"period",
		"scope",
		"scopeLabel",
		"development",
		"qualityAssurance",
	]);
	const period = expectRecord(report.period, "snapshot.report.period", [
		"label",
		"year",
	]);
	expectString(
		period.label,
		"snapshot.report.period.label",
		SHARED_SNAPSHOT_LIMITS.maximumLabelCharacters,
	);
	if (period.year !== null) {
		const year = expectNumber(period.year, "snapshot.report.period.year", {
			integer: true,
			nonNegative: true,
		});
		if (year < 1900 || year > 9999) {
			validationFailure(
				"invalid_snapshot",
				"snapshot.report.period.year",
				"must be between 1900 and 9999 or null",
			);
		}
	}
	expectLiteral(report.scope, "snapshot.report.scope", ["board", "global"]);
	expectString(
		report.scopeLabel,
		"snapshot.report.scopeLabel",
		SHARED_SNAPSHOT_LIMITS.maximumLabelCharacters,
	);
	validateLeaderboardGroup(
		report.development,
		"snapshot.report.development",
		budget,
	);
	if (report.qualityAssurance !== null) {
		validateLeaderboardGroup(
			report.qualityAssurance,
			"snapshot.report.qualityAssurance",
			budget,
		);
	}
}

function validateResolvedComparison(value: unknown, path: string): void {
	const comparison = expectRecord(value, path, [
		"developer",
		"baselinePoints",
		"comparisonPoints",
		"pointsDelta",
		"pointsChange",
		"baselineTickets",
		"comparisonTickets",
		"ticketsDelta",
	]);
	expectString(
		comparison.developer,
		`${path}.developer`,
		SHARED_SNAPSHOT_LIMITS.maximumNameCharacters,
	);
	expectNumber(comparison.baselinePoints, `${path}.baselinePoints`, {
		nonNegative: true,
	});
	expectNumber(comparison.comparisonPoints, `${path}.comparisonPoints`, {
		nonNegative: true,
	});
	expectNumber(comparison.pointsDelta, `${path}.pointsDelta`);
	expectString(
		comparison.pointsChange,
		`${path}.pointsChange`,
		SHARED_SNAPSHOT_LIMITS.maximumNameCharacters,
	);
	expectNumber(comparison.baselineTickets, `${path}.baselineTickets`, {
		integer: true,
		nonNegative: true,
	});
	expectNumber(comparison.comparisonTickets, `${path}.comparisonTickets`, {
		integer: true,
		nonNegative: true,
	});
	expectNumber(comparison.ticketsDelta, `${path}.ticketsDelta`, {
		integer: true,
	});
}

function validatePeriodSide(
	value: unknown,
	path: string,
): { startDate: string; endDate: string } {
	const side = expectRecord(value, path, ["label", "startDate", "endDate"]);
	expectString(
		side.label,
		`${path}.label`,
		SHARED_SNAPSHOT_LIMITS.maximumLabelCharacters,
	);
	const startDate = expectCalendarDate(side.startDate, `${path}.startDate`);
	const endDate = expectCalendarDate(side.endDate, `${path}.endDate`);
	if (endDate < startDate) {
		validationFailure(
			"invalid_snapshot",
			`${path}.endDate`,
			"must be on or after the start date",
		);
	}
	return { startDate, endDate };
}

function validatePeriodComparisonSnapshotReport(
	value: unknown,
	budget: ValidationBudget,
): void {
	const report = expectRecord(value, "snapshot.report", [
		"scopeLabel",
		"baseline",
		"comparison",
		"comparisons",
		"totalComparison",
	]);
	expectString(
		report.scopeLabel,
		"snapshot.report.scopeLabel",
		SHARED_SNAPSHOT_LIMITS.maximumLabelCharacters,
	);
	validatePeriodSide(report.baseline, "snapshot.report.baseline");
	validatePeriodSide(report.comparison, "snapshot.report.comparison");
	const comparisons = expectArray(
		report.comparisons,
		"snapshot.report.comparisons",
		SHARED_SNAPSHOT_LIMITS.maximumSummariesPerReport,
		budget,
	);
	for (const [index, comparison] of comparisons.entries()) {
		validateResolvedComparison(
			comparison,
			`snapshot.report.comparisons[${index}]`,
		);
	}
	expectUniqueStringField(
		comparisons,
		"snapshot.report.comparisons",
		"developer",
	);
	validateResolvedComparison(
		report.totalComparison,
		"snapshot.report.totalComparison",
	);
}

export function validateSharedSnapshot(value: unknown): SharedSnapshot {
	const snapshot = expectRecord(value, "snapshot", [
		"version",
		"kind",
		"capturedAt",
		"report",
	]);
	if (snapshot.version !== SHARED_SNAPSHOT_VERSION) {
		validationFailure(
			"unsupported_version",
			"snapshot.version",
			`version ${String(snapshot.version)} is not supported`,
		);
	}
	expectCapturedAt(snapshot.capturedAt, "snapshot.capturedAt");
	const kind = expectLiteral(snapshot.kind, "snapshot.kind", [
		"sprint",
		"leaderboard",
		"period-comparison",
	]);
	const budget: ValidationBudget = { collectionItems: 0 };
	if (kind === "sprint") {
		validateSprintSnapshotReport(snapshot.report, budget);
	} else if (kind === "leaderboard") {
		validateLeaderboardSnapshotReport(snapshot.report, budget);
	} else {
		validatePeriodComparisonSnapshotReport(snapshot.report, budget);
	}
	return value as SharedSnapshot;
}
