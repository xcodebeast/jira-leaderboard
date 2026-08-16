import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { isJiraCloudIdentifier } from "./jira-api-url";

export type JiraAuthenticationMode = "classic" | "scoped";

export interface JiraCredentials {
	jiraSiteUrl: string;
	emailAddress: string;
	apiToken: string;
	issuedAt: string;
	authenticationMode: JiraAuthenticationMode;
	cloudIdentifier: string | null;
}

const encryptionAlgorithm = "aes-256-gcm";
const cookieVersion = "1";

function decodeEncryptionKey(encodedKey: string): Buffer {
	const encryptionKey = Buffer.from(encodedKey, "base64");
	if (encryptionKey.length !== 32) {
		throw new Error(
			"SESSION_ENCRYPTION_KEY must be a base64-encoded 32-byte key.",
		);
	}

	return encryptionKey;
}

function encodeBase64Url(value: Buffer): string {
	return value.toString("base64url");
}

function decodeBase64Url(value: string): Buffer {
	return Buffer.from(value, "base64url");
}

function parseCredentials(value: string): JiraCredentials {
	const parsedValue: unknown = JSON.parse(value);
	if (!parsedValue || typeof parsedValue !== "object") {
		throw new Error("The encrypted credential payload is invalid.");
	}

	const credentials = parsedValue as Record<string, unknown>;
	const requiredStringProperties = [
		"jiraSiteUrl",
		"emailAddress",
		"apiToken",
		"issuedAt",
	];
	if (
		requiredStringProperties.some(
			(propertyName) =>
				typeof credentials[propertyName] !== "string" ||
				!credentials[propertyName],
		)
	) {
		throw new Error("The encrypted credential payload is incomplete.");
	}
	if (
		credentials.authenticationMode === undefined &&
		credentials.cloudIdentifier === undefined
	) {
		return {
			...(credentials as unknown as Omit<
				JiraCredentials,
				"authenticationMode" | "cloudIdentifier"
			>),
			authenticationMode: "classic",
			cloudIdentifier: null,
		};
	}
	if (
		credentials.authenticationMode !== "classic" &&
		credentials.authenticationMode !== "scoped"
	) {
		throw new Error(
			"The encrypted credential payload has an invalid authentication mode.",
		);
	}
	if (
		credentials.authenticationMode === "classic" &&
		credentials.cloudIdentifier !== null
	) {
		throw new Error(
			"Classic Jira credentials cannot include a Cloud identifier.",
		);
	}
	if (
		credentials.authenticationMode === "scoped" &&
		(typeof credentials.cloudIdentifier !== "string" ||
			!isJiraCloudIdentifier(credentials.cloudIdentifier))
	) {
		throw new Error("Scoped Jira credentials require a Cloud identifier.");
	}

	return credentials as unknown as JiraCredentials;
}

export function encryptJiraCredentials(
	credentials: JiraCredentials,
	encodedKey: string,
): string {
	const encryptionKey = decodeEncryptionKey(encodedKey);
	const initializationVector = randomBytes(12);
	const cipher = createCipheriv(
		encryptionAlgorithm,
		encryptionKey,
		initializationVector,
	);
	const ciphertext = Buffer.concat([
		cipher.update(JSON.stringify(credentials), "utf8"),
		cipher.final(),
	]);
	const authenticationTag = cipher.getAuthTag();

	return [
		cookieVersion,
		encodeBase64Url(initializationVector),
		encodeBase64Url(ciphertext),
		encodeBase64Url(authenticationTag),
	].join(".");
}

export function decryptJiraCredentials(
	encryptedValue: string,
	encodedKey: string,
): JiraCredentials {
	const [
		version,
		encodedVector,
		encodedCiphertext,
		encodedTag,
		unexpectedPart,
	] = encryptedValue.split(".");
	if (
		version !== cookieVersion ||
		!encodedVector ||
		!encodedCiphertext ||
		!encodedTag ||
		unexpectedPart
	) {
		throw new Error(
			"The encrypted credential cookie has an unsupported format.",
		);
	}

	const decipher = createDecipheriv(
		encryptionAlgorithm,
		decodeEncryptionKey(encodedKey),
		decodeBase64Url(encodedVector),
	);
	decipher.setAuthTag(decodeBase64Url(encodedTag));
	const plaintext = Buffer.concat([
		decipher.update(decodeBase64Url(encodedCiphertext)),
		decipher.final(),
	]).toString("utf8");

	return parseCredentials(plaintext);
}
