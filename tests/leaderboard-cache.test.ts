import { describe, expect, test } from "bun:test";
import type { AppConfiguration } from "../src/lib/browser/configuration";
import {
	clearLeaderboardCache,
	leaderboardCacheKey,
	leaderboardCacheLifetimeMilliseconds,
	parseCachedLeaderboardReport,
	readCachedLeaderboardReport,
	writeCachedLeaderboardReport,
} from "../src/lib/browser/leaderboard-cache";
import { summarizeDeveloperAllTimeIssues } from "../src/lib/domain/all-time-performance";

const session = {
	jiraSiteUrl: "https://example.atlassian.net",
	emailAddress: "developer@example.com",
	authenticationMode: "classic" as const,
};
const configuration: AppConfiguration = {
	version: 2,
	boardIdentifier: 42,
	boardName: "Development",
	fieldMapping: {
		storyPointsFieldIdentifier: "customfield_10016",
		developerFieldIdentifier: "customfield_20001",
		bounceCountFieldIdentifier: "customfield_20002",
	},
	statusMapping: {
		done: "Done",
		qualityAssurance: "QA",
		readyForQualityAssurance: "Ready for QA",
	},
	defaultProjectKey: "DEMO",
	qualityAssurance: {
		boardIdentifier: 84,
		boardName: "QA",
		fieldMapping: {
			storyPointsFieldIdentifier: "customfield_10016",
			testerFieldIdentifier: "customfield_30001",
		},
		statusMapping: { done: "Done", readyForQualityAssurance: "Ready for QA" },
	},
};
const cachedAt = Date.UTC(2026, 9, 2, 8);
const report = {
	cachedAt,
	developerEntries: [
		{
			contributor: "Alex",
			contributorAccountIdentifier: "alex-account",
			completedPoints: 13.5,
			completedTickets: 3,
		},
	],
	qualityAssuranceEntries: [
		{ contributor: "Sam", completedPoints: 8, completedTickets: 2 },
	],
};

describe("leaderboard score cache", () => {
	test("keeps scores for two hours without extending their age on reads", () => {
		expect(leaderboardCacheLifetimeMilliseconds).toBe(7_200_000);
		expect(parseCachedLeaderboardReport(report, cachedAt)).toEqual(report);
		expect(
			parseCachedLeaderboardReport(
				report,
				cachedAt + leaderboardCacheLifetimeMilliseconds - 1,
			),
		).toEqual(report);
		expect(
			parseCachedLeaderboardReport(
				report,
				cachedAt + leaderboardCacheLifetimeMilliseconds,
			),
		).toBeNull();
		expect(
			parseCachedLeaderboardReport(
				report,
				cachedAt + leaderboardCacheLifetimeMilliseconds + 1,
			),
		).toBeNull();
	});

	test("preserves contributor identities when calculated scores are serialized", () => {
		const developerEntries = summarizeDeveloperAllTimeIssues(
			[
				{
					issueKey: "DEMO-1",
					summary: "Delivered work",
					statusName: "Done",
					resolutionDate: "2026-10-02T08:00:00.000Z",
					storyPoints: 5,
					developer: "Alex",
					developerAccountIdentifier: "alex-account",
					bounceCount: 0,
				},
			],
			"Done",
		);
		const serializedReport = JSON.stringify({
			cachedAt,
			developerEntries,
			qualityAssuranceEntries: [],
		});
		expect(
			parseCachedLeaderboardReport(JSON.parse(serializedReport), cachedAt),
		).toEqual({ cachedAt, developerEntries, qualityAssuranceEntries: [] });
		expect(serializedReport).not.toContain("Delivered work");
		expect(serializedReport).not.toContain("DEMO-1");
	});

	test("accepts a successfully loaded empty leaderboard", () => {
		expect(
			parseCachedLeaderboardReport(
				{ cachedAt, developerEntries: [], qualityAssuranceEntries: [] },
				cachedAt,
			),
		).toEqual({ cachedAt, developerEntries: [], qualityAssuranceEntries: [] });
	});

	test("rejects malformed scores and invalid cache timestamps", () => {
		for (const value of [
			null,
			[],
			{},
			{ ...report, cachedAt: "2026-10-02" },
			{ ...report, cachedAt: Number.NaN },
			{ ...report, cachedAt: cachedAt + 1 },
			{ ...report, cachedAt: -1 },
			{ ...report, developerEntries: null },
			{ ...report, qualityAssuranceEntries: [{}] },
			{
				...report,
				developerEntries: [{ ...report.developerEntries[0], contributor: 42 }],
			},
			{
				...report,
				developerEntries: [
					{ ...report.developerEntries[0], contributorAccountIdentifier: {} },
				],
			},
			{
				...report,
				developerEntries: [
					{
						...report.developerEntries[0],
						completedPoints: Number.POSITIVE_INFINITY,
					},
				],
			},
			{
				...report,
				developerEntries: [
					{ ...report.developerEntries[0], completedTickets: -1 },
				],
			},
			{
				...report,
				developerEntries: [
					{ ...report.developerEntries[0], completedTickets: 1.5 },
				],
			},
		]) {
			expect(parseCachedLeaderboardReport(value, cachedAt)).toBeNull();
		}
	});

	test("separates accounts, Jira sites, scopes, and seasons", () => {
		const initialKey = leaderboardCacheKey(
			session,
			configuration,
			"board",
			2026,
		);
		const otherKeys = [
			leaderboardCacheKey(
				{ ...session, emailAddress: "tester@example.com" },
				configuration,
				"board",
				2026,
			),
			leaderboardCacheKey(
				{ ...session, jiraSiteUrl: "https://other.atlassian.net" },
				configuration,
				"board",
				2026,
			),
			leaderboardCacheKey(
				{ ...session, authenticationMode: "scoped" },
				configuration,
				"board",
				2026,
			),
			leaderboardCacheKey(session, configuration, "global", 2026),
			leaderboardCacheKey(session, configuration, "board", 2025),
			leaderboardCacheKey(session, configuration, "board", null),
		];
		for (const key of otherKeys) expect(key).not.toBe(initialKey);
		expect(new Set(otherKeys).size).toBe(otherKeys.length);
	});

	test("separates development and QA settings that change the scores", () => {
		const initialKey = leaderboardCacheKey(
			session,
			configuration,
			"board",
			2026,
		);
		const changedConfigurations: AppConfiguration[] = [
			{ ...configuration, boardIdentifier: 43 },
			{
				...configuration,
				statusMapping: { ...configuration.statusMapping, done: "Closed" },
			},
			{ ...configuration, qualityAssurance: null },
		];
		for (const property of Object.keys(configuration.fieldMapping)) {
			changedConfigurations.push({
				...configuration,
				fieldMapping: {
					...configuration.fieldMapping,
					[property]: "customfield_99999",
				},
			});
		}
		const qualityAssurance = configuration.qualityAssurance;
		if (!qualityAssurance) throw new Error("The test requires QA settings.");
		changedConfigurations.push(
			{
				...configuration,
				qualityAssurance: { ...qualityAssurance, boardIdentifier: 85 },
			},
			{
				...configuration,
				qualityAssurance: {
					...qualityAssurance,
					statusMapping: { ...qualityAssurance.statusMapping, done: "Closed" },
				},
			},
		);
		for (const property of Object.keys(qualityAssurance.fieldMapping)) {
			changedConfigurations.push({
				...configuration,
				qualityAssurance: {
					...qualityAssurance,
					fieldMapping: {
						...qualityAssurance.fieldMapping,
						[property]: "customfield_99999",
					},
				},
			});
		}
		for (const changedConfiguration of changedConfigurations) {
			expect(
				leaderboardCacheKey(session, changedConfiguration, "board", 2026),
			).not.toBe(initialKey);
		}
	});

	test("unrelated preferences do not invalidate score selections", () => {
		expect(
			leaderboardCacheKey(
				session,
				{
					...configuration,
					boardName: "Renamed board",
					defaultProjectKey: "OTHER",
				},
				"board",
				2026,
			),
		).toBe(leaderboardCacheKey(session, configuration, "board", 2026));
	});

	test("can run without browser storage", () => {
		expect(readCachedLeaderboardReport("unused")).toBeNull();
		expect(() => writeCachedLeaderboardReport("unused", report)).not.toThrow();
		expect(() => clearLeaderboardCache()).not.toThrow();
	});
});
