<script lang="ts">
import { onMount } from "svelte";
import { type ConnectedSession, connectJira } from "../browser/api-client";
import {
	loadRememberedJiraSiteUrl,
	saveRememberedJiraSiteUrl,
} from "../browser/configuration";
import ErrorBanner from "./ErrorBanner.svelte";
import LogoMark from "./LogoMark.svelte";
import TokenCreationModal from "./TokenCreationModal.svelte";

interface Properties {
	onConnected: (session: ConnectedSession) => void;
}

let { onConnected }: Properties = $props();
let jiraSiteUrl = $state("");
let emailAddress = $state("");
let apiToken = $state("");
let showsToken = $state(false);
let isConnecting = $state(false);
let errorMessage = $state("");
let showsTokenTutorial = $state(false);

async function handleSubmit(event: SubmitEvent): Promise<void> {
	event.preventDefault();
	isConnecting = true;
	errorMessage = "";
	try {
		const connectedSession = await connectJira({
			jiraSiteUrl,
			emailAddress,
			apiToken,
		});
		saveRememberedJiraSiteUrl(connectedSession.jiraSiteUrl);
		onConnected(connectedSession);
	} catch (error) {
		errorMessage =
			error instanceof Error ? error.message : "Jira could not be connected.";
	} finally {
		isConnecting = false;
	}
}

onMount(() => {
	if (!jiraSiteUrl) {
		jiraSiteUrl = loadRememberedJiraSiteUrl();
	}
});
</script>

<main
	class="subtle-grid min-h-screen px-5 py-8 sm:px-8 lg:grid lg:place-items-center lg:py-12"
>
	<div
		class="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center"
	>
		<section class="max-w-xl py-4 lg:py-12">
			<LogoMark />
			<h1
				class="mt-4 text-4xl font-bold leading-[1.04] tracking-[-0.05em] text-white sm:text-6xl"
			>
				Turn Jira activity into a clear team signal.
			</h1>
			<p class="mt-6 max-w-lg text-base leading-7 text-muted sm:text-lg">
				See completed work, projected points, bounces, and period-over-period
				movement without exporting a spreadsheet.
			</p>

			<div class="mt-10 grid gap-4 sm:grid-cols-3">
				<p
					class="border-l border-mint/30 pl-4 mt-2 text-md font-semibold text-ice"
				>
					Open source
				</p>
				<p
					class="border-l border-violet/30 pl-4 mt-2 text-md font-semibold text-ice"
				>
					No data storage
				</p>
				<p
					class="border-l border-coral/30 pl-4 mt-2 text-md font-semibold text-ice"
				>
					One-time setup
				</p>
			</div>
		</section>

		<section class="surface-card rounded-3xl p-5 sm:p-8">
			<div class="flex items-start justify-between gap-4">
				<h2 class="mt-2 text-2xl font-bold tracking-tight text-white">
					Connect workspace
				</h2>
			</div>

			<form class="mt-7 space-y-5" onsubmit={handleSubmit}>
				<label class="block">
					<span class="mb-2 block text-sm font-semibold text-ice"
						>Jira site</span
					>
					<input
						class="field-control"
						name="jiraSiteUrl"
						type="url"
						autocomplete="url"
						placeholder="https://company.atlassian.net"
						bind:value={jiraSiteUrl}
						required
					>
				</label>
				<label class="block">
					<span class="mb-2 block text-sm font-semibold text-ice"
						>Jira email</span
					>
					<input
						class="field-control"
						name="emailAddress"
						type="email"
						autocomplete="username"
						placeholder="name@company.com"
						bind:value={emailAddress}
						required
					>
				</label>
				<div class="block">
					<div
						class="mb-2 flex items-center justify-between gap-3 text-sm font-semibold text-ice"
					>
						<label for="jira-api-token">API token</label>
						<button
							class="text-xs font-medium text-mint hover:underline"
							type="button"
							onclick={() => (showsTokenTutorial = true)}
						>
							Create token
						</button>
					</div>
					<div class="relative">
						<input
							id="jira-api-token"
							class="field-control pr-20"
							name="apiToken"
							type={showsToken ? "text" : "password"}
							autocomplete="current-password"
							placeholder="Paste your read-only token"
							bind:value={apiToken}
							required
						>
						<button
							class="absolute inset-y-0 right-3 text-xs font-semibold text-muted hover:text-ice"
							type="button"
							onclick={() => (showsToken = !showsToken)}
						>
							{showsToken ? "Hide" : "Show"}
						</button>
					</div>
				</div>

				{#if errorMessage}
					<ErrorBanner message={errorMessage} />
				{/if}

				<button
					class="primary-button w-full"
					type="submit"
					disabled={isConnecting}
				>
					{isConnecting ? "Checking Jira…" : "Connect Jira"}
					<span aria-hidden="true">→</span>
				</button>
			</form>
		</section>
	</div>
</main>

{#if showsTokenTutorial}
	<TokenCreationModal onClose={() => (showsTokenTutorial = false)} />
{/if}
