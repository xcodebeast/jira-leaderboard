<script lang="ts">
import type { JiraSprint } from "../domain/jira";
import Badge from "./ui/Badge.svelte";
import Button from "./ui/Button.svelte";
import Input from "./ui/Input.svelte";

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
let triggerButton = $state<HTMLButtonElement>();
let searchInput = $state<HTMLInputElement>();
let searchText = $state("");
let isOpen = $state(false);
let highlightedIdentifier = $state<string | null>(null);
const selectorIdentifier = $props.id();
const labelIdentifier = `${selectorIdentifier}-label`;
const valueIdentifier = `${selectorIdentifier}-value`;
const listboxIdentifier = `${selectorIdentifier}-listbox`;

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

$effect(() => {
	if (!isOpen || highlightedIdentifier === null) {
		return;
	}
	if (!visibleOptionIdentifiers().includes(highlightedIdentifier)) {
		highlightedIdentifier = null;
	}
});

function visibleOptionIdentifiers(): string[] {
	return [
		...(emptyOptionLabel && !normalizedSearchText ? [""] : []),
		...visibleSprints.map((sprint) => String(sprint.identifier)),
	];
}

function closeSelector(restoreTriggerFocus = false): void {
	isOpen = false;
	searchText = "";
	highlightedIdentifier = null;
	if (restoreTriggerFocus) {
		queueMicrotask(() => triggerButton?.focus());
	}
}

function toggleSelector(): void {
	if (disabled) {
		return;
	}
	if (isOpen) {
		closeSelector();
	} else {
		isOpen = true;
		highlightedIdentifier = null;
		queueMicrotask(() => searchInput?.focus());
	}
}

function chooseSprint(identifier: string): void {
	onSelect(identifier);
	closeSelector(true);
}

function moveHighlight(direction: 1 | -1): void {
	const identifiers = visibleOptionIdentifiers();
	if (identifiers.length === 0) {
		return;
	}
	const currentIndex =
		highlightedIdentifier !== null
			? identifiers.indexOf(highlightedIdentifier)
			: -1;
	const nextIndex =
		currentIndex === -1
			? direction === 1
				? 0
				: identifiers.length - 1
			: (currentIndex + direction + identifiers.length) % identifiers.length;
	highlightedIdentifier = identifiers[nextIndex];
	queueMicrotask(() => {
		const options = containerElement?.querySelectorAll<HTMLButtonElement>(
			"[data-sprint-option]",
		);
		for (const option of options ?? []) {
			if (option.dataset.sprintIdentifier === highlightedIdentifier) {
				option.focus();
				option.scrollIntoView({ block: "nearest" });
				break;
			}
		}
	});
}

function handleWindowClick(event: MouseEvent): void {
	const clickedElement = event.target;
	if (
		isOpen &&
		clickedElement instanceof Node &&
		!containerElement?.contains(clickedElement)
	) {
		closeSelector();
	}
}

function handleSelectorKeydown(event: KeyboardEvent): void {
	if (event.key === "Escape" && isOpen) {
		event.preventDefault();
		closeSelector(true);
		return;
	}
	if (!isOpen) {
		return;
	}
	const eventTarget = event.target;
	const isNavigationTarget =
		eventTarget === searchInput ||
		(eventTarget instanceof HTMLElement &&
			eventTarget.hasAttribute("data-sprint-option"));
	if (
		(event.key === "ArrowDown" || event.key === "ArrowUp") &&
		isNavigationTarget
	) {
		event.preventDefault();
		moveHighlight(event.key === "ArrowDown" ? 1 : -1);
	} else if (event.key === "Enter" && eventTarget === searchInput) {
		const identifierToSelect =
			highlightedIdentifier ?? visibleOptionIdentifiers()[0];
		if (identifierToSelect !== undefined) {
			event.preventDefault();
			chooseSprint(identifierToSelect);
		}
	}
}
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleSelectorKeydown} />

<div class="relative" bind:this={containerElement}>
	<span
		id={labelIdentifier}
		class="mb-2 block text-[0.66rem] font-bold uppercase tracking-[0.1em] text-muted"
		>{label}</span
	>
	<button
		class="field-control flex min-h-12 items-center justify-between gap-3 text-left font-bold"
		class:cursor-not-allowed={disabled}
		class:opacity-60={disabled}
		bind:this={triggerButton}
		type="button"
		onclick={toggleSelector}
		aria-expanded={isOpen}
		aria-haspopup="listbox"
		aria-controls={listboxIdentifier}
		aria-labelledby={`${labelIdentifier} ${valueIdentifier}`}
		aria-disabled={disabled}
	>
		<span id={valueIdentifier} class="min-w-0 truncate">
			{selectedLabel}{selectedSprint?.state === "active" ? " · Active" : ""}
		</span>
		<span class="text-xs text-brand" aria-hidden="true"
			>{isOpen ? "↑" : "↓"}</span
		>
	</button>

	{#if isOpen}
		<div
			class="absolute z-40 mt-2 w-full overflow-hidden rounded-[0.95rem] border border-line bg-panel shadow-2xl"
		>
			<div class="border-b border-line/70 p-3">
				<Input
					bind:element={searchInput}
					bind:value={searchText}
					oninput={() => (highlightedIdentifier = null)}
					placeholder="Search loaded sprints…"
					aria-label={`Search ${label.toLocaleLowerCase()}`}
					aria-controls={listboxIdentifier}
				/>
				<p class="mt-2 text-[0.68rem] text-muted">
					{selectableSprints.length}
					loaded{totalClosedSprints !== null
						? ` · ${totalClosedSprints} closed available`
						: ""}
				</p>
			</div>

			<div
				id={listboxIdentifier}
				class="max-h-72 overflow-y-auto p-2"
				role="listbox"
				aria-label={label}
			>
				{#if emptyOptionLabel && !normalizedSearchText}
					<button
						class="w-full rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-panel-soft hover:text-ice"
						class:bg-panel-soft={selectedIdentifier === "" || highlightedIdentifier === ""}
						class:ring-1={highlightedIdentifier === ""}
						class:ring-brand={highlightedIdentifier === ""}
						type="button"
						tabindex={highlightedIdentifier === "" ? 0 : -1}
						role="option"
						aria-selected={selectedIdentifier === ""}
						data-sprint-option
						data-sprint-identifier=""
						onfocus={() => (highlightedIdentifier = "")}
						onclick={() => chooseSprint("")}
					>
						{emptyOptionLabel}
					</button>
				{/if}

				{#each visibleSprints as sprint (sprint.identifier)}
					<button
						class="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-ice hover:bg-panel-soft"
						class:bg-panel-soft={selectedIdentifier === String(sprint.identifier) || highlightedIdentifier === String(sprint.identifier)}
						class:ring-1={highlightedIdentifier === String(sprint.identifier)}
						class:ring-brand={highlightedIdentifier === String(sprint.identifier)}
						type="button"
						tabindex={highlightedIdentifier === String(sprint.identifier) ? 0 : -1}
						role="option"
						aria-selected={selectedIdentifier === String(sprint.identifier)}
						data-sprint-option
						data-sprint-identifier={String(sprint.identifier)}
						onfocus={() => (highlightedIdentifier = String(sprint.identifier))}
						onclick={() => chooseSprint(String(sprint.identifier))}
					>
						<span class="truncate">{sprint.name}</span>
						{#if sprint.state === "active"}
							<Badge tone="success">Active</Badge>
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
					<Button
						class="w-full"
						variant="secondary"
						size="small"
						onclick={onLoadOlder}
						loading={isLoadingMore}
					>
						{isLoadingMore ? "Loading older sprints…" : "Load older sprints"}
					</Button>
				</div>
			{/if}
		</div>
	{/if}
</div>
