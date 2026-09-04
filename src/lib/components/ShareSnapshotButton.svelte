<script lang="ts">
import { onDestroy, untrack } from "svelte";
import { base } from "$app/paths";
import {
	encodeSnapshotToken,
	SnapshotCodecError,
} from "../browser/snapshot-link";
import type { SharedSnapshot } from "../snapshot/schema";
import Button from "./ui/Button.svelte";
import Icon from "./ui/Icon.svelte";

interface Properties {
	createSnapshot: () => SharedSnapshot;
	snapshotIdentity: string;
	disabled?: boolean;
}

type SharingStatus = "idle" | "copied" | "manual-copy";

const portabilityWarningLength = 16_000;
const sharingConfirmation =
	"Create a frozen snapshot of this report?\n\nThe copy includes contributor names and scores, plus ticket keys and summaries where present. Jira Leaderboard does not upload it: the snapshot is stored entirely in the link. Anyone with the complete link can read and forward it. The link cannot be revoked, updated, or made private later.";

let {
	createSnapshot,
	snapshotIdentity,
	disabled = false,
}: Properties = $props();
let isCreatingLink = $state(false);
let sharingStatus = $state<SharingStatus>("idle");
let shareUrl = $state("");
let errorMessage = $state("");
let hasPortabilityWarning = $state(false);
let fallbackLinkInput = $state<HTMLInputElement>();
let sharingOperationRevision = 0;
let previousSnapshotIdentity = untrack(() => snapshotIdentity);
let wasDisabled = untrack(() => disabled);

function resetShareState(): void {
	sharingOperationRevision += 1;
	isCreatingLink = false;
	sharingStatus = "idle";
	shareUrl = "";
	errorMessage = "";
	hasPortabilityWarning = false;
}

$effect(() => {
	if (
		snapshotIdentity !== previousSnapshotIdentity ||
		disabled !== wasDisabled
	) {
		previousSnapshotIdentity = snapshotIdentity;
		wasDisabled = disabled;
		resetShareState();
	}
});

onDestroy(() => {
	sharingOperationRevision += 1;
});

function safeErrorMessage(error: unknown): string {
	if (!(error instanceof SnapshotCodecError)) {
		return "The snapshot link could not be created. Try again.";
	}

	switch (error.code) {
		case "snapshot_too_large":
		case "token_too_large":
			return "This report has too much detail for a reliable link. URL-only sharing cannot store a snapshot this large.";
		case "unsupported_runtime":
			return "This browser cannot create snapshot links. Try again in a current browser.";
		default:
			return "The snapshot link could not be created. Try again.";
	}
}

function buildShareUrl(snapshotToken: string): string {
	const sharePageUrl = new URL(`${base}/share`, window.location.origin);
	return `${sharePageUrl.toString()}#${snapshotToken}`;
}

async function tryCopyShareUrl(url: string): Promise<boolean> {
	if (
		typeof navigator === "undefined" ||
		typeof navigator.clipboard?.writeText !== "function"
	) {
		return false;
	}

	try {
		await navigator.clipboard.writeText(url);
		return true;
	} catch {
		return false;
	}
}

async function shareSnapshot(): Promise<void> {
	if (
		disabled ||
		typeof window === "undefined" ||
		!window.confirm(sharingConfirmation)
	) {
		return;
	}

	const requestedSnapshotIdentity = snapshotIdentity;
	const operationRevision = ++sharingOperationRevision;
	isCreatingLink = true;
	sharingStatus = "idle";
	shareUrl = "";
	errorMessage = "";
	hasPortabilityWarning = false;

	try {
		const snapshotToken = await encodeSnapshotToken(createSnapshot());
		if (
			operationRevision !== sharingOperationRevision ||
			requestedSnapshotIdentity !== snapshotIdentity ||
			disabled
		) {
			return;
		}
		const generatedShareUrl = buildShareUrl(snapshotToken);
		const didCopyShareUrl = await tryCopyShareUrl(generatedShareUrl);
		if (
			operationRevision !== sharingOperationRevision ||
			requestedSnapshotIdentity !== snapshotIdentity ||
			disabled
		) {
			return;
		}
		shareUrl = generatedShareUrl;
		hasPortabilityWarning = shareUrl.length > portabilityWarningLength;
		sharingStatus = didCopyShareUrl ? "copied" : "manual-copy";
	} catch (error) {
		if (operationRevision === sharingOperationRevision) {
			errorMessage = safeErrorMessage(error);
		}
	} finally {
		if (operationRevision === sharingOperationRevision) {
			isCreatingLink = false;
		}
	}
}

async function copyFallbackLink(): Promise<void> {
	const urlToCopy = shareUrl;
	const operationRevision = sharingOperationRevision;
	const didCopyShareUrl = await tryCopyShareUrl(urlToCopy);

	if (
		operationRevision !== sharingOperationRevision ||
		urlToCopy !== shareUrl ||
		sharingStatus !== "manual-copy"
	) {
		return;
	}

	if (didCopyShareUrl) {
		errorMessage = "";
		sharingStatus = "copied";
		return;
	}

	fallbackLinkInput?.focus();
	fallbackLinkInput?.select();
	errorMessage =
		"Your browser blocked copying. The link is selected so you can copy it manually.";
}
</script>

<div class="flex min-w-0 flex-col items-start gap-3">
	<Button
		variant="secondary"
		onclick={shareSnapshot}
		loading={isCreatingLink}
		{disabled}
	>
		{isCreatingLink ? "Creating snapshot…" : "Share snapshot"}
	</Button>

	{#if sharingStatus === "copied"}
		<p class="text-sm leading-6 text-mint" role="status" aria-live="polite">
			Snapshot link copied. It opens a frozen, read-only report.
		</p>
	{:else if sharingStatus === "manual-copy"}
		<div
			class="w-full max-w-2xl rounded-[0.9rem] border border-line bg-panel-soft/55 p-4"
		>
			<p class="text-sm leading-6 text-ice" role="status" aria-live="polite">
				The link is ready, but automatic copying was unavailable. Use the copy
				button or copy the link directly.
			</p>
			<div class="mt-3 flex min-w-0 items-center gap-2">
				<label class="block min-w-0 flex-1">
					<span class="screen-reader-only">Snapshot share link</span>
					<input
						bind:this={fallbackLinkInput}
						class="field-control min-w-0 font-mono text-xs"
						type="text"
						value={shareUrl}
						readonly
					>
				</label>
				<Button
					variant="secondary"
					size="icon"
					onclick={copyFallbackLink}
					aria-label="Copy snapshot link"
					title="Copy snapshot link"
				>
					<Icon name="copy" size={18} />
				</Button>
			</div>
		</div>
	{/if}

	{#if hasPortabilityWarning}
		<p
			class="max-w-2xl rounded-[0.8rem] border border-brand/25 bg-brand/8 px-3 py-2 text-xs leading-5 text-brand"
			role="status"
		>
			This is a long link, so some chat or email tools may shorten it. Send it
			as plain text and ask the recipient to verify that it opens.
		</p>
	{/if}

	{#if errorMessage}
		<p
			class="max-w-2xl rounded-[0.8rem] border border-coral/30 bg-coral/8 px-3 py-2 text-sm leading-6 text-[#ffd8d2]"
			role="alert"
		>
			{errorMessage}
		</p>
	{/if}
</div>
