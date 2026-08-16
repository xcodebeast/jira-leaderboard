<script lang="ts">
import type { JiraSprint } from "../domain/jira";

interface Properties {
	label: string;
	sprints: JiraSprint[];
	selectedIdentifier: string;
	onSelect: (identifier: string) => void;
	onLoadOlder: () => void | Promise<void>;
	hasMore: boolean;
	isLoadingMore: boolean;
	disabled?: boolean;
	excludedIdentifier?: number | null;
	emptyOptionLabel?: string;
	totalClosedSprints?: number | null;
}

let {
	label,
	sprints,
	selectedIdentifier,
	onSelect,
	onLoadOlder,
	hasMore,
	isLoadingMore,
	disabled = false,
	excludedIdentifier = null,
	emptyOptionLabel,
	totalClosedSprints = null,
}: Properties = $props();
let containerElement = $state<HTMLDivElement>();
let searchInput = $state<HTMLInputElement>();
let searchText = $state("");
let isOpen = $state(false);

const maximumVisibleSprints = 100;
let selectedSprint = $derived(
	sprints.find((sprint) => sprint.identifier === Number(selectedIdentifier)) ??
		null,
);
let selectableSprints = $derived(
	sprints.filter((sprint) => sprint.identifier !== excludedIdentifier),
);
let normalizedSearchText = $derived(searchText.trim().toLocaleLowerCase());
let filteredSprints = $derived(
	normalizedSearchText
		? selectableSprints.filter((sprint) =>
				sprint.name.toLocaleLowerCase().includes(normalizedSearchText),
			)
		: selectableSprints,
);
let visibleSprints = $derived(filteredSprints.slice(0, maximumVisibleSprints));
let selectedLabel = $derived(
	selectedSprint?.name ?? emptyOptionLabel ?? "Select a sprint",
);

function toggleSelector(): void {
	if (disabled) {
		return;
	}
	isOpen = !isOpen;
	if (isOpen) {
		queueMicrotask(() => searchInput?.focus());
	}
}

function chooseSprint(identifier: string): void {
	onSelect(identifier);
	searchText = "";
	isOpen = false;
}

function handleWindowClick(event: MouseEvent): void {
	const clickedElement = event.target;
	if (
		isOpen &&
		clickedElement instanceof Node &&
		!containerElement?.contains(clickedElement)
	) {
		isOpen = false;
	}
}

function handleWindowKeydown(event: KeyboardEvent): void {
	if (event.key === "Escape") {
		isOpen = false;
	}
}
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<div class="relative" bind:this={containerElement}>
	<span
		class="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
		>{label}</span
	>
	<button
		class="field-control flex items-center justify-between gap-3 text-left"
		type="button"
		onclick={toggleSelector}
		aria-expanded={isOpen}
		{disabled}
	>
		<span class="min-w-0 truncate">
			{selectedLabel}{selectedSprint?.state === "active" ? " · Active" : ""}
		</span>
		<span class="text-xs text-muted" aria-hidden="true"
			>{isOpen ? "▲" : "▼"}</span
		>
	</button>

	{#if isOpen}
		<div
			class="absolute z-40 mt-2 w-full min-w-72 overflow-hidden rounded-xl border border-line bg-panel shadow-2xl"
		>
			<div class="border-b border-line/70 p-3">
				<input
					class="field-control"
					bind:this={searchInput}
					bind:value={searchText}
					placeholder="Search loaded sprints…"
					aria-label={`Search ${label.toLocaleLowerCase()}`}
				>
				<p class="mt-2 text-[0.68rem] text-muted">
					{selectableSprints.length}
					loaded{totalClosedSprints !== null
						? ` · ${totalClosedSprints} closed available`
						: ""}
				</p>
			</div>

			<div
				class="max-h-72 overflow-y-auto p-2"
				role="listbox"
				aria-label={label}
			>
				{#if emptyOptionLabel && !normalizedSearchText}
					<button
						class="w-full rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-panel-soft hover:text-ice"
						class:bg-panel-soft={selectedIdentifier === ""}
						type="button"
						role="option"
						aria-selected={selectedIdentifier === ""}
						onclick={() => chooseSprint("")}
					>
						{emptyOptionLabel}
					</button>
				{/if}

				{#each visibleSprints as sprint (sprint.identifier)}
					<button
						class="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-ice hover:bg-panel-soft"
						class:bg-panel-soft={selectedIdentifier === String(sprint.identifier)}
						type="button"
						role="option"
						aria-selected={selectedIdentifier === String(sprint.identifier)}
						onclick={() => chooseSprint(String(sprint.identifier))}
					>
						<span class="truncate">{sprint.name}</span>
						{#if sprint.state === "active"}
							<span
								class="shrink-0 rounded-full bg-mint/10 px-2 py-0.5 text-[0.62rem] font-bold text-mint"
								>Active</span
							>
						{/if}
					</button>
				{/each}

				{#if filteredSprints.length === 0}
					<p class="px-3 py-5 text-center text-sm text-muted">
						No loaded sprint matches “{searchText.trim()}”.
					</p>
				{:else if filteredSprints.length > maximumVisibleSprints}
					<p class="px-3 py-2 text-center text-xs text-muted">
						Showing the first {maximumVisibleSprints} matches. Refine your
						search to narrow the list.
					</p>
				{/if}
			</div>

			{#if hasMore}
				<div class="border-t border-line/70 p-2">
					<button
						class="secondary-button w-full text-xs"
						type="button"
						onclick={onLoadOlder}
						disabled={isLoadingMore}
					>
						{isLoadingMore ? "Loading older sprints…" : "Load older sprints"}
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>
