<script lang="ts">
import type { ContributorReference } from "../domain/contributor";
import Avatar from "./ui/Avatar.svelte";
import Icon from "./ui/Icon.svelte";

interface Properties {
	displayName: string;
	accountIdentifier?: string | null;
	tone: "brand" | "success" | "info" | "neutral";
	size?: "small" | "medium";
	detail?: string;
	class?: string;
	onSelect?: (contributor: ContributorReference) => void;
}

let {
	displayName,
	accountIdentifier = null,
	tone,
	size = "medium",
	detail = "",
	class: className = "",
	onSelect,
}: Properties = $props();

function selectContributor(): void {
	onSelect?.({ displayName, accountIdentifier });
}
</script>

{#if onSelect}
	<button
		class={`group flex min-w-0 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-brand/65 focus-visible:ring-offset-4 focus-visible:ring-offset-canvas ${className}`}
		type="button"
		onclick={selectContributor}
		aria-label={`View ${displayName}'s performance`}
	>
		<Avatar name={displayName} {tone} {size} />
		<span class="min-w-0 flex-1">
			<span
				class="block truncate font-bold text-ice underline decoration-transparent underline-offset-4 transition-colors group-hover:text-brand group-hover:decoration-brand/45"
			>
				{displayName}
			</span>
			{#if detail}
				<span class="mt-0.5 block truncate text-xs text-muted">{detail}</span>
			{/if}
		</span>
		<Icon
			name="arrowRight"
			size={14}
			class="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
		/>
	</button>
{:else}
	<div class={`flex min-w-0 items-center gap-3 ${className}`}>
		<Avatar name={displayName} {tone} {size} />
		<span class="min-w-0 flex-1">
			<span class="block truncate font-bold text-ice">{displayName}</span>
			{#if detail}
				<span class="mt-0.5 block truncate text-xs text-muted">{detail}</span>
			{/if}
		</span>
	</div>
{/if}
