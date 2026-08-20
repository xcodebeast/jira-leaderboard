<script lang="ts">
import { onMount } from "svelte";
import { type ConnectedSession, connectJira } from "../browser/api-client";
import {
	loadRememberedJiraSiteUrl,
	saveRememberedJiraSiteUrl,
} from "../browser/configuration";
import GitHubIcon from "./icons/GitHubIcon.svelte";
import LogoMark from "./LogoMark.svelte";
import TokenCreationModal from "./TokenCreationModal.svelte";
import Alert from "./ui/Alert.svelte";
import Button from "./ui/Button.svelte";
import Card from "./ui/Card.svelte";
import Field from "./ui/Field.svelte";
import Icon from "./ui/Icon.svelte";
import Input from "./ui/Input.svelte";

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
	class="subtle-grid min-h-screen px-5 py-7 sm:px-8 lg:grid lg:place-items-center lg:py-12"
>
	<div
		class="mx-auto grid w-full max-w-6xl gap-1 lg:grid-cols-[1.08fr_0.94fr] lg:items-center xl:gap-16"
	>
		<section class="max-w-xl py-4 lg:py-10">
			<LogoMark />
			<h1
				class="display-title mt-5 text-5xl leading-[0.98] text-ice sm:text-6xl"
			>
				Make sprints fun again.
			</h1>
			<p class="mt-6 max-w-lg text-base leading-7 text-muted sm:text-lg">
				Turn Jira work into a shared team score: celebrate delivery, surface
				quality signals, and build momentum sprint after sprint.
			</p>

			<div class="mt-7 grid gap-3 sm:grid-cols-3">
				<div class="flex items-center gap-2.5 text-sm font-bold text-ice">
					<span
						class="grid size-8 place-items-center rounded-lg bg-brand/10 text-brand"
						><Icon name="trophy" size={16} /></span
					>
					Celebrate wins
				</div>
				<div class="flex items-center gap-2.5 text-sm font-bold text-ice">
					<span
						class="grid size-8 place-items-center rounded-lg bg-sky/10 text-sky"
						><Icon name="spark" size={16} /></span
					>
					Spot momentum
				</div>
				<div class="flex items-center gap-2.5 text-sm font-bold text-ice">
					<span
						class="grid size-8 place-items-center rounded-lg bg-mint/10 text-mint"
						><Icon name="shield" size={16} /></span
					>
					Local only
				</div>
			</div>

			<a
				class="mt-12 inline-flex items-center gap-2 text-sm font-bold text-muted transition-colors hover:text-brand"
				href="https://github.com/xcodebeast/jira-leaderboard"
				target="_blank"
				rel="noreferrer"
			>
				<GitHubIcon />
				Source code
			</a>
		</section>

		<Card class="rounded-[1.3rem] sm:p-8" accent="brand">
			<h2 class="mt-3 text-2xl font-extrabold tracking-tight text-ice">
				Connect workspace
			</h2>

			<form class="mt-7 space-y-5" onsubmit={handleSubmit}>
				<Field label="Jira site" required>
					<Input
						name="jiraSiteUrl"
						type="url"
						autocomplete="url"
						placeholder="https://company.atlassian.net"
						bind:value={jiraSiteUrl}
						required
					/>
				</Field>
				<Field label="Jira email" required>
					<Input
						name="emailAddress"
						type="email"
						autocomplete="username"
						placeholder="name@company.com"
						bind:value={emailAddress}
						required
					/>
				</Field>
				<div>
					<div class="mb-2 flex items-center justify-between gap-3">
						<label class="text-sm font-bold text-ice" for="jira-api-token"
							>API token
							<span class="text-brand" aria-hidden="true">*</span></label
						>
						<button
							class="text-xs font-bold text-brand hover:underline"
							type="button"
							onclick={() => (showsTokenTutorial = true)}
						>
							How to create one
						</button>
					</div>
					<div class="relative">
						<Input
							id="jira-api-token"
							class="pr-20"
							name="apiToken"
							type={showsToken ? "text" : "password"}
							autocomplete="current-password"
							placeholder="Paste your read-only token"
							bind:value={apiToken}
							required
						/>
						<button
							class="absolute inset-y-0 right-3 text-xs font-bold text-muted hover:text-ice"
							type="button"
							onclick={() => (showsToken = !showsToken)}
						>
							{showsToken ? "Hide" : "Show"}
						</button>
					</div>
				</div>

				{#if errorMessage}
					<Alert message={errorMessage} />
				{/if}

				<Button
					class="w-full"
					variant="primary"
					size="large"
					type="submit"
					loading={isConnecting}
				>
					{isConnecting ? "Checking Jira…" : "Connect Jira"}
					<Icon name="arrowRight" size={17} />
				</Button>
				<p class="text-center text-[0.68rem] leading-5 text-muted">
					Credentials are encrypted and stored in your browser
				</p>
			</form>
		</Card>
	</div>
</main>

{#if showsTokenTutorial}
	<TokenCreationModal onClose={() => (showsTokenTutorial = false)} />
{/if}
