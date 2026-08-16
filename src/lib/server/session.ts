import type { Cookies } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import {
	decryptJiraCredentials,
	encryptJiraCredentials,
	type JiraCredentials,
} from "./credential-vault";
import { normalizeJiraSiteUrl } from "./jira-site";

export const credentialCookieName = "jira_leaderboard_credentials";
const cookieLifetimeSeconds = 60 * 60 * 24 * 365;

function sessionEncryptionKey(): string {
	const encodedKey = env.SESSION_ENCRYPTION_KEY;
	if (!encodedKey) {
		throw new SessionConfigurationError(
			"The server is missing SESSION_ENCRYPTION_KEY.",
		);
	}
	if (Buffer.from(encodedKey, "base64").length !== 32) {
		throw new SessionConfigurationError(
			"SESSION_ENCRYPTION_KEY must be a base64-encoded 32-byte key.",
		);
	}

	return encodedKey;
}

export function validateSessionConfiguration(): void {
	sessionEncryptionKey();
}

function cookieOptions() {
	return {
		path: "/",
		httpOnly: true,
		secure: env.NODE_ENV === "production",
		sameSite: "strict" as const,
		maxAge: cookieLifetimeSeconds,
	};
}

export function saveCredentialSession(
	cookies: Cookies,
	credentials: JiraCredentials,
): void {
	cookies.set(
		credentialCookieName,
		encryptJiraCredentials(credentials, sessionEncryptionKey()),
		cookieOptions(),
	);
}

export function clearCredentialSession(cookies: Cookies): void {
	cookies.delete(credentialCookieName, { path: "/" });
}

export function readCredentialSession(
	cookies: Cookies,
): JiraCredentials | null {
	const encryptedValue = cookies.get(credentialCookieName);
	if (!encryptedValue) {
		return null;
	}

	try {
		const credentials = decryptJiraCredentials(
			encryptedValue,
			sessionEncryptionKey(),
		);
		return {
			...credentials,
			jiraSiteUrl: normalizeJiraSiteUrl(
				credentials.jiraSiteUrl,
				env.JIRA_ALLOWED_HOSTS,
			),
		};
	} catch (error) {
		if (error instanceof SessionConfigurationError) {
			throw error;
		}
		clearCredentialSession(cookies);
		return null;
	}
}

export function requireCredentialSession(cookies: Cookies): JiraCredentials {
	const credentials = readCredentialSession(cookies);
	if (!credentials) {
		throw new SessionRequiredError();
	}

	return credentials;
}

export class SessionRequiredError extends Error {
	constructor() {
		super("Connect Jira before requesting board data.");
		this.name = "SessionRequiredError";
	}
}

export class SessionConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SessionConfigurationError";
	}
}
