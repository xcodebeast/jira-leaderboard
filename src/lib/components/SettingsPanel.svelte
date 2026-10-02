<script lang="ts">
import type { ConnectedSession } from "../browser/api-client";
import type { AppConfiguration } from "../browser/configuration";
import Badge from "./ui/Badge.svelte";
import Button from "./ui/Button.svelte";
import Card from "./ui/Card.svelte";
import Field from "./ui/Field.svelte";
import Input from "./ui/Input.svelte";

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
			"Remove the encrypted Jira session, all saved browser preferences, and cached leaderboard scores?",
		)
	) {
		onErase();
	}
}
</script>

<main class="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
	<header class="max-w-2xl">
		<h1 class="display-title mt-3 text-4xl leading-none text-ice sm:text-5xl">
			Settings
		</h1>
	</header>

	<div class="mt-8 grid gap-6 lg:grid-cols-2">
		<Card class="rounded-[1.2rem] p-5 sm:p-6" accent="success">
			<div
				class="flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4"
			>
				<div class="min-w-0">
					<p class="eyebrow">Jira connection</p>
					<h2 class="mt-2 break-words text-lg font-bold text-white">
						{session.jiraSiteUrl.replace("https://", "")}
					</h2>
				</div>
			</div>
			<dl class="mt-6 space-y-4 text-sm">
				<div
					class="flex items-center justify-between gap-4 border-b border-line/60 pb-4"
				>
					<dt class="text-muted">Email</dt>
					<dd class="truncate font-medium text-ice">
						{session.emailAddress}
					</dd>
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
			<Button class="mt-7 w-full" variant="secondary" onclick={onReconnect}>
				Replace Jira credentials
			</Button>
		</Card>

		<Card class="rounded-[1.2rem] p-5 sm:p-6" accent="brand">
			<p class="eyebrow">Report defaults</p>
			<h2 class="mt-2 text-lg font-bold text-white">
				{configuration.boardName}
			</h2>
			<p class="mt-1 font-mono text-xs text-muted">
				Board #{configuration.boardIdentifier}
			</p>
			<form class="mt-6" onsubmit={saveProjectKey}>
				<Field label="Default project key">
					<div class="flex gap-3">
						<Input bind:value={defaultProjectKey} required />
						<Button variant="primary" type="submit">Save</Button>
					</div>
				</Field>
				<p
					class="mt-2 min-h-4 text-xs font-medium text-mint"
					role="status"
					aria-live="polite"
					aria-atomic="true"
				>
					{savedMessage}
				</p>
			</form>
			<Button class="mt-7 w-full" variant="secondary" onclick={onChangeSetup}>
				Change board or field mappings
			</Button>
		</Card>
	</div>

	<Card class="mt-6 rounded-[1.2rem] p-5 sm:p-6">
		<p class="eyebrow">Development mappings</p>
		<div class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each [["Story points", configuration.fieldMapping.storyPointsFieldIdentifier], ["Developer", configuration.fieldMapping.developerFieldIdentifier], ["Bounce count", configuration.fieldMapping.bounceCountFieldIdentifier], ["Done", configuration.statusMapping.done], ["QA", configuration.statusMapping.qualityAssurance], ["Ready for QA", configuration.statusMapping.readyForQualityAssurance]] as mapping (mapping[0])}
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
	</Card>

	<Card class="mt-6 rounded-[1.2rem] p-5 sm:p-6">
		<div
			class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"
		>
			<div>
				<p class="eyebrow">Quality assurance</p>
				<h2 class="mt-2 text-lg font-bold text-white">
					{configuration.qualityAssurance?.boardName ??
						"Not configured"}
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
				{#each [["Story points", configuration.qualityAssurance.fieldMapping.storyPointsFieldIdentifier], ["Tester", configuration.qualityAssurance.fieldMapping.testerFieldIdentifier], ["Done", configuration.qualityAssurance.statusMapping.done], ["Ready for QA", configuration.qualityAssurance.statusMapping.readyForQualityAssurance]] as mapping (mapping[0])}
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
				Run board setup again to add Tester-owned QA performance to the sprint
				view and leaderboard.
			</p>
		{/if}
	</Card>

	<Card
		class="mt-8 rounded-[1.2rem] border-coral/25 bg-coral/5 p-5 sm:flex sm:items-center sm:justify-between sm:gap-8"
		accent="danger"
	>
		<div>
			<h2 class="font-bold text-[#ffd8d0]">Erase this browser’s setup</h2>
			<p class="mt-1 text-sm leading-6 text-muted">
				Removes the encrypted credential cookie, local preferences, and cached
				leaderboard scores. Nothing is deleted from Jira.
			</p>
		</div>
		<Button class="mt-4 sm:mt-0" variant="danger" onclick={confirmErase}>
			Erase local data
		</Button>
	</Card>
</main>
