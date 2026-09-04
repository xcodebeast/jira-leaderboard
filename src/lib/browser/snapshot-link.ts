import {
	SHARED_SNAPSHOT_LIMITS,
	type SharedSnapshot,
	SharedSnapshotValidationError,
	validateSharedSnapshot,
} from "../snapshot/schema";

export const SNAPSHOT_TOKEN_VERSION = "v1" as const;

export const SNAPSHOT_LINK_LIMITS = {
	maximumCompressedBytes: 43 * 1024,
	maximumTokenCharacters: 60_000,
} as const;

const encryptionKeyBytes = 32;
const initializationVectorBytes = 12;
const authenticationTagBytes = 16;
const encryptionAdditionalData = new TextEncoder().encode(
	"JiraLeaderboard frozen snapshot v1",
);

export type SnapshotCodecErrorCode =
	| "invalid_snapshot"
	| "unsupported_snapshot_version"
	| "snapshot_too_large"
	| "malformed_token"
	| "unsupported_token_version"
	| "token_too_large"
	| "encryption_failed"
	| "decryption_failed"
	| "compression_failed"
	| "decompression_failed"
	| "unsupported_runtime";

export class SnapshotCodecError extends Error {
	readonly code: SnapshotCodecErrorCode;
	override readonly cause: unknown;

	constructor(code: SnapshotCodecErrorCode, message: string, cause?: unknown) {
		super(message);
		this.name = "SnapshotCodecError";
		this.code = code;
		this.cause = cause;
	}
}

function runtimeCrypto(): Crypto {
	const cryptoProvider = globalThis.crypto;
	if (
		!cryptoProvider?.subtle ||
		typeof cryptoProvider.getRandomValues !== "function"
	) {
		throw new SnapshotCodecError(
			"unsupported_runtime",
			"This browser cannot create or open encrypted snapshot links.",
		);
	}
	return cryptoProvider;
}

function bytesAsArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy.buffer;
}

function encodeBase64Url(bytes: Uint8Array): string {
	if (typeof globalThis.btoa !== "function") {
		throw new SnapshotCodecError(
			"unsupported_runtime",
			"This browser cannot encode snapshot links.",
		);
	}
	const binaryChunks: string[] = [];
	const chunkSize = 32_768;
	for (let offset = 0; offset < bytes.length; offset += chunkSize) {
		binaryChunks.push(
			String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)),
		);
	}
	return globalThis
		.btoa(binaryChunks.join(""))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replace(/=+$/u, "");
}

function decodeBase64Url(value: string, fieldName: string): Uint8Array {
	if (
		value.length === 0 ||
		value.length % 4 === 1 ||
		!/^[A-Za-z0-9_-]+$/u.test(value)
	) {
		throw new SnapshotCodecError(
			"malformed_token",
			`The snapshot link contains an invalid ${fieldName}.`,
		);
	}
	if (typeof globalThis.atob !== "function") {
		throw new SnapshotCodecError(
			"unsupported_runtime",
			"This browser cannot decode snapshot links.",
		);
	}
	const standardBase64 = value
		.replaceAll("-", "+")
		.replaceAll("_", "/")
		.padEnd(Math.ceil(value.length / 4) * 4, "=");
	let binary: string;
	try {
		binary = globalThis.atob(standardBase64);
	} catch (error) {
		throw new SnapshotCodecError(
			"malformed_token",
			`The snapshot link contains an invalid ${fieldName}.`,
			error,
		);
	}
	const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
	if (encodeBase64Url(bytes) !== value) {
		throw new SnapshotCodecError(
			"malformed_token",
			`The snapshot link contains a non-canonical ${fieldName}.`,
		);
	}
	return bytes;
}

async function readByteStream(
	stream: ReadableStream<Uint8Array>,
	maximumBytes: number,
	limitError: SnapshotCodecError,
): Promise<Uint8Array> {
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];
	let totalBytes = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			totalBytes += value.byteLength;
			if (totalBytes > maximumBytes) {
				await reader.cancel(limitError);
				throw limitError;
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}

	const result = new Uint8Array(totalBytes);
	let resultOffset = 0;
	for (const chunk of chunks) {
		result.set(chunk, resultOffset);
		resultOffset += chunk.byteLength;
	}
	return result;
}

async function compressBytes(bytes: Uint8Array): Promise<Uint8Array> {
	if (typeof globalThis.CompressionStream !== "function") {
		throw new SnapshotCodecError(
			"unsupported_runtime",
			"This browser cannot compress snapshot links.",
		);
	}
	try {
		const compressedStream = new Blob([bytesAsArrayBuffer(bytes)])
			.stream()
			.pipeThrough(new globalThis.CompressionStream("gzip"));
		return await readByteStream(
			compressedStream,
			SNAPSHOT_LINK_LIMITS.maximumCompressedBytes,
			new SnapshotCodecError(
				"snapshot_too_large",
				"This snapshot is too large to fit safely in a share link.",
			),
		);
	} catch (error) {
		if (error instanceof SnapshotCodecError) {
			throw error;
		}
		throw new SnapshotCodecError(
			"compression_failed",
			"The snapshot could not be compressed.",
			error,
		);
	}
}

async function decompressBytes(bytes: Uint8Array): Promise<Uint8Array> {
	if (typeof globalThis.DecompressionStream !== "function") {
		throw new SnapshotCodecError(
			"unsupported_runtime",
			"This browser cannot decompress snapshot links.",
		);
	}
	try {
		const decompressedStream = new Blob([bytesAsArrayBuffer(bytes)])
			.stream()
			.pipeThrough(new globalThis.DecompressionStream("gzip"));
		return await readByteStream(
			decompressedStream,
			SHARED_SNAPSHOT_LIMITS.maximumJsonBytes,
			new SnapshotCodecError(
				"snapshot_too_large",
				"The snapshot expands beyond the supported size limit.",
			),
		);
	} catch (error) {
		if (error instanceof SnapshotCodecError) {
			throw error;
		}
		throw new SnapshotCodecError(
			"decompression_failed",
			"The snapshot data is damaged and could not be decompressed.",
			error,
		);
	}
}

function validationCodecError(
	validationError: SharedSnapshotValidationError,
): SnapshotCodecError {
	if (validationError.code === "unsupported_version") {
		return new SnapshotCodecError(
			"unsupported_snapshot_version",
			"This snapshot was created by an unsupported app version.",
			validationError,
		);
	}
	if (validationError.code === "limit_exceeded") {
		return new SnapshotCodecError(
			"snapshot_too_large",
			"This snapshot exceeds the supported content limits.",
			validationError,
		);
	}
	return new SnapshotCodecError(
		"invalid_snapshot",
		"The snapshot data does not match the share-safe format.",
		validationError,
	);
}

function validatedSnapshot(value: unknown): SharedSnapshot {
	try {
		return validateSharedSnapshot(value);
	} catch (error) {
		if (error instanceof SharedSnapshotValidationError) {
			throw validationCodecError(error);
		}
		throw error;
	}
}

function snapshotJsonBytes(snapshot: SharedSnapshot): Uint8Array {
	let serializedSnapshot: string;
	try {
		serializedSnapshot = JSON.stringify(snapshot);
	} catch (error) {
		throw new SnapshotCodecError(
			"invalid_snapshot",
			"The snapshot could not be serialized.",
			error,
		);
	}
	const bytes = new TextEncoder().encode(serializedSnapshot);
	if (bytes.byteLength > SHARED_SNAPSHOT_LIMITS.maximumJsonBytes) {
		throw new SnapshotCodecError(
			"snapshot_too_large",
			"This snapshot is too large to fit safely in a share link.",
		);
	}
	return bytes;
}

export async function encodeSnapshotToken(value: unknown): Promise<string> {
	const snapshot = validatedSnapshot(value);
	const compressedSnapshot = await compressBytes(snapshotJsonBytes(snapshot));
	const cryptoProvider = runtimeCrypto();
	const initializationVector = cryptoProvider.getRandomValues(
		new Uint8Array(initializationVectorBytes),
	);

	let rawEncryptionKey: ArrayBuffer;
	let ciphertext: ArrayBuffer;
	try {
		const encryptionKey = await cryptoProvider.subtle.generateKey(
			{ name: "AES-GCM", length: encryptionKeyBytes * 8 },
			true,
			["encrypt"],
		);
		rawEncryptionKey = await cryptoProvider.subtle.exportKey(
			"raw",
			encryptionKey,
		);
		ciphertext = await cryptoProvider.subtle.encrypt(
			{
				name: "AES-GCM",
				// biome-ignore lint/style/useNamingConvention: Web Crypto defines this field name.
				iv: bytesAsArrayBuffer(initializationVector),
				additionalData: bytesAsArrayBuffer(encryptionAdditionalData),
			},
			encryptionKey,
			bytesAsArrayBuffer(compressedSnapshot),
		);
	} catch (error) {
		throw new SnapshotCodecError(
			"encryption_failed",
			"The snapshot could not be encrypted.",
			error,
		);
	}

	const token = [
		SNAPSHOT_TOKEN_VERSION,
		encodeBase64Url(new Uint8Array(rawEncryptionKey)),
		encodeBase64Url(initializationVector),
		encodeBase64Url(new Uint8Array(ciphertext)),
	].join(".");
	if (token.length > SNAPSHOT_LINK_LIMITS.maximumTokenCharacters) {
		throw new SnapshotCodecError(
			"snapshot_too_large",
			"This snapshot is too large to fit safely in a share link.",
		);
	}
	return token;
}

function parseToken(token: string): {
	encryptionKey: Uint8Array;
	initializationVector: Uint8Array;
	ciphertext: Uint8Array;
} {
	if (token.length > SNAPSHOT_LINK_LIMITS.maximumTokenCharacters) {
		throw new SnapshotCodecError(
			"token_too_large",
			"This snapshot link exceeds the supported size limit.",
		);
	}
	const tokenParts = token.split(".");
	if (tokenParts.length !== 4 || tokenParts.some((part) => part.length === 0)) {
		throw new SnapshotCodecError(
			"malformed_token",
			"This snapshot link is incomplete or malformed.",
		);
	}
	if (tokenParts[0] !== SNAPSHOT_TOKEN_VERSION) {
		throw new SnapshotCodecError(
			"unsupported_token_version",
			"This snapshot link uses an unsupported format version.",
		);
	}
	const encryptionKey = decodeBase64Url(tokenParts[1], "encryption key");
	const initializationVector = decodeBase64Url(
		tokenParts[2],
		"initialization vector",
	);
	const ciphertext = decodeBase64Url(tokenParts[3], "encrypted payload");
	if (encryptionKey.byteLength !== encryptionKeyBytes) {
		throw new SnapshotCodecError(
			"malformed_token",
			"The snapshot link contains an invalid encryption key.",
		);
	}
	if (initializationVector.byteLength !== initializationVectorBytes) {
		throw new SnapshotCodecError(
			"malformed_token",
			"The snapshot link contains an invalid initialization vector.",
		);
	}
	if (
		ciphertext.byteLength <= authenticationTagBytes ||
		ciphertext.byteLength >
			SNAPSHOT_LINK_LIMITS.maximumCompressedBytes + authenticationTagBytes
	) {
		throw new SnapshotCodecError(
			"malformed_token",
			"The snapshot link contains an invalid encrypted payload.",
		);
	}
	return { encryptionKey, initializationVector, ciphertext };
}

export async function decodeSnapshotToken(
	token: string,
): Promise<SharedSnapshot> {
	if (typeof token !== "string") {
		throw new SnapshotCodecError(
			"malformed_token",
			"The snapshot link must contain a text token.",
		);
	}
	const { encryptionKey, initializationVector, ciphertext } = parseToken(token);
	const cryptoProvider = runtimeCrypto();
	let compressedSnapshot: ArrayBuffer;
	try {
		const importedKey = await cryptoProvider.subtle.importKey(
			"raw",
			bytesAsArrayBuffer(encryptionKey),
			{ name: "AES-GCM" },
			false,
			["decrypt"],
		);
		compressedSnapshot = await cryptoProvider.subtle.decrypt(
			{
				name: "AES-GCM",
				// biome-ignore lint/style/useNamingConvention: Web Crypto defines this field name.
				iv: bytesAsArrayBuffer(initializationVector),
				additionalData: bytesAsArrayBuffer(encryptionAdditionalData),
			},
			importedKey,
			bytesAsArrayBuffer(ciphertext),
		);
	} catch (error) {
		throw new SnapshotCodecError(
			"decryption_failed",
			"This snapshot link is invalid or has been altered.",
			error,
		);
	}

	const jsonBytes = await decompressBytes(new Uint8Array(compressedSnapshot));
	let parsedSnapshot: unknown;
	try {
		const serializedSnapshot = new TextDecoder("utf-8", { fatal: true }).decode(
			jsonBytes,
		);
		parsedSnapshot = JSON.parse(serializedSnapshot);
	} catch (error) {
		throw new SnapshotCodecError(
			"invalid_snapshot",
			"The snapshot does not contain valid data.",
			error,
		);
	}
	return validatedSnapshot(parsedSnapshot);
}
