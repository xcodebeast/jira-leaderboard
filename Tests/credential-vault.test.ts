import { describe, expect, test } from "bun:test";
import {
	decryptJiraCredentials,
	encryptJiraCredentials,
	type JiraCredentials,
} from "../src/lib/server/credential-vault";
import {
	createPendingJiraCredentials,
	createScopedJiraCredentials,
} from "../src/lib/server/jira-authentication";

const encodedEncryptionKey = Buffer.alloc(32, 7).toString("base64");

describe("credential vault", () => {
	test("round-trips Jira credentials without exposing plaintext", () => {
		const credentials = createPendingJiraCredentials({
			jiraSiteUrl: "https://example.atlassian.net",
			emailAddress: "scrum.master@example.com",
			apiToken: "read-only-secret-token",
			issuedAt: "2026-08-13T12:00:00.000Z",
		});
		const encryptedValue = encryptJiraCredentials(
			credentials,
			encodedEncryptionKey,
		);

		expect(encryptedValue).not.toContain(credentials.apiToken);
		expect(encryptedValue).not.toContain(credentials.emailAddress);
		expect(
			decryptJiraCredentials(encryptedValue, encodedEncryptionKey),
		).toEqual(credentials);
	});

	test("rejects tampered cookies", () => {
		const encryptedValue = encryptJiraCredentials(
			createPendingJiraCredentials({
				jiraSiteUrl: "https://example.atlassian.net",
				emailAddress: "scrum.master@example.com",
				apiToken: "read-only-secret-token",
				issuedAt: "2026-08-13T12:00:00.000Z",
			}),
			encodedEncryptionKey,
		);
		const encryptedParts = encryptedValue.split(".");
		const ciphertext = Buffer.from(encryptedParts[2], "base64url");
		ciphertext[0] ^= 1;
		encryptedParts[2] = ciphertext.toString("base64url");
		const tamperedValue = encryptedParts.join(".");

		expect(() =>
			decryptJiraCredentials(tamperedValue, encodedEncryptionKey),
		).toThrow();
	});

	test("round-trips scoped credentials and their Cloud identifier", () => {
		const scopedCredentials = createScopedJiraCredentials(
			createPendingJiraCredentials({
				jiraSiteUrl: "https://example.atlassian.net",
				emailAddress: "scrum.master@example.com",
				apiToken: "read-only-secret-token",
				issuedAt: "2026-08-13T12:00:00.000Z",
			}),
			"12345678-1234-4abc-8def-1234567890ab",
		);
		const encryptedValue = encryptJiraCredentials(
			scopedCredentials,
			encodedEncryptionKey,
		);

		expect(
			decryptJiraCredentials(encryptedValue, encodedEncryptionKey),
		).toEqual(scopedCredentials);
	});

	test("requires an exact 32-byte key", () => {
		expect(() =>
			encryptJiraCredentials(
				createPendingJiraCredentials({
					jiraSiteUrl: "https://example.atlassian.net",
					emailAddress: "scrum.master@example.com",
					apiToken: "read-only-secret-token",
					issuedAt: "2026-08-13T12:00:00.000Z",
				}),
				Buffer.alloc(16).toString("base64"),
			),
		).toThrow("SESSION_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
	});

	test("migrates encrypted credentials created before token modes existed", () => {
		const legacyCredentials = {
			jiraSiteUrl: "https://example.atlassian.net",
			emailAddress: "scrum.master@example.com",
			apiToken: "read-only-secret-token",
			issuedAt: "2026-08-13T12:00:00.000Z",
		};
		const encryptedValue = encryptJiraCredentials(
			legacyCredentials as JiraCredentials,
			encodedEncryptionKey,
		);

		expect(
			decryptJiraCredentials(encryptedValue, encodedEncryptionKey),
		).toEqual({
			...legacyCredentials,
			authenticationMode: "classic",
			cloudIdentifier: null,
		});
	});
});
