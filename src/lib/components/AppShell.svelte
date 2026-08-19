<script lang="ts">
import type { Snippet } from "svelte";
import type { ConnectedSession } from "../browser/api-client";
import type { AppConfiguration } from "../browser/configuration";
import GitHubIcon from "./icons/GitHubIcon.svelte";
import LogoMark from "./LogoMark.svelte";

export type ApplicationView =
	| "sprint"
	| "qualityAssurance"
	| "allTime"
	| "period"
	| "settings";

interface Properties {
	activeView: ApplicationView;
	configuration: AppConfiguration;
	session: ConnectedSession;
	onNavigate: (view: ApplicationView) => void;
	children: Snippet;
}

let { activeView, configuration, session, onNavigate, children }: Properties =
	$props();
let navigationItems = $derived<
	Array<{
		view: ApplicationView;
		label: string;
		symbol: string;
	}>
>([
	{ view: "sprint", label: "Development", symbol: "↗" },
	...(configuration.qualityAssurance
		? ([
				{ view: "qualityAssurance", label: "QA", symbol: "✓" },
			] satisfies Array<{
				view: ApplicationView;
				label: string;
				symbol: string;
			}>)
		: []),
	{ view: "allTime", label: "All time", symbol: "∞" },
	{ view: "period", label: "Periods", symbol: "◫" },
	{ view: "settings", label: "Settings", symbol: "⚙" },
]);
</script>

<div class="min-h-screen">
	<header
		class="sticky top-0 z-30 border-b border-line/80 bg-canvas/85 backdrop-blur-xl"
	>
		<div
			class="mx-auto flex max-w-[94rem] items-center justify-between gap-5 px-4 py-3 sm:px-6 lg:px-8"
		>
			<div class="flex items-center gap-7">
				<LogoMark />
				<nav
					class="hidden items-center gap-1 md:flex"
					aria-label="Primary navigation"
				>
					{#each navigationItems as item (item.view)}
						<button
							class="rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
							class:bg-panel-soft={activeView === item.view}
							class:text-white={activeView === item.view}
							class:text-muted={activeView !== item.view}
							type="button"
							onclick={() => onNavigate(item.view)}
						>
							{item.label}
						</button>
					{/each}
				</nav>
			</div>

			<button
				class="flex min-w-0 items-center gap-3 rounded-xl border border-line/70 bg-panel/60 px-3 py-2 text-left hover:border-line"
				type="button"
				onclick={() => onNavigate("settings")}
				aria-label="Open settings"
			>
				<span
					class="grid size-8 shrink-0 place-items-center rounded-lg bg-violet/12 text-xs font-bold text-violet"
					>{session.emailAddress.slice(0, 2).toUpperCase()}</span
				>
				<span class="hidden min-w-0 sm:block">
					<span class="block max-w-44 truncate text-xs font-semibold text-ice"
						>{configuration.boardName}</span
					>
					<span class="block max-w-44 truncate text-[0.65rem] text-muted"
						>{session.emailAddress}</span
					>
				</span>
			</button>
		</div>

		<nav
			class="grid border-t border-line/60 px-3 md:hidden"
			style={`grid-template-columns: repeat(${navigationItems.length}, minmax(0, 1fr));`}
			aria-label="Mobile navigation"
		>
			{#each navigationItems as item (item.view)}
				<button
					class="flex items-center justify-center gap-2 border-b-2 px-2 py-3 text-xs font-semibold"
					class:border-mint={activeView === item.view}
					class:border-transparent={activeView !== item.view}
					class:text-mint={activeView === item.view}
					class:text-muted={activeView !== item.view}
					type="button"
					onclick={() => onNavigate(item.view)}
				>
					<span aria-hidden="true">{item.symbol}</span>{item.label}
				</button>
			{/each}
		</nav>
	</header>

	{@render children()}

	<footer
		class="mx-auto flex max-w-[94rem] flex-col gap-2 border-t border-line/50 px-5 py-7 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8"
	>
		<div class="flex items-center gap-4">
			<p>Jira Leaderboard · stateless by design</p>
			<a
				class="inline-flex items-center gap-1.5 font-semibold transition-colors hover:text-ice"
				href="https://github.com/xcodebeast/jira-leaderboard"
				target="_blank"
				rel="noreferrer"
			>
				<GitHubIcon />
				<span>GitHub</span>
			</a>
		</div>
		<p>
			Preferences stay in this browser. Credentials stay in an encrypted
			HttpOnly cookie.
		</p>
	</footer>
</div>
