import type {
	AllTimeLeaderboardEntry,
	LeaderboardScope,
} from "../domain/all-time-performance";
import type { ConnectedSession } from "./api-client";
import type { AppConfiguration } from "./configuration";

export interface LeaderboardReport {
	developerEntries: AllTimeLeaderboardEntry[];
	qualityAssuranceEntries: AllTimeLeaderboardEntry[];
	cachedAt: number;
}

export const leaderboardCacheLifetimeMilliseconds = 2 * 60 * 60 * 1000;
const cacheStoragePrefix = "jiraLeaderboard.scores.v1:";
const maximumCachedReports = 20;

/** Separates scores by account and every setting that affects the report. */
export function leaderboardCacheKey(
	session: Pick<
		ConnectedSession,
		"jiraSiteUrl" | "emailAddress" | "authenticationMode"
	>,
	configuration: AppConfiguration,
	scope: LeaderboardScope,
	year: number | null,
): string {
	const qualityAssurance = configuration.qualityAssurance;
	return `${cacheStoragePrefix}${JSON.stringify([
		session.jiraSiteUrl,
		session.emailAddress,
		session.authenticationMode,
		scope,
		year,
		configuration.boardIdentifier,
		configuration.statusMapping.done,
		configuration.fieldMapping.storyPointsFieldIdentifier,
		configuration.fieldMapping.developerFieldIdentifier,
		configuration.fieldMapping.bounceCountFieldIdentifier,
		qualityAssurance
			? [
					qualityAssurance.boardIdentifier,
					qualityAssurance.statusMapping.done,
					qualityAssurance.fieldMapping.storyPointsFieldIdentifier,
					qualityAssurance.fieldMapping.testerFieldIdentifier,
				]
			: null,
	])}`;
}

function isLeaderboardEntry(value: unknown): value is AllTimeLeaderboardEntry {
	if (!value || typeof value !== "object") return false;
	const entry = value as Record<string, unknown>;
	return (
		typeof entry.contributor === "string" &&
		(entry.contributorAccountIdentifier === undefined ||
			typeof entry.contributorAccountIdentifier === "string") &&
		typeof entry.completedPoints === "number" &&
		Number.isFinite(entry.completedPoints) &&
		typeof entry.completedTickets === "number" &&
		Number.isSafeInteger(entry.completedTickets) &&
		entry.completedTickets >= 0
	);
}

/** Treats malformed, future-dated, and expired browser data as a cache miss. */
export function parseCachedLeaderboardReport(
	value: unknown,
	currentTime = Date.now(),
): LeaderboardReport | null {
	if (!value || typeof value !== "object") return null;
	const report = value as Record<string, unknown>;
	if (
		typeof report.cachedAt !== "number" ||
		!Number.isSafeInteger(report.cachedAt) ||
		report.cachedAt < 0 ||
		report.cachedAt > currentTime ||
		currentTime - report.cachedAt >= leaderboardCacheLifetimeMilliseconds ||
		!Array.isArray(report.developerEntries) ||
		!report.developerEntries.every(isLeaderboardEntry) ||
		!Array.isArray(report.qualityAssuranceEntries) ||
		!report.qualityAssuranceEntries.every(isLeaderboardEntry)
	) {
		return null;
	}
	return {
		cachedAt: report.cachedAt,
		developerEntries: report.developerEntries,
		qualityAssuranceEntries: report.qualityAssuranceEntries,
	};
}

/** Returns scores across page reloads, tolerating unavailable browser storage. */
export function readCachedLeaderboardReport(
	key: string,
): LeaderboardReport | null {
	try {
		const storedValue = localStorage.getItem(key);
		if (!storedValue) return null;
		const report = parseCachedLeaderboardReport(JSON.parse(storedValue));
		if (!report) localStorage.removeItem(key);
		return report;
	} catch {
		return null;
	}
}

function storedReportKeys(): string[] {
	const keys: string[] = [];
	for (let index = 0; index < localStorage.length; index += 1) {
		const key = localStorage.key(index);
		if (key?.startsWith(cacheStoragePrefix)) keys.push(key);
	}
	return keys;
}

/** Stores compact scores only; raw Jira issues and credentials are never cached. */
export function writeCachedLeaderboardReport(
	key: string,
	report: LeaderboardReport,
): void {
	try {
		const cachedReports = storedReportKeys()
			.filter((storedKey) => storedKey !== key)
			.map((storedKey) => ({
				key: storedKey,
				report: readCachedLeaderboardReport(storedKey),
			}))
			.filter((entry) => entry.report !== null)
			.sort(
				(left, right) =>
					(left.report?.cachedAt ?? 0) - (right.report?.cachedAt ?? 0),
			);
		while (cachedReports.length >= maximumCachedReports) {
			const oldest = cachedReports.shift();
			if (oldest) localStorage.removeItem(oldest.key);
		}
		localStorage.setItem(key, JSON.stringify(report));
	} catch {
		// Storage limits must not prevent freshly loaded scores from being displayed.
	}
}

/** Refresh and account changes invalidate all locally cached leaderboard selections. */
export function clearLeaderboardCache(): void {
	try {
		for (const key of storedReportKeys()) localStorage.removeItem(key);
	} catch {
		// Browsers that disable storage can still load the leaderboard directly.
	}
}
