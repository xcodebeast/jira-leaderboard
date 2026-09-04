<script lang="ts">
import { onMount, tick } from "svelte";
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
import AppShell, {
	type ApplicationView,
} from "$lib/components/AppShell.svelte";
import BoardSetup from "$lib/components/BoardSetup.svelte";
import ContributorProfile from "$lib/components/ContributorProfile.svelte";
import LogoMark from "$lib/components/LogoMark.svelte";
import Onboarding from "$lib/components/Onboarding.svelte";
import PeriodComparison from "$lib/components/PeriodComparison.svelte";
import SettingsPanel from "$lib/components/SettingsPanel.svelte";
import SprintPerformanceDashboard from "$lib/components/SprintPerformanceDashboard.svelte";
import Alert from "$lib/components/ui/Alert.svelte";
import Card from "$lib/components/ui/Card.svelte";
import LoadingState from "$lib/components/ui/LoadingState.svelte";
import type { ContributorProfileSelection } from "$lib/domain/contributor";

let session = $state<SessionStatus>({ connected: false });
let configuration = $state<AppConfiguration | null>(null);
let setupConfiguration = $state<AppConfiguration | null>(null);
let activeView = $state<ApplicationView>("sprint");
let contributorProfileSelection = $state<ContributorProfileSelection | null>(
	null,
);
let visitedViews = $state<Record<ApplicationView, boolean>>({
	sprint: true,
	allTime: false,
	period: false,
	settings: false,
});
let isInitializing = $state(true);
let initializationError = $state("");
let pageTitle = $derived(
	contributorProfileSelection
		? `${contributorProfileSelection.contributor.displayName} performance`
		: (
				{
					sprint: "Sprint performance",
					allTime: "Leaderboard",
					period: "Compare periods",
					settings: "Settings",
				} satisfies Record<ApplicationView, string>
			)[activeView],
);

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

function resetVisitedViews(view: ApplicationView): void {
	visitedViews = {
		sprint: view === "sprint",
		allTime: view === "allTime",
		period: view === "period",
		settings: view === "settings",
	};
}

async function navigateToView(view: ApplicationView): Promise<void> {
	contributorProfileSelection = null;
	visitedViews[view] = true;
	activeView = view;
	await tick();
	if (activeView !== view) {
		return;
	}
	window.scrollTo({ top: 0 });

	const viewHeading = document.querySelector<HTMLElement>(
		`[data-application-view="${view}"] h1`,
	);
	if (viewHeading) {
		viewHeading.tabIndex = -1;
		viewHeading.focus({ preventScroll: true });
	}
}

async function openContributorProfile(
	selection: ContributorProfileSelection,
): Promise<void> {
	contributorProfileSelection = selection;
	await tick();
	window.scrollTo({ top: 0 });
	const profileHeading = document.querySelector<HTMLElement>(
		"[data-contributor-profile] h1",
	);
	if (profileHeading) {
		profileHeading.tabIndex = -1;
		profileHeading.focus({ preventScroll: true });
	}
}

async function closeContributorProfile(): Promise<void> {
	contributorProfileSelection = null;
	await tick();
	window.scrollTo({ top: 0 });
	const viewHeading = document.querySelector<HTMLElement>(
		`[data-application-view="${activeView}"] h1`,
	);
	if (viewHeading) {
		viewHeading.tabIndex = -1;
		viewHeading.focus({ preventScroll: true });
	}
}

function handleSetupComplete(configurationToSave: AppConfiguration): void {
	saveBrowserConfiguration(configurationToSave);
	setupConfiguration = null;
	contributorProfileSelection = null;
	activeView = "sprint";
	resetVisitedViews("sprint");
}

function changeSetup(): void {
	setupConfiguration = configuration;
	resetVisitedViews(activeView);
	configuration = null;
	contributorProfileSelection = null;
}

async function reconnectJira(): Promise<void> {
	if (session.connected) {
		saveRememberedJiraSiteUrl(session.jiraSiteUrl);
	}
	await disconnectJira();
	contributorProfileSelection = null;
	resetVisitedViews(activeView);
	session = { connected: false };
}

async function eraseLocalData(): Promise<void> {
	await disconnectJira().catch(() => undefined);
	clearConfiguration();
	configuration = null;
	setupConfiguration = null;
	contributorProfileSelection = null;
	session = { connected: false };
	activeView = "sprint";
	resetVisitedViews("sprint");
}

onMount(() => {
	void initializeApplication();
});
</script>

<svelte:head>
	<title>Jira Leaderboard · {pageTitle}</title>
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
		<Card class="w-full max-w-lg rounded-[1.2rem] p-6" accent="danger">
			<LogoMark />
			<div class="mt-6">
				<Alert message={initializationError} onRetry={initializeApplication} />
			</div>
		</Card>
	</main>
{:else if !session.connected}
	<Onboarding onConnected={handleConnected} />
{:else if !configuration}
	<BoardSetup
		initialConfiguration={setupConfiguration}
		onComplete={handleSetupComplete}
		onDisconnect={reconnectJira}
	/>
{:else}
	<AppShell {activeView} {configuration} {session} onNavigate={navigateToView}>
		{#if contributorProfileSelection}
			<ContributorProfile
				{configuration}
				jiraSiteUrl={session.jiraSiteUrl}
				selection={contributorProfileSelection}
				onBack={closeContributorProfile}
			/>
		{/if}
		{#if visitedViews.sprint}
			<div
				data-application-view="sprint"
				hidden={activeView !== "sprint" || contributorProfileSelection !== null}
			>
				<SprintPerformanceDashboard
					{configuration}
					jiraSiteUrl={session.jiraSiteUrl}
					onOpenSettings={() => void navigateToView("settings")}
					onOpenContributorProfile={(selection) =>
						void openContributorProfile(selection)}
				/>
			</div>
		{/if}
		{#if visitedViews.allTime}
			<div
				data-application-view="allTime"
				hidden={activeView !== "allTime" || contributorProfileSelection !== null}
			>
				<AllTimeDashboard
					{configuration}
					onOpenSettings={() => void navigateToView("settings")}
					onOpenContributorProfile={(selection) =>
						void openContributorProfile(selection)}
				/>
			</div>
		{/if}
		{#if visitedViews.period}
			<div
				data-application-view="period"
				hidden={activeView !== "period" || contributorProfileSelection !== null}
			>
				<PeriodComparison {configuration} />
			</div>
		{/if}
		{#if visitedViews.settings}
			<div
				data-application-view="settings"
				hidden={activeView !== "settings" || contributorProfileSelection !== null}
			>
				<SettingsPanel
					{configuration}
					{session}
					onSaveConfiguration={saveBrowserConfiguration}
					onChangeSetup={changeSetup}
					onReconnect={reconnectJira}
					onErase={eraseLocalData}
				/>
			</div>
		{/if}
	</AppShell>
{/if}
