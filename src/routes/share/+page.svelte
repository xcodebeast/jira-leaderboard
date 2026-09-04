<script lang="ts">
import { onMount } from "svelte";
import { base } from "$app/paths";
import {
	decodeSnapshotToken,
	SnapshotCodecError,
} from "$lib/browser/snapshot-link";
import LogoMark from "$lib/components/LogoMark.svelte";
import SharedSnapshotViewer from "$lib/components/SharedSnapshotViewer.svelte";
import Badge from "$lib/components/ui/Badge.svelte";
import Card from "$lib/components/ui/Card.svelte";
import LinkButton from "$lib/components/ui/LinkButton.svelte";
import LoadingState from "$lib/components/ui/LoadingState.svelte";
import type { SharedSnapshot } from "$lib/snapshot/schema";

type UnavailableReason =
	| "incomplete"
	| "invalid"
	| "too-large"
	| "unsupported-browser"
	| "unsupported-version";

type PageState =
	| { status: "loading" }
	| { status: "ready"; snapshot: SharedSnapshot }
	| { status: "unavailable"; reason: UnavailableReason };

const unavailableContent: Record<
	UnavailableReason,
	{ heading: string; message: string }
> = {
	incomplete: {
		heading: "This snapshot link is incomplete",
		message:
			"The frozen report belongs in the part of the link after the # symbol. Ask the sender to copy and share the complete link again.",
	},
	invalid: {
		heading: "This snapshot cannot be opened",
		message:
			"The link is invalid, damaged, or has been altered. Ask the sender to create a new frozen snapshot link.",
	},
	"too-large": {
		heading: "This snapshot is too large",
		message:
			"The link exceeds the safe size supported by Jira Leaderboard. Ask the sender to share a smaller report.",
	},
	"unsupported-browser": {
		heading: "This browser cannot open the snapshot",
		message:
			"Opening this link requires browser support for local encryption and compression. Try an up-to-date browser.",
	},
	"unsupported-version": {
		heading: "This snapshot version is not supported",
		message:
			"The link was created with a different Jira Leaderboard snapshot format. Open it with a compatible app version or ask the sender for a new link.",
	},
};

let pageState = $state<PageState>({ status: "loading" });
let decodeRevision = 0;

const capturedAtFormatter = new Intl.DateTimeFormat("en-US", {
	year: "numeric",
	month: "short",
	day: "numeric",
	hour: "numeric",
	minute: "2-digit",
	timeZoneName: "short",
});

function unavailableReason(error: unknown): UnavailableReason {
	if (!(error instanceof SnapshotCodecError)) {
		return "invalid";
	}

	switch (error.code) {
		case "snapshot_too_large":
		case "token_too_large":
			return "too-large";
		case "unsupported_runtime":
			return "unsupported-browser";
		case "unsupported_snapshot_version":
		case "unsupported_token_version":
			return "unsupported-version";
		default:
			return "invalid";
	}
}

async function decodeCurrentFragment(): Promise<void> {
	const currentRevision = ++decodeRevision;
	const token = window.location.hash.startsWith("#")
		? window.location.hash.slice(1)
		: "";

	if (!token) {
		pageState = { status: "unavailable", reason: "incomplete" };
		return;
	}

	pageState = { status: "loading" };
	try {
		const snapshot = await decodeSnapshotToken(token);
		if (currentRevision === decodeRevision) {
			pageState = { status: "ready", snapshot };
		}
	} catch (error) {
		if (currentRevision === decodeRevision) {
			pageState = {
				status: "unavailable",
				reason: unavailableReason(error),
			};
		}
	}
}

onMount(() => {
	const handleHashChange = (): void => {
		void decodeCurrentFragment();
	};
	void decodeCurrentFragment();
	window.addEventListener("hashchange", handleHashChange);
	return () => {
		decodeRevision += 1;
		window.removeEventListener("hashchange", handleHashChange);
	};
});
</script>

<svelte:head>
	<title>Frozen shared snapshot · Jira Leaderboard</title>
	<meta
		name="description"
		content="A frozen Jira Leaderboard snapshot that is opened locally in your browser."
	>
	<meta name="robots" content="noindex, nofollow, noarchive">
	<meta name="referrer" content="no-referrer">
</svelte:head>

<div class="min-h-screen">
	<header class="border-b border-line/75 bg-canvas/78 backdrop-blur-xl">
		<div
			class="mx-auto flex max-w-[94rem] items-center justify-between gap-4 px-5 py-4 sm:px-8"
		>
			<LogoMark />
			<Badge tone="neutral">Public snapshot</Badge>
		</div>
	</header>

	<main class="mx-auto max-w-[94rem] px-5 py-8 sm:px-8 sm:py-10">
		<section aria-labelledby="shared-snapshot-title">
			<p class="eyebrow">Read-only report</p>
			<h1
				id="shared-snapshot-title"
				class="display-title mt-3 text-4xl leading-none text-ice sm:text-5xl"
			>
				Frozen shared snapshot
			</h1>
			{#if pageState.status === "ready"}
				<p class="mt-3 text-sm leading-6 text-muted">
					Captured
					<time datetime={pageState.snapshot.capturedAt}>
						{capturedAtFormatter.format(new Date(pageState.snapshot.capturedAt))}
					</time>
				</p>
			{/if}
		</section>

		<div
			class="mt-6 inline-flex max-w-full items-center gap-3 rounded-full border border-sky/25 bg-sky/8 px-4 py-2.5 text-sm leading-5 text-ice"
		>
			<span
				class="size-2 shrink-0 rounded-full bg-sky shadow-[0_0_12px_rgb(98_202_217/0.55)]"
				aria-hidden="true"
			></span>
			<p>
				This is a frozen snapshot only accessible through the provided link.
			</p>
		</div>

		<div class="mt-8">
			{#if pageState.status === "loading"}
				<Card class="rounded-[1.2rem]">
					<LoadingState message="Opening the frozen snapshot…" />
				</Card>
			{:else if pageState.status === "unavailable"}
				<Card class="rounded-[1.2rem] px-6 py-12 text-center" accent="danger">
					<div role="alert">
						<span
							class="mx-auto grid size-11 place-items-center rounded-full border border-coral/30 bg-coral/10 text-lg font-extrabold text-coral"
							aria-hidden="true"
							>!</span
						>
						<h2 class="mt-4 text-xl font-extrabold text-ice">
							{unavailableContent[pageState.reason].heading}
						</h2>
						<p class="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted">
							{unavailableContent[pageState.reason].message}
						</p>
					</div>
					<div class="mt-6 flex justify-center">
						<LinkButton href={`${base}/`} variant="secondary">
							Open Jira Leaderboard
						</LinkButton>
					</div>
				</Card>
			{:else}
				<SharedSnapshotViewer snapshot={pageState.snapshot} />
			{/if}
		</div>
	</main>

	<footer
		class="mx-auto max-w-[94rem] px-5 pb-10 text-xs leading-5 text-muted sm:px-8"
	>
		This page cannot update the report, verify its author, or request newer Jira
		data.
	</footer>
</div>
