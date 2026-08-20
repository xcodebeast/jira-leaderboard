<script lang="ts">
import type { Snippet } from "svelte";
import type { ConnectedSession } from "../browser/api-client";
import type { AppConfiguration } from "../browser/configuration";
import GitHubIcon from "./icons/GitHubIcon.svelte";
import LogoMark from "./LogoMark.svelte";
import Avatar from "./ui/Avatar.svelte";
import Icon, { type IconName } from "./ui/Icon.svelte";

export type ApplicationView = "sprint" | "allTime" | "period" | "settings";

interface NavigationItem {
	view: ApplicationView;
	label: string;
	compactLabel: string;
	icon: IconName;
}

interface Properties {
	activeView: ApplicationView;
	configuration: AppConfiguration;
	session: ConnectedSession;
	onNavigate: (view: ApplicationView) => void;
	children: Snippet;
}

let { activeView, configuration, session, onNavigate, children }: Properties =
	$props();

const navigationItems: NavigationItem[] = [
	{
		view: "sprint",
		label: "Sprint Performance",
		compactLabel: "Sprint",
		icon: "sprint",
	},
	{
		view: "allTime",
		label: "Leaderboard",
		compactLabel: "Leaders",
		icon: "trophy",
	},
	{
		view: "period",
		label: "Compare",
		compactLabel: "Compare",
		icon: "compare",
	},
	{
		view: "settings",
		label: "Settings",
		compactLabel: "Settings",
		icon: "settings",
	},
];
</script>

<div class="min-h-screen pb-20 md:pb-0">
	<header
		class="sticky top-0 z-30 border-b border-line/75 bg-canvas/88 backdrop-blur-xl"
	>
		<div
			class="mx-auto flex max-w-[94rem] items-center justify-between gap-5 px-4 py-3 sm:px-6 lg:px-8"
		>
			<div class="flex items-center gap-6 xl:gap-9">
				<LogoMark />
				<nav
					class="hidden items-center gap-1 md:flex"
					aria-label="Primary navigation"
				>
					{#each navigationItems as item (item.view)}
						<button
							class="group relative flex items-center gap-2 rounded-[0.75rem] px-3 py-2.5 text-sm font-bold transition-colors"
							class:bg-panel-soft={activeView === item.view}
							class:text-ice={activeView === item.view}
							class:text-muted={activeView !== item.view}
							type="button"
							aria-current={activeView === item.view ? "page" : undefined}
							onclick={() => onNavigate(item.view)}
						>
							<Icon
								name={item.icon}
								size={16}
								class={activeView === item.view ? "text-brand" : "text-muted group-hover:text-ice"}
							/>
							{item.label}
							{#if activeView === item.view}
								<span
									class="absolute inset-x-3 -bottom-[0.83rem] h-0.5 rounded-full bg-brand"
								></span>
							{/if}
						</button>
					{/each}
				</nav>
			</div>

			<div class="relative h-[3.125rem] w-[3.25rem] shrink-0">
				<button
					class="account-control"
					type="button"
					onclick={() => onNavigate("settings")}
					aria-label="Open account and settings"
				>
					<Avatar name={session.emailAddress} tone="brand" size="small" />
					<span class="account-control-details">
						<span class="block truncate text-xs font-bold text-ice">
							{configuration.boardName}
						</span>
						<span class="block truncate text-[0.65rem] text-muted">
							{session.emailAddress}
						</span>
					</span>
				</button>
			</div>
		</div>
	</header>

	<nav
		class="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-line bg-canvas/96 px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl md:hidden"
		aria-label="Primary navigation"
	>
		{#each navigationItems as item (item.view)}
			<button
				class={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[0.65rem] font-bold transition-colors ${activeView === item.view ? "bg-brand/8" : ""}`}
				class:text-brand={activeView === item.view}
				class:text-muted={activeView !== item.view}
				type="button"
				aria-current={activeView === item.view ? "page" : undefined}
				onclick={() => onNavigate(item.view)}
			>
				<Icon
					name={item.icon}
					size={19}
					strokeWidth={activeView === item.view ? 2.2 : 1.8}
				/>
				{item.compactLabel}
			</button>
		{/each}
	</nav>

	{@render children()}

	<footer
		class="mx-auto flex max-w-[94rem] flex-col gap-3 border-t border-line/50 px-5 py-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8"
	>
		<div class="flex items-center gap-4">
			<p>Jira Leaderboard · stateless by design</p>
			<a
				class="inline-flex items-center gap-1.5 font-bold transition-colors hover:text-brand"
				href="https://github.com/xcodebeast/jira-leaderboard"
				target="_blank"
				rel="noreferrer"
			>
				<GitHubIcon />
				<span>GitHub</span>
			</a>
		</div>
		<p>
			Preferences stay local. Jira credentials remain in an encrypted cookie.
		</p>
	</footer>
</div>
