<script lang="ts">
import { onMount } from "svelte";
import {
	loadBoards,
	loadDevelopmentSetupSuggestion,
	loadQualityAssuranceSetupSuggestion,
} from "../browser/api-client";
import type { AppConfiguration } from "../browser/configuration";
import type { JiraBoard } from "../domain/jira";
import type {
	JiraSetupSuggestion,
	QualityAssuranceSetupSuggestion,
} from "../domain/setup";
import ErrorBanner from "./ErrorBanner.svelte";
import LoadingState from "./LoadingState.svelte";
import LogoMark from "./LogoMark.svelte";

interface Properties {
	onComplete: (configuration: AppConfiguration) => void;
	onDisconnect: () => void;
}

let { onComplete, onDisconnect }: Properties = $props();
let boards = $state<JiraBoard[]>([]);
let selectedBoardIdentifier = $state("");
let developmentSuggestion = $state<JiraSetupSuggestion | null>(null);
let storyPointsFieldIdentifier = $state("");
let developerFieldIdentifier = $state("");
let bounceCountFieldIdentifier = $state("");
let doneStatus = $state("");
let qualityAssuranceStatus = $state("");
let readyForQualityAssuranceStatus = $state("");
let defaultProjectKey = $state("");
let isLoadingBoards = $state(true);
let isLoadingSuggestion = $state(false);
let errorMessage = $state("");
let includeQualityAssurance = $state(false);
let qualityAssuranceBoards = $state<JiraBoard[]>([]);
let selectedQualityAssuranceBoardIdentifier = $state("");
let qualityAssuranceSuggestion = $state<QualityAssuranceSetupSuggestion | null>(
	null,
);
let qualityAssuranceStoryPointsFieldIdentifier = $state("");
let testerFieldIdentifier = $state("");
let qualityAssuranceDoneStatus = $state("");
let qualityAssuranceReadyStatus = $state("");
let isLoadingQualityAssuranceBoards = $state(false);
let isLoadingQualityAssuranceSuggestion = $state(false);

let isSetupLoading = $derived(
	isLoadingSuggestion ||
		isLoadingQualityAssuranceBoards ||
		isLoadingQualityAssuranceSuggestion,
);
let availableQualityAssuranceBoards = $derived(
	qualityAssuranceBoards.filter(
		(board) => board.identifier !== Number(selectedBoardIdentifier),
	),
);
let hasRetryableSetupError = $derived(
	!developmentSuggestion ||
		(includeQualityAssurance && !qualityAssuranceSuggestion),
);

function applySuggestion(loadedSuggestion: JiraSetupSuggestion): void {
	developmentSuggestion = loadedSuggestion;
	storyPointsFieldIdentifier =
		loadedSuggestion.fields.storyPointsFieldIdentifier;
	developerFieldIdentifier = loadedSuggestion.fields.developerFieldIdentifier;
	bounceCountFieldIdentifier =
		loadedSuggestion.fields.bounceCountFieldIdentifier;
	doneStatus = loadedSuggestion.statuses.done;
	qualityAssuranceStatus = loadedSuggestion.statuses.qualityAssurance;
	readyForQualityAssuranceStatus =
		loadedSuggestion.statuses.readyForQualityAssurance;
	defaultProjectKey = loadedSuggestion.defaultProjectKey;
}

function applyQualityAssuranceSuggestion(
	loadedSuggestion: QualityAssuranceSetupSuggestion,
): void {
	qualityAssuranceSuggestion = loadedSuggestion;
	qualityAssuranceStoryPointsFieldIdentifier =
		loadedSuggestion.fields.storyPointsFieldIdentifier;
	testerFieldIdentifier = loadedSuggestion.fields.testerFieldIdentifier;
	qualityAssuranceDoneStatus = loadedSuggestion.statuses.done;
	qualityAssuranceReadyStatus =
		loadedSuggestion.statuses.readyForQualityAssurance;
}

async function loadSelectedDevelopmentBoard(): Promise<void> {
	const boardIdentifier = Number(selectedBoardIdentifier);
	if (!boardIdentifier) {
		return;
	}
	isLoadingSuggestion = true;
	errorMessage = "";
	try {
		applySuggestion(await loadDevelopmentSetupSuggestion(boardIdentifier));
		if (
			includeQualityAssurance &&
			Number(selectedQualityAssuranceBoardIdentifier) === boardIdentifier
		) {
			const replacementBoard = qualityAssuranceBoards.find(
				(board) => board.identifier !== boardIdentifier,
			);
			selectedQualityAssuranceBoardIdentifier = replacementBoard
				? String(replacementBoard.identifier)
				: "";
			qualityAssuranceSuggestion = null;
			if (replacementBoard) {
				await loadSelectedQualityAssuranceBoard();
			}
		}
	} catch (error) {
		developmentSuggestion = null;
		errorMessage =
			error instanceof Error
				? error.message
				: "The board setup could not be loaded.";
	} finally {
		isLoadingSuggestion = false;
	}
}

async function loadAvailableBoards(): Promise<void> {
	isLoadingBoards = true;
	errorMessage = "";
	try {
		boards = await loadBoards();
		const initialBoard = boards[0];
		if (!initialBoard) {
			throw new Error("This Jira account cannot access any Scrum boards.");
		}
		selectedBoardIdentifier = String(initialBoard.identifier);
		await loadSelectedDevelopmentBoard();
	} catch (error) {
		errorMessage =
			error instanceof Error
				? error.message
				: "Scrum boards could not be loaded.";
	} finally {
		isLoadingBoards = false;
	}
}

async function loadSelectedQualityAssuranceBoard(): Promise<void> {
	const boardIdentifier = Number(selectedQualityAssuranceBoardIdentifier);
	if (!boardIdentifier) {
		return;
	}
	isLoadingQualityAssuranceSuggestion = true;
	errorMessage = "";
	try {
		applyQualityAssuranceSuggestion(
			await loadQualityAssuranceSetupSuggestion(boardIdentifier),
		);
	} catch (error) {
		qualityAssuranceSuggestion = null;
		errorMessage =
			error instanceof Error
				? error.message
				: "The quality assurance board setup could not be loaded.";
	} finally {
		isLoadingQualityAssuranceSuggestion = false;
	}
}

async function loadQualityAssuranceBoards(): Promise<void> {
	isLoadingQualityAssuranceBoards = true;
	errorMessage = "";
	try {
		qualityAssuranceBoards = await loadBoards("all");
		const initialBoard = qualityAssuranceBoards.find(
			(board) => board.identifier !== Number(selectedBoardIdentifier),
		);
		if (!initialBoard) {
			throw new Error(
				"This Jira account cannot access another board for quality assurance.",
			);
		}
		selectedQualityAssuranceBoardIdentifier = String(initialBoard.identifier);
		await loadSelectedQualityAssuranceBoard();
	} catch (error) {
		errorMessage =
			error instanceof Error
				? error.message
				: "Quality assurance boards could not be loaded.";
	} finally {
		isLoadingQualityAssuranceBoards = false;
	}
}

async function handleQualityAssuranceToggle(event: Event): Promise<void> {
	includeQualityAssurance = (event.currentTarget as HTMLInputElement).checked;
	if (includeQualityAssurance && qualityAssuranceBoards.length === 0) {
		await loadQualityAssuranceBoards();
	}
}

function retrySetupFailure(): void {
	if (!developmentSuggestion) {
		if (boards.length > 0) {
			void loadSelectedDevelopmentBoard();
		} else {
			void loadAvailableBoards();
		}
		return;
	}
	if (includeQualityAssurance && !qualityAssuranceSuggestion) {
		if (selectedQualityAssuranceBoardIdentifier) {
			void loadSelectedQualityAssuranceBoard();
		} else {
			void loadQualityAssuranceBoards();
		}
	}
}

function handleSubmit(event: SubmitEvent): void {
	event.preventDefault();
	if (!developmentSuggestion) {
		return;
	}
	const statusNames = [
		doneStatus,
		qualityAssuranceStatus,
		readyForQualityAssuranceStatus,
	];
	if (new Set(statusNames).size !== statusNames.length) {
		errorMessage = "Done, QA, and Ready for QA must map to different statuses.";
		return;
	}
	if (!defaultProjectKey.trim()) {
		errorMessage = "Enter the project key used for period comparisons.";
		return;
	}
	if (
		!storyPointsFieldIdentifier ||
		!developerFieldIdentifier ||
		!bounceCountFieldIdentifier
	) {
		errorMessage =
			"Select the Story Points, Developer, and Bounce Count fields.";
		return;
	}
	if (includeQualityAssurance) {
		if (!qualityAssuranceSuggestion) {
			errorMessage = "Select a quality assurance board.";
			return;
		}
		if (
			qualityAssuranceSuggestion.board.identifier ===
			developmentSuggestion.board.identifier
		) {
			errorMessage =
				"Development and quality assurance must use different boards.";
			return;
		}
		if (!qualityAssuranceStoryPointsFieldIdentifier || !testerFieldIdentifier) {
			errorMessage = "Select the QA Story Points and Tester fields.";
			return;
		}
		if (qualityAssuranceDoneStatus === qualityAssuranceReadyStatus) {
			errorMessage = "QA Done and Ready for QA must map to different statuses.";
			return;
		}
	}

	onComplete({
		version: 2,
		boardIdentifier: developmentSuggestion.board.identifier,
		boardName: developmentSuggestion.board.name,
		fieldMapping: {
			storyPointsFieldIdentifier,
			developerFieldIdentifier,
			bounceCountFieldIdentifier,
		},
		statusMapping: {
			done: doneStatus,
			qualityAssurance: qualityAssuranceStatus,
			readyForQualityAssurance: readyForQualityAssuranceStatus,
		},
		defaultProjectKey: defaultProjectKey.trim(),
		qualityAssurance:
			includeQualityAssurance && qualityAssuranceSuggestion
				? {
						boardIdentifier: qualityAssuranceSuggestion.board.identifier,
						boardName: qualityAssuranceSuggestion.board.name,
						fieldMapping: {
							storyPointsFieldIdentifier:
								qualityAssuranceStoryPointsFieldIdentifier,
							testerFieldIdentifier,
						},
						statusMapping: {
							done: qualityAssuranceDoneStatus,
							readyForQualityAssurance: qualityAssuranceReadyStatus,
						},
					}
				: null,
	});
}

onMount(loadAvailableBoards);
</script>

<main class="subtle-grid min-h-screen px-5 py-8 sm:px-8">
	<div class="mx-auto max-w-4xl">
		<header class="flex items-center justify-between gap-4">
			<LogoMark />
			<button
				class="text-sm font-semibold text-muted hover:text-ice"
				type="button"
				onclick={onDisconnect}
			>
				Use another account
			</button>
		</header>

		<div class="mt-12 grid gap-8 md:grid-cols-[13rem_1fr]">
			<aside>
				<p class="eyebrow">Step 2 of 2</p>
				<h1 class="mt-3 text-3xl font-bold tracking-tight text-white">
					Map your board
				</h1>
				<p class="mt-4 text-sm leading-6 text-muted">
					We suggest fields and statuses from Jira. Review them once, then the
					browser remembers this setup.
				</p>
				<ol class="mt-8 space-y-4 text-sm">
					<li class="flex gap-3 text-mint">
						<span class="font-mono">01</span
						><span class="font-semibold">Credentials verified</span>
					</li>
					<li class="flex gap-3 text-ice">
						<span class="font-mono text-mint">02</span
						><span class="font-semibold">Board & mappings</span>
					</li>
					<li class="flex gap-3 text-muted">
						<span class="font-mono">03</span><span>Open dashboard</span>
					</li>
				</ol>
			</aside>

			<section class="surface-card rounded-3xl p-5 sm:p-8">
				{#if isLoadingBoards}
					<LoadingState message="Finding your Scrum boards…" />
				{:else}
					<form class="space-y-6" onsubmit={handleSubmit}>
						<label class="block">
							<span class="mb-2 block text-sm font-semibold text-ice"
								>Scrum board</span
							>
							<select
								class="field-control"
								bind:value={selectedBoardIdentifier}
								onchange={loadSelectedDevelopmentBoard}
								disabled={isLoadingSuggestion}
							>
								{#each boards as board (board.identifier)}
									<option value={board.identifier}>
										{board.name}
										· #{board.identifier}
									</option>
								{/each}
							</select>
						</label>

						{#if isLoadingSuggestion}
							<LoadingState compact message="Reading board configuration…" />
						{:else if developmentSuggestion}
							{#if developmentSuggestion.availableProjects.length > 0}
								<label class="block">
									<span class="mb-2 block text-sm font-semibold text-ice"
										>Period comparison project</span
									>
									<select
										class="field-control max-w-md"
										bind:value={defaultProjectKey}
										required
									>
										<option value="" disabled>Select a project</option>
										{#each developmentSuggestion.availableProjects as project (project.key)}
											<option value={project.key}>
												{project.name}
												({project.key})
											</option>
										{/each}
									</select>
									<span class="mt-2 block text-xs text-muted">
										{developmentSuggestion.availableProjects.length === 1
											? "Detected from this board's Jira project."
											: "This board contains multiple projects. Choose the default for period comparisons."}
									</span>
								</label>
							{:else}
								<label class="block">
									<span class="mb-2 block text-sm font-semibold text-ice"
										>Default project key</span
									>
									<input
										class="field-control max-w-xs"
										bind:value={defaultProjectKey}
										placeholder="DEMO"
										required
									>
									<span class="mt-2 block text-xs text-muted">
										Jira could not infer a project from this board's filter.
										Enter the default for period comparisons.
									</span>
								</label>
							{/if}

							<details
								class="rounded-2xl border border-line bg-canvas/35 p-4"
								open={!storyPointsFieldIdentifier || !developerFieldIdentifier || !bounceCountFieldIdentifier}
							>
								<summary class="cursor-pointer text-sm font-semibold text-ice">
									Review advanced mappings
								</summary>
								<div class="mt-5 grid gap-5 sm:grid-cols-2">
									<label class="block sm:col-span-2">
										<span
											class="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
											>Story points</span
										>
										<select
											class="field-control"
											bind:value={storyPointsFieldIdentifier}
											required
										>
											<option value="" disabled>
												Select a Story Points field
											</option>
											{#each developmentSuggestion.availableFields as field (field.identifier)}
												<option value={field.identifier}>{field.name}</option>
											{/each}
										</select>
									</label>
									<label class="block">
										<span
											class="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
											>Developer</span
										>
										<select
											class="field-control"
											bind:value={developerFieldIdentifier}
											required
										>
											<option value="" disabled>
												Select a Developer field
											</option>
											{#each developmentSuggestion.availableFields as field (field.identifier)}
												<option value={field.identifier}>{field.name}</option>
											{/each}
										</select>
									</label>
									<label class="block">
										<span
											class="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
											>Bounce count</span
										>
										<select
											class="field-control"
											bind:value={bounceCountFieldIdentifier}
											required
										>
											<option value="" disabled>
												Select a Bounce Count field
											</option>
											{#each developmentSuggestion.availableFields as field (field.identifier)}
												<option value={field.identifier}>{field.name}</option>
											{/each}
										</select>
									</label>
									{#each [["Done", doneStatus], ["QA", qualityAssuranceStatus], ["Ready for QA", readyForQualityAssuranceStatus]] as statusEntry (statusEntry[0])}
										<label class="block">
											<span
												class="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
												>{statusEntry[0]}</span
											>
											<select
												class="field-control"
												value={statusEntry[1]}
												onchange={(event) => {
												const selectedValue = event.currentTarget.value;
												if (statusEntry[0] === "Done") doneStatus = selectedValue;
												else if (statusEntry[0] === "QA") qualityAssuranceStatus = selectedValue;
												else readyForQualityAssuranceStatus = selectedValue;
											}}
											>
												{#each developmentSuggestion.availableStatuses as status (status.identifier)}
													<option value={status.name}>{status.name}</option>
												{/each}
											</select>
										</label>
									{/each}
								</div>
							</details>
						{/if}

						<section class="rounded-2xl border border-line bg-canvas/35 p-4">
							<label class="flex cursor-pointer items-start gap-3">
								<input
									class="mt-1 size-4 accent-mint"
									type="checkbox"
									checked={includeQualityAssurance}
									onchange={handleQualityAssuranceToggle}
									disabled={isSetupLoading}
								>
								<span>
									<span class="block text-sm font-semibold text-ice"
										>Add a QA leaderboard</span
									>
									<span class="mt-1 block text-xs leading-5 text-muted">
										Use another board’s scope and the same development sprint.
									</span>
								</span>
							</label>

							{#if includeQualityAssurance}
								<div class="mt-5 border-t border-line/70 pt-5">
									{#if isLoadingQualityAssuranceBoards}
										<LoadingState compact message="Finding QA boards…" />
									{:else if availableQualityAssuranceBoards.length > 0}
										<label class="block">
											<span
												class="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
												>QA board</span
											>
											<select
												class="field-control"
												bind:value={selectedQualityAssuranceBoardIdentifier}
												onchange={loadSelectedQualityAssuranceBoard}
												disabled={isLoadingQualityAssuranceSuggestion}
											>
												{#each availableQualityAssuranceBoards as board (board.identifier)}
													<option value={board.identifier}>
														{board.name}
														· {board.type} · #{board.identifier}
													</option>
												{/each}
											</select>
										</label>

										{#if isLoadingQualityAssuranceSuggestion}
											<LoadingState
												compact
												message="Reading QA board configuration…"
											/>
										{:else if qualityAssuranceSuggestion}
											<div class="mt-5 grid gap-5 sm:grid-cols-2">
												<label class="block">
													<span
														class="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
														>Story points</span
													>
													<select
														class="field-control"
														bind:value={qualityAssuranceStoryPointsFieldIdentifier}
														required
													>
														<option value="" disabled>
															Select Story Points
														</option>
														{#each qualityAssuranceSuggestion.availableFields as field (field.identifier)}
															<option value={field.identifier}>
																{field.name}
															</option>
														{/each}
													</select>
												</label>
												<label class="block">
													<span
														class="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
														>Tester</span
													>
													<select
														class="field-control"
														bind:value={testerFieldIdentifier}
														required
													>
														<option value="" disabled>Select Tester</option>
														{#each qualityAssuranceSuggestion.availableFields as field (field.identifier)}
															<option value={field.identifier}>
																{field.name}
															</option>
														{/each}
													</select>
												</label>
												<label class="block">
													<span
														class="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
														>Done</span
													>
													<select
														class="field-control"
														bind:value={qualityAssuranceDoneStatus}
													>
														{#each qualityAssuranceSuggestion.availableStatuses as status (status.identifier)}
															<option value={status.name}>{status.name}</option>
														{/each}
													</select>
												</label>
												<label class="block">
													<span
														class="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
														>Ready for QA</span
													>
													<select
														class="field-control"
														bind:value={qualityAssuranceReadyStatus}
													>
														{#each qualityAssuranceSuggestion.availableStatuses as status (status.identifier)}
															<option value={status.name}>{status.name}</option>
														{/each}
													</select>
												</label>
											</div>
										{/if}
									{/if}
								</div>
							{/if}
						</section>

						{#if errorMessage}
							<ErrorBanner
								message={errorMessage}
								onRetry={hasRetryableSetupError
									? retrySetupFailure
									: undefined}
							/>
						{/if}

						<button
							class="primary-button w-full"
							type="submit"
							disabled={!developmentSuggestion || isSetupLoading}
						>
							Save setup and open dashboard <span aria-hidden="true">→</span>
						</button>
					</form>
				{/if}
			</section>
		</div>
	</div>
</main>
