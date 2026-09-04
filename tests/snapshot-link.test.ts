import { describe, expect, test } from "bun:test";
import {
	decodeSnapshotToken,
	encodeSnapshotToken,
	SNAPSHOT_LINK_LIMITS,
	type SnapshotCodecError,
} from "../src/lib/browser/snapshot-link";
import {
	SHARED_SNAPSHOT_LIMITS,
	SHARED_SNAPSHOT_VERSION,
	type SharedLeaderboardSnapshot,
	type SharedPeriodComparisonSnapshot,
	type SharedSnapshot,
	type SharedSprintSnapshot,
} from "../src/lib/snapshot/schema";

const capturedAt = "2026-09-03T10:15:30.000Z";

const sprintSnapshot: SharedSprintSnapshot = {
	version: SHARED_SNAPSHOT_VERSION,
	kind: "sprint",
	capturedAt,
	report: {
		sprint: {
			name: "Sprint 42",
			state: "active",
			startDate: "2026-08-31T08:00:00.000Z",
			endDate: "2026-09-11T16:00:00.000Z",
		},
		comparisonSprint: {
			name: "Sprint 41",
			state: "closed",
			startDate: "2026-08-17T08:00:00.000Z",
			endDate: "2026-08-28T16:00:00.000Z",
		},
		activeScoreboard: "development",
		development: {
			sourceLabel: "Product development",
			summaries: [
				{
					developer: "Alex Morgan",
					donePoints: 13,
					qualityAssurancePoints: 5,
					readyForQualityAssurancePoints: 3,
					bounceCount: 2,
					tickets: [
						{
							issueKey: "DEMO-42",
							summary: "Keep the snapshot completely client-side",
							status: "Done",
						},
					],
				},
			],
			comparisons: [
				{
					developer: "Alex Morgan",
					donePointsDelta: 5,
					qualityAssurancePointsDelta: 2,
					readyForQualityAssurancePointsDelta: -2,
					projectedPointsDelta: 5,
					bounceCountDelta: -1,
				},
			],
		},
		qualityAssurance: {
			sourceLabel: "Product QA",
			summaries: [
				{
					tester: "Bailey Chen",
					doneStoryPoints: 8,
					doneTicketCount: 2,
					readyForQualityAssuranceStoryPoints: 3,
					readyForQualityAssuranceTicketCount: 1,
					tickets: [
						{
							issueKey: "DEMO-43",
							summary: "Verify a frozen view",
							status: "Ready for QA",
						},
					],
				},
			],
		},
	},
};

const leaderboardSnapshot: SharedLeaderboardSnapshot = {
	version: SHARED_SNAPSHOT_VERSION,
	kind: "leaderboard",
	capturedAt,
	report: {
		period: { label: "2026", year: 2026 },
		scope: "global",
		scopeLabel: "All accessible Jira projects",
		development: {
			sourceLabel: "All accessible Jira projects",
			entries: [
				{
					contributor: "Alex Morgan",
					completedPoints: 144.5,
					completedTickets: 31,
				},
			],
		},
		qualityAssurance: {
			sourceLabel: "All accessible Jira projects",
			entries: [
				{
					contributor: "Bailey Chen",
					completedPoints: 89,
					completedTickets: 27,
				},
			],
		},
	},
};

const periodSnapshot: SharedPeriodComparisonSnapshot = {
	version: SHARED_SNAPSHOT_VERSION,
	kind: "period-comparison",
	capturedAt,
	report: {
		scopeLabel: "Project DEMO",
		baseline: {
			label: "Before",
			startDate: "2026-07-01",
			endDate: "2026-07-31",
		},
		comparison: {
			label: "After",
			startDate: "2026-08-01",
			endDate: "2026-08-31",
		},
		comparisons: [
			{
				developer: "Alex Morgan",
				baselinePoints: 21,
				comparisonPoints: 34,
				pointsDelta: 13,
				pointsChange: "+61.9%",
				baselineTickets: 5,
				comparisonTickets: 8,
				ticketsDelta: 3,
			},
		],
		totalComparison: {
			developer: "All Developers",
			baselinePoints: 21,
			comparisonPoints: 34,
			pointsDelta: 13,
			pointsChange: "+61.9%",
			baselineTickets: 5,
			comparisonTickets: 8,
			ticketsDelta: 3,
		},
	},
};

async function caughtCodecError(
	operation: Promise<unknown>,
): Promise<SnapshotCodecError> {
	let caughtError: unknown;
	try {
		await operation;
	} catch (error) {
		caughtError = error;
	}
	expect(caughtError).toBeInstanceOf(Error);
	expect(caughtError).toHaveProperty("name", "SnapshotCodecError");
	return caughtError as SnapshotCodecError;
}

function replaceFirstBase64Character(value: string): string {
	return `${value[0] === "A" ? "B" : "A"}${value.slice(1)}`;
}

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
	const stream = new Blob([bytes.buffer as ArrayBuffer])
		.stream()
		.pipeThrough(new CompressionStream("gzip"));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function createEncryptedToken(plaintext: Uint8Array): Promise<string> {
	const compressedPlaintext = await gzip(plaintext);
	const encryptionKey = await crypto.subtle.generateKey(
		{ name: "AES-GCM", length: 256 },
		true,
		["encrypt"],
	);
	const rawEncryptionKey = await crypto.subtle.exportKey("raw", encryptionKey);
	const initializationVector = crypto.getRandomValues(new Uint8Array(12));
	const ciphertext = await crypto.subtle.encrypt(
		{
			name: "AES-GCM",
			// biome-ignore lint/style/useNamingConvention: Web Crypto defines this field name.
			iv: initializationVector,
			additionalData: new TextEncoder().encode(
				"JiraLeaderboard frozen snapshot v1",
			),
		},
		encryptionKey,
		compressedPlaintext.buffer as ArrayBuffer,
	);
	return [
		"v1",
		Buffer.from(rawEncryptionKey).toString("base64url"),
		Buffer.from(initializationVector).toString("base64url"),
		Buffer.from(ciphertext).toString("base64url"),
	].join(".");
}

describe("frozen snapshot links", () => {
	test("round-trips every supported snapshot kind without plaintext in the token", async () => {
		for (const snapshot of [
			sprintSnapshot,
			leaderboardSnapshot,
			periodSnapshot,
		] satisfies SharedSnapshot[]) {
			const token = await encodeSnapshotToken(snapshot);
			expect(token).not.toContain("Alex Morgan");
			expect(token.length).toBeLessThanOrEqual(
				SNAPSHOT_LINK_LIMITS.maximumTokenCharacters,
			);
			expect(await decodeSnapshotToken(token)).toEqual(snapshot);
		}
	});

	test("uses a fresh key and initialization vector for each link", async () => {
		const firstToken = await encodeSnapshotToken(leaderboardSnapshot);
		const secondToken = await encodeSnapshotToken(leaderboardSnapshot);

		expect(firstToken).not.toBe(secondToken);
		expect(await decodeSnapshotToken(firstToken)).toEqual(leaderboardSnapshot);
		expect(await decodeSnapshotToken(secondToken)).toEqual(leaderboardSnapshot);
	});

	test("rejects a wrong key and corrupted ciphertext", async () => {
		const tokenParts = (await encodeSnapshotToken(sprintSnapshot)).split(".");
		const wrongKeyParts = [...tokenParts];
		wrongKeyParts[1] = replaceFirstBase64Character(wrongKeyParts[1]);
		const wrongKeyError = await caughtCodecError(
			decodeSnapshotToken(wrongKeyParts.join(".")),
		);
		expect(wrongKeyError.code).toBe("decryption_failed");

		const corruptedCiphertextParts = [...tokenParts];
		corruptedCiphertextParts[3] = replaceFirstBase64Character(
			corruptedCiphertextParts[3],
		);
		const corruptionError = await caughtCodecError(
			decodeSnapshotToken(corruptedCiphertextParts.join(".")),
		);
		expect(corruptionError.code).toBe("decryption_failed");
	});

	test("classifies malformed and unsupported token versions", async () => {
		const malformedError = await caughtCodecError(
			decodeSnapshotToken("not-a-snapshot-token"),
		);
		expect(malformedError.code).toBe("malformed_token");

		const versionError = await caughtCodecError(
			decodeSnapshotToken("v2.key.vector.payload"),
		);
		expect(versionError.code).toBe("unsupported_token_version");
	});

	test("rejects unsupported snapshots and fields outside the safe contract", async () => {
		const versionError = await caughtCodecError(
			encodeSnapshotToken({ ...leaderboardSnapshot, version: 2 }),
		);
		expect(versionError.code).toBe("unsupported_snapshot_version");

		const fieldError = await caughtCodecError(
			encodeSnapshotToken({
				...leaderboardSnapshot,
				apiToken: "must-never-be-shared",
			}),
		);
		expect(fieldError.code).toBe("invalid_snapshot");
	});

	test("rejects duplicate keys used by shared Svelte lists", async () => {
		const duplicateContributorSnapshot = structuredClone(leaderboardSnapshot);
		duplicateContributorSnapshot.report.development.entries.push({
			...duplicateContributorSnapshot.report.development.entries[0],
		});
		const contributorError = await caughtCodecError(
			encodeSnapshotToken(duplicateContributorSnapshot),
		);
		expect(contributorError.code).toBe("invalid_snapshot");

		const duplicateTicketSnapshot = structuredClone(sprintSnapshot);
		duplicateTicketSnapshot.report.development.summaries[0].tickets.push({
			...duplicateTicketSnapshot.report.development.summaries[0].tickets[0],
		});
		const ticketError = await caughtCodecError(
			encodeSnapshotToken(duplicateTicketSnapshot),
		);
		expect(ticketError.code).toBe("invalid_snapshot");
	});

	test("enforces content, fragment, and expanded-data limits", async () => {
		const excessiveLabelSnapshot = structuredClone(leaderboardSnapshot);
		excessiveLabelSnapshot.report.scopeLabel = "x".repeat(
			SHARED_SNAPSHOT_LIMITS.maximumLabelCharacters + 1,
		);
		const contentError = await caughtCodecError(
			encodeSnapshotToken(excessiveLabelSnapshot),
		);
		expect(contentError.code).toBe("snapshot_too_large");

		const tokenError = await caughtCodecError(
			decodeSnapshotToken(
				"x".repeat(SNAPSHOT_LINK_LIMITS.maximumTokenCharacters + 1),
			),
		);
		expect(tokenError.code).toBe("token_too_large");

		const expandingToken = await createEncryptedToken(
			new TextEncoder().encode(
				"x".repeat(SHARED_SNAPSHOT_LIMITS.maximumJsonBytes + 1),
			),
		);
		const expansionError = await caughtCodecError(
			decodeSnapshotToken(expandingToken),
		);
		expect(expansionError.code).toBe("snapshot_too_large");
	});
});
