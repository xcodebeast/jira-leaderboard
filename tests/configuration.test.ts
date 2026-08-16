import { describe, expect, test } from "bun:test";
import {
	loadRememberedJiraSiteUrl,
	parseStoredConfiguration,
	saveRememberedJiraSiteUrl,
} from "../src/lib/browser/configuration";

const developmentConfiguration = {
	boardIdentifier: 42,
	boardName: "Example Development Board",
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
};

describe("browser configuration", () => {
	test("remembers the last successfully connected Jira site", () => {
		const storedValues = new Map<string, string>();
		const browserStorage = {
			getItem: (key: string) => storedValues.get(key) ?? null,
			setItem: (key: string, value: string) => storedValues.set(key, value),
		};

		saveRememberedJiraSiteUrl("https://example.atlassian.net", browserStorage);

		expect(loadRememberedJiraSiteUrl(browserStorage)).toBe(
			"https://example.atlassian.net",
		);
	});

	test("migrates an existing version 1 setup without losing mappings", () => {
		expect(
			parseStoredConfiguration({
				version: 1,
				...developmentConfiguration,
			}),
		).toEqual({
			version: 2,
			...developmentConfiguration,
			qualityAssurance: null,
		});
	});

	test("parses a version 2 setup with an optional QA board", () => {
		const qualityAssurance = {
			boardIdentifier: 84,
			boardName: "Example QA Board",
			fieldMapping: {
				storyPointsFieldIdentifier: "customfield_10016",
				testerFieldIdentifier: "customfield_30001",
			},
			statusMapping: {
				done: "Done",
				readyForQualityAssurance: "Ready for QA",
			},
		};

		expect(
			parseStoredConfiguration({
				version: 2,
				...developmentConfiguration,
				qualityAssurance,
			}),
		).toEqual({
			version: 2,
			...developmentConfiguration,
			qualityAssurance,
		});
	});

	test("rejects an incomplete QA mapping instead of silently disabling it", () => {
		expect(
			parseStoredConfiguration({
				version: 2,
				...developmentConfiguration,
				qualityAssurance: {
					boardIdentifier: 84,
					boardName: "Example QA Board",
					fieldMapping: {},
					statusMapping: {
						done: "Done",
						readyForQualityAssurance: "Ready for QA",
					},
				},
			}),
		).toBeNull();
	});
});
