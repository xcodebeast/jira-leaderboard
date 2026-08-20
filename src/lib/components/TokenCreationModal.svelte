<script lang="ts">
import { onMount } from "svelte";
import Badge from "./ui/Badge.svelte";
import Button from "./ui/Button.svelte";
import Icon from "./ui/Icon.svelte";
import LinkButton from "./ui/LinkButton.svelte";

interface Properties {
	onClose: () => void;
}

type TokenType = "classic" | "scoped";

let { onClose }: Properties = $props();
let tutorialDialog: HTMLDialogElement;
let selectedTokenType = $state<TokenType | null>(null);

const atlassianTokenUrl =
	"https://id.atlassian.com/manage-profile/security/api-tokens";
const scopedTokenReadScopes = [
	"read:avatar:jira",
	"read:board-scope.admin:jira-software",
	"read:board-scope:jira-software",
	"read:field-configuration:jira",
	"read:field.default-value:jira",
	"read:field.option:jira",
	"read:field:jira",
	"read:group:jira",
	"read:issue-details:jira",
	"read:jql:jira",
	"read:project-category:jira",
	"read:project:jira",
	"read:sprint:jira-software",
	"read:status:jira",
] as const;

function closeTutorial(): void {
	tutorialDialog.close();
}

onMount(() => tutorialDialog.showModal());
</script>

<dialog
	bind:this={tutorialDialog}
	class="m-auto max-h-[min(48rem,calc(100vh-2rem))] w-[min(42rem,calc(100vw-2rem))] overflow-y-auto rounded-3xl border border-line bg-panel p-0 text-ice shadow-2xl backdrop:bg-canvas/85 backdrop:backdrop-blur-sm"
	aria-labelledby="token-tutorial-title"
	onclose={onClose}
>
	<div class="p-5 sm:p-7">
		<header class="flex items-start justify-between gap-5">
			<div>
				<p class="eyebrow">Atlassian setup</p>
				<h2
					id="token-tutorial-title"
					class="mt-2 text-2xl font-bold tracking-tight text-white"
				>
					{selectedTokenType === null
						? "Which API token are you creating?"
						: selectedTokenType === "scoped"
							? "Create a scoped token"
							: "Create a classic token"}
				</h2>
			</div>
			<Button
				variant="ghost"
				size="icon"
				onclick={closeTutorial}
				aria-label="Close token instructions"
			>
				<Icon name="close" size={19} />
			</Button>
		</header>

		{#if selectedTokenType === null}
			<p class="mt-4 text-sm leading-6 text-muted">
				Jira Leaderboard supports both types. Scoped tokens are recommended
				because you can grant only the read access this dashboard needs.
			</p>
			<div class="mt-6 grid gap-4 sm:grid-cols-2">
				<button
					class="rounded-2xl border border-mint/30 bg-mint/8 p-5 text-left hover:border-mint/60"
					type="button"
					onclick={() => (selectedTokenType = "scoped")}
				>
					<span class="block text-base font-bold text-white">Scoped token</span>
					<span class="mt-2 block"
						><Badge tone="success">Recommended</Badge></span
					>
					<span class="mt-3 block text-xs leading-5 text-muted">
						Choose explicit read-only permissions. The app finds the Jira Cloud
						ID automatically.
					</span>
				</button>
				<button
					class="rounded-2xl border border-line bg-canvas/35 p-5 text-left hover:border-ice/30"
					type="button"
					onclick={() => (selectedTokenType = "classic")}
				>
					<span class="block text-base font-bold text-white"
						>Classic token</span
					>
					<span class="mt-3 block text-xs leading-5 text-muted">
						Use Atlassian's traditional token without selecting individual
						scopes. It is fully supported by this app.
					</span>
				</button>
			</div>
		{:else}
			<Button
				class="mt-5"
				variant="ghost"
				size="small"
				onclick={() => (selectedTokenType = null)}
			>
				← Choose another token type
			</Button>

			{#if selectedTokenType === "scoped"}
				<ol
					class="mt-5 list-decimal space-y-3 pl-5 text-sm leading-6 text-muted"
				>
					<li>Open Atlassian token settings using the button below.</li>
					<li>
						Select
						<strong class="text-ice">Create API token with scopes</strong>.
					</li>
					<li>
						Choose Jira, set a name and expiration date, then add these scopes:
					</li>
				</ol>
				<div class="mt-4 flex flex-wrap gap-2">
					{#each scopedTokenReadScopes as scopedTokenReadScope}
						<code
							class="rounded-md border border-line/70 bg-canvas/60 px-2 py-1 text-[0.65rem] text-mint"
						>
							{scopedTokenReadScope}
						</code>
					{/each}
				</div>
				<p class="mt-4 text-sm leading-6 text-muted">
					Create and copy the token, then paste it into Jira Leaderboard. You do
					not need to find or enter a Cloud ID.
				</p>
			{:else}
				<ol
					class="mt-5 list-decimal space-y-3 pl-5 text-sm leading-6 text-muted"
				>
					<li>Open Atlassian token settings using the button below.</li>
					<li>
						Select <strong class="text-ice">Create API token</strong>, without
						the “with scopes” option.
					</li>
					<li>
						Set a name and expiration date, then create and copy the token.
					</li>
					<li>Paste the token into Jira Leaderboard.</li>
				</ol>
				<p class="mt-4 text-sm leading-6 text-muted">
					Classic tokens use your Jira account's existing permissions and are
					fully supported.
				</p>
			{/if}

			<LinkButton
				class="mt-6 w-full"
				variant="primary"
				size="large"
				href={atlassianTokenUrl}
				target="_blank"
				rel="noreferrer"
			>
				Open Atlassian token settings <span aria-hidden="true">↗</span>
			</LinkButton>
		{/if}
	</div>
</dialog>
