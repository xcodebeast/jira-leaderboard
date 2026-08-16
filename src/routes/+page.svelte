<script lang="ts">
import { onMount } from "svelte";
import {
	type ConnectedSession,
	disconnectJira,
	loadSession,
	type SessionStatus,
} from "$lib/browser/api-client";
import {
	type AppConfiguration,
	clearConfiguration,
	loadConfiguration,
	saveConfiguration,
	saveRememberedJiraSiteUrl,
} from "$lib/browser/configuration";
import AllTimeDashboard from "$lib/components/AllTimeDashboard.svelte";
import AppShell from "$lib/components/AppShell.svelte";
import BoardSetup from "$lib/components/BoardSetup.svelte";
import ErrorBanner from "$lib/components/ErrorBanner.svelte";
import LoadingState from "$lib/components/LoadingState.svelte";
import LogoMark from "$lib/components/LogoMark.svelte";
import Onboarding from "$lib/components/Onboarding.svelte";
import PeriodComparison from "$lib/components/PeriodComparison.svelte";
import QualityAssuranceDashboard from "$lib/components/QualityAssuranceDashboard.svelte";
import SettingsPanel from "$lib/components/SettingsPanel.svelte";
import SprintDashboard from "$lib/components/SprintDashboard.svelte";

type ApplicationView =
	| "sprint"
	| "qualityAssurance"
	| "allTime"
	| "period"
	| "settings";

let session = $state<SessionStatus>({ connected: false });
let configuration = $state<AppConfiguration | null>(null);
let activeView = $state<ApplicationView>("sprint");
let isInitializing = $state(true);
let initializationError = $state("");

async function initializeApplication(): Promise<void> {
	isInitializing = true;
	initializationError = "";
	try {
		configuration = loadConfiguration();
		session = await loadSession();
	} catch (error) {
		initializationError =
			error instanceof Error
				? error.message
				: "Jira Leaderboard could not start.";
	} finally {
		isInitializing = false;
	}
}

function handleConnected(connectedSession: ConnectedSession): void {
	session = connectedSession;
}

function saveBrowserConfiguration(configurationToSave: AppConfiguration): void {
	saveConfiguration(configurationToSave);
	configuration = configurationToSave;
}

function handleSetupComplete(configurationToSave: AppConfiguration): void {
	saveBrowserConfiguration(configurationToSave);
	activeView = "sprint";
}

function changeSetup(): void {
	configuration = null;
}

async function reconnectJira(): Promise<void> {
	if (session.connected) {
		saveRememberedJiraSiteUrl(session.jiraSiteUrl);
	}
	await disconnectJira();
	session = { connected: false };
}

async function eraseLocalData(): Promise<void> {
	await disconnectJira().catch(() => undefined);
	clearConfiguration();
	configuration = null;
	session = { connected: false };
	activeView = "sprint";
}

onMount(initializeApplication);
</script>

<svelte:head>
	<title>Jira Leaderboard · Sprint performance</title>
	<meta
		name="description"
		content="A stateless sprint and period performance dashboard for Jira teams."
	>
</svelte:head>

{#if isInitializing}
	<main class="subtle-grid grid min-h-screen place-items-center px-5">
		<div class="text-center">
			<div class="flex justify-center"><LogoMark /></div>
			<LoadingState message="Opening your dashboard…" />
		</div>
	</main>
{:else if initializationError}
	<main class="grid min-h-screen place-items-center px-5">
		<div class="surface-card w-full max-w-lg rounded-2xl p-6">
			<LogoMark />
			<div class="mt-6">
				<ErrorBanner
					message={initializationError}
					onRetry={initializeApplication}
				/>
			</div>
		</div>
	</main>
{:else if !session.connected}
	<Onboarding onConnected={handleConnected} />
{:else if !configuration}
	<BoardSetup onComplete={handleSetupComplete} onDisconnect={reconnectJira} />
{:else}
	<AppShell
		{activeView}
		{configuration}
		{session}
		onNavigate={(view) => (activeView = view)}
	>
		{#if activeView === "sprint"}
			<SprintDashboard {configuration} />
		{:else if activeView === "qualityAssurance" && configuration.qualityAssurance}
			<QualityAssuranceDashboard
				developmentBoardIdentifier={configuration.boardIdentifier}
				developmentBoardName={configuration.boardName}
				configuration={configuration.qualityAssurance}
			/>
		{:else if activeView === "allTime"}
			<AllTimeDashboard {configuration} />
		{:else if activeView === "period"}
			<PeriodComparison {configuration} />
		{:else}
			<SettingsPanel
				{configuration}
				{session}
				onSaveConfiguration={saveBrowserConfiguration}
				onChangeSetup={changeSetup}
				onReconnect={reconnectJira}
				onErase={eraseLocalData}
			/>
		{/if}
	</AppShell>
{/if}
