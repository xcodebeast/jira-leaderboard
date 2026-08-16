<script lang="ts">
import type { ConnectedSession } from "../browser/api-client";
import type { AppConfiguration } from "../browser/configuration";

interface Properties {
	configuration: AppConfiguration;
	session: ConnectedSession;
	onSaveConfiguration: (configuration: AppConfiguration) => void;
	onChangeSetup: () => void;
	onReconnect: () => void;
	onErase: () => void;
}

let {
	configuration,
	session,
	onSaveConfiguration,
	onChangeSetup,
	onReconnect,
	onErase,
}: Properties = $props();
let defaultProjectKey = $state("");
let hasInitializedProjectKey = $state(false);
let savedMessage = $state("");

$effect(() => {
	if (!hasInitializedProjectKey) {
		defaultProjectKey = configuration.defaultProjectKey;
		hasInitializedProjectKey = true;
	}
});

function saveProjectKey(event: SubmitEvent): void {
	event.preventDefault();
	if (!defaultProjectKey.trim()) {
		return;
	}
	onSaveConfiguration({
		...configuration,
		defaultProjectKey: defaultProjectKey.trim(),
	});
	savedMessage = "Saved in this browser";
	window.setTimeout(() => (savedMessage = ""), 2_000);
}

function confirmErase(): void {
	if (
		window.confirm(
			"Remove the encrypted Jira session and all saved browser preferences?",
		)
	) {
		onErase();
	}
}
</script>

<main class="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
	<header class="max-w-2xl">
		<p class="eyebrow">Configuration</p>
		<h1
			class="mt-3 text-3xl font-bold tracking-[-0.035em] text-white sm:text-4xl"
		>
			Settings
		</h1>
		<p class="mt-3 text-sm leading-6 text-muted">
			Manage the browser-local mappings and the encrypted Jira session.
		</p>
	</header>

	<div class="mt-8 grid gap-6 lg:grid-cols-2">
		<section class="surface-card rounded-2xl p-5 sm:p-6">
			<div class="flex items-start justify-between gap-4">
				<div>
					<p class="eyebrow">Jira connection</p>
					<h2 class="mt-2 text-lg font-bold text-white">
						{session.jiraSiteUrl.replace("https://", "")}
					</h2>
				</div>
				<span
					class="rounded-full border border-mint/20 bg-mint/8 px-3 py-1 text-xs font-semibold text-mint"
					>Connected</span
				>
			</div>
			<dl class="mt-6 space-y-4 text-sm">
				<div
					class="flex items-center justify-between gap-4 border-b border-line/60 pb-4"
				>
					<dt class="text-muted">Email</dt>
					<dd class="truncate font-medium text-ice">{session.emailAddress}</dd>
				</div>
				<div
					class="flex items-center justify-between gap-4 border-b border-line/60 pb-4"
				>
					<dt class="text-muted">Authentication</dt>
					<dd class="font-medium text-ice">
						{session.authenticationMode === "scoped"
							? "Scoped API token"
							: "Classic API token"}
					</dd>
				</div>
				<div
					class="flex items-center justify-between gap-4 border-b border-line/60 pb-4"
				>
					<dt class="text-muted">Credential storage</dt>
					<dd class="font-medium text-ice">Encrypted cookie</dd>
				</div>
				<div class="flex items-center justify-between gap-4">
					<dt class="text-muted">Server database</dt>
					<dd class="font-medium text-mint">None</dd>
				</div>
			</dl>
			<button
				class="secondary-button mt-7 w-full"
				type="button"
				onclick={onReconnect}
			>
				Replace Jira credentials
			</button>
		</section>

		<section class="surface-card rounded-2xl p-5 sm:p-6">
			<p class="eyebrow">Report defaults</p>
			<h2 class="mt-2 text-lg font-bold text-white">
				{configuration.boardName}
			</h2>
			<p class="mt-1 font-mono text-xs text-muted">
				Board #{configuration.boardIdentifier}
			</p>
			<form class="mt-6" onsubmit={saveProjectKey}>
				<label class="block">
					<span class="mb-2 block text-sm font-semibold text-ice"
						>Default project key</span
					>
					<div class="flex gap-3">
						<input
							class="field-control"
							bind:value={defaultProjectKey}
							required
						>
						<button class="primary-button shrink-0" type="submit">Save</button>
					</div>
				</label>
				{#if savedMessage}
					<p class="mt-2 text-xs font-medium text-mint">{savedMessage}</p>
				{/if}
			</form>
			<button
				class="secondary-button mt-7 w-full"
				type="button"
				onclick={onChangeSetup}
			>
				Change board or field mappings
			</button>
		</section>
	</div>

	<section class="surface-card mt-6 rounded-2xl p-5 sm:p-6">
		<p class="eyebrow">Development mappings</p>
		<div class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each [
				["Story points", configuration.fieldMapping.storyPointsFieldIdentifier],
				["Developer", configuration.fieldMapping.developerFieldIdentifier],
				["Bounce count", configuration.fieldMapping.bounceCountFieldIdentifier],
				["Done", configuration.statusMapping.done],
				["QA", configuration.statusMapping.qualityAssurance],
				["Ready for QA", configuration.statusMapping.readyForQualityAssurance],
			] as mapping (mapping[0])}
				<div class="rounded-xl border border-line/70 bg-canvas/30 px-4 py-3">
					<p class="text-xs text-muted">{mapping[0]}</p>
					<p
						class="mt-1 truncate font-mono text-xs font-semibold text-ice"
						title={mapping[1]}
					>
						{mapping[1]}
					</p>
				</div>
			{/each}
		</div>
	</section>

	<section class="surface-card mt-6 rounded-2xl p-5 sm:p-6">
		<div
			class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"
		>
			<div>
				<p class="eyebrow">QA leaderboard</p>
				<h2 class="mt-2 text-lg font-bold text-white">
					{configuration.qualityAssurance?.boardName ?? "Not configured"}
				</h2>
			</div>
			{#if configuration.qualityAssurance}
				<p class="font-mono text-xs text-muted">
					Board #{configuration.qualityAssurance.boardIdentifier}
				</p>
			{/if}
		</div>
		{#if configuration.qualityAssurance}
			<div class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{#each [
					["Story points", configuration.qualityAssurance.fieldMapping.storyPointsFieldIdentifier],
					["Tester", configuration.qualityAssurance.fieldMapping.testerFieldIdentifier],
					["Done", configuration.qualityAssurance.statusMapping.done],
					["Ready for QA", configuration.qualityAssurance.statusMapping.readyForQualityAssurance],
				] as mapping (mapping[0])}
					<div class="rounded-xl border border-line/70 bg-canvas/30 px-4 py-3">
						<p class="text-xs text-muted">{mapping[0]}</p>
						<p
							class="mt-1 truncate font-mono text-xs font-semibold text-ice"
							title={mapping[1]}
						>
							{mapping[1]}
						</p>
					</div>
				{/each}
			</div>
		{:else}
			<p class="mt-3 text-sm leading-6 text-muted">
				Run board setup again to add an optional Tester-based QA leaderboard.
			</p>
		{/if}
	</section>

	<section
		class="mt-8 rounded-2xl border border-coral/20 bg-coral/5 p-5 sm:flex sm:items-center sm:justify-between sm:gap-8"
	>
		<div>
			<h2 class="font-bold text-[#ffd8d0]">Erase this browser’s setup</h2>
			<p class="mt-1 text-sm leading-6 text-muted">
				Removes the encrypted credential cookie and all local preferences.
				Nothing is deleted from Jira.
			</p>
		</div>
		<button
			class="mt-4 shrink-0 rounded-xl border border-coral/35 px-4 py-2 text-sm font-bold text-coral hover:bg-coral/10 sm:mt-0"
			type="button"
			onclick={confirmErase}
		>
			Erase local data
		</button>
	</section>
</main>
