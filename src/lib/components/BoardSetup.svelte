<script lang="ts">
import { onMount } from "svelte";
import {
	loadBoards,
	loadDevelopmentSetupSuggestion,
	loadQualityAssuranceSetupSuggestion,
} from "../browser/api-client";
import type {
	AppConfiguration,
	QualityAssuranceConfiguration,
} from "../browser/configuration";
import type { JiraBoard } from "../domain/jira";
import type {
	JiraSetupSuggestion,
	QualityAssuranceSetupSuggestion,
} from "../domain/setup";
import LogoMark from "./LogoMark.svelte";
import Alert from "./ui/Alert.svelte";
import Button from "./ui/Button.svelte";
import Card from "./ui/Card.svelte";
import Checkbox from "./ui/Checkbox.svelte";
import Field from "./ui/Field.svelte";
import Input from "./ui/Input.svelte";
import LoadingState from "./ui/LoadingState.svelte";
import Select from "./ui/Select.svelte";

interface Properties {
	initialConfiguration?: AppConfiguration | null;
	onComplete: (configuration: AppConfiguration) => void;
	onDisconnect: () => void;
}

let {
	initialConfiguration = null,
	onComplete,
	onDisconnect,
}: Properties = $props();
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

function applyConfiguredDevelopmentValues(
	configuration: AppConfiguration,
): void {
	storyPointsFieldIdentifier =
		configuration.fieldMapping.storyPointsFieldIdentifier;
	developerFieldIdentifier =
		configuration.fieldMapping.developerFieldIdentifier;
	bounceCountFieldIdentifier =
		configuration.fieldMapping.bounceCountFieldIdentifier;
	doneStatus = configuration.statusMapping.done;
	qualityAssuranceStatus = configuration.statusMapping.qualityAssurance;
	readyForQualityAssuranceStatus =
		configuration.statusMapping.readyForQualityAssurance;
	defaultProjectKey = configuration.defaultProjectKey;
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

function applyConfiguredQualityAssuranceValues(
	configuration: QualityAssuranceConfiguration,
): void {
	qualityAssuranceStoryPointsFieldIdentifier =
		configuration.fieldMapping.storyPointsFieldIdentifier;
	testerFieldIdentifier = configuration.fieldMapping.testerFieldIdentifier;
	qualityAssuranceDoneStatus = configuration.statusMapping.done;
	qualityAssuranceReadyStatus =
		configuration.statusMapping.readyForQualityAssurance;
}

async function loadSelectedDevelopmentBoard(
	configurationToRestore: AppConfiguration | null = null,
): Promise<void> {
	const boardIdentifier = Number(selectedBoardIdentifier);
	if (!boardIdentifier) {
		return;
	}
	isLoadingSuggestion = true;
	errorMessage = "";
	try {
		const loadedSuggestion = await loadDevelopmentSetupSuggestion(
			boardIdentifier,
			configurationToRestore
				? Object.values(configurationToRestore.fieldMapping)
				: [],
		);
		applySuggestion(loadedSuggestion);
		if (configurationToRestore?.boardIdentifier === boardIdentifier) {
			applyConfiguredDevelopmentValues(configurationToRestore);
		}
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
		const configuredBoard = initialConfiguration
			? boards.find(
					(board) => board.identifier === initialConfiguration?.boardIdentifier,
				)
			: undefined;
		selectedBoardIdentifier = String(
			(configuredBoard ?? initialBoard).identifier,
		);
		await loadSelectedDevelopmentBoard(
			configuredBoard ? initialConfiguration : null,
		);
		if (configuredBoard && initialConfiguration?.qualityAssurance) {
			includeQualityAssurance = true;
			await loadQualityAssuranceBoards(initialConfiguration.qualityAssurance);
		}
	} catch (error) {
		errorMessage =
			error instanceof Error
				? error.message
				: "Scrum boards could not be loaded.";
	} finally {
		isLoadingBoards = false;
	}
}

async function loadSelectedQualityAssuranceBoard(
	configurationToRestore: QualityAssuranceConfiguration | null = null,
): Promise<void> {
	const boardIdentifier = Number(selectedQualityAssuranceBoardIdentifier);
	if (!boardIdentifier) {
		return;
	}
	isLoadingQualityAssuranceSuggestion = true;
	errorMessage = "";
	try {
		const loadedSuggestion = await loadQualityAssuranceSetupSuggestion(
			boardIdentifier,
			configurationToRestore
				? Object.values(configurationToRestore.fieldMapping)
				: [],
		);
		applyQualityAssuranceSuggestion(loadedSuggestion);
		if (configurationToRestore?.boardIdentifier === boardIdentifier) {
			applyConfiguredQualityAssuranceValues(configurationToRestore);
		}
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

async function loadQualityAssuranceBoards(
	configurationToRestore: QualityAssuranceConfiguration | null = null,
): Promise<void> {
	isLoadingQualityAssuranceBoards = true;
	errorMessage = "";
	try {
		qualityAssuranceBoards = await loadBoards("all");
		const configuredBoard = configurationToRestore
			? qualityAssuranceBoards.find(
					(board) =>
						board.identifier === configurationToRestore.boardIdentifier &&
						board.identifier !== Number(selectedBoardIdentifier),
				)
			: undefined;
		const initialBoard =
			configuredBoard ??
			qualityAssuranceBoards.find(
				(board) => board.identifier !== Number(selectedBoardIdentifier),
			);
		if (!initialBoard) {
			throw new Error(
				"This Jira account cannot access another board for quality assurance.",
			);
		}
		selectedQualityAssuranceBoardIdentifier = String(initialBoard.identifier);
		await loadSelectedQualityAssuranceBoard(
			configuredBoard ? configurationToRestore : null,
		);
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

onMount(() => {
	void loadAvailableBoards();
});
</script>

<main class="subtle-grid min-h-screen px-5 py-8 sm:px-8">
	<div class="mx-auto max-w-4xl">
		<header class="flex items-center justify-between gap-4">
			<LogoMark />
		</header>

		<div class="mt-12 grid gap-8 md:grid-cols-[13rem_1fr]">
			<aside>
				<p class="eyebrow">Step 2 of 3</p>
				<h1 class="display-title mt-3 text-4xl leading-none text-ice">
					Map your board
				</h1>
				<p class="mt-4 text-sm leading-6 text-muted">
					We've suggested Jira fields and statuses. Review once; your browser
					will remember.
				</p>
				<ol class="mt-8 space-y-4 text-sm">
					<li class="flex gap-3 text-mint">
						<span class="font-mono">01</span
						><span class="font-semibold">Credentials verified</span>
					</li>
					<li class="flex gap-3 text-ice">
						<span class="font-mono text-brand">02</span
						><span class="font-semibold">Board & mappings</span>
					</li>
					<li class="flex gap-3 text-muted">
						<span class="font-mono">03</span><span>Open dashboard</span>
					</li>
				</ol>
			</aside>

			<Card class="rounded-[1.3rem] p-5 sm:p-8" accent="brand">
				{#if isLoadingBoards}
					<LoadingState message="Finding your Scrum boards…" />
				{:else}
					<form class="space-y-6" onsubmit={handleSubmit}>
						<Field label="Scrum board">
							<Select
								bind:value={selectedBoardIdentifier}
								onchange={() => void loadSelectedDevelopmentBoard()}
								disabled={isLoadingSuggestion}
							>
								{#each boards as board (board.identifier)}
									<option value={String(board.identifier)}>
										{board.name}
										· #{board.identifier}
									</option>
								{/each}
							</Select>
						</Field>

						{#if isLoadingSuggestion}
							<LoadingState compact message="Reading board configuration…" />
						{:else if developmentSuggestion}
							{#if developmentSuggestion.availableProjects.length > 0}
								<Field label="Period comparison project">
									<Select
										class="max-w-md"
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
									</Select>
									<span class="mt-2 block text-xs text-muted">
										{developmentSuggestion.availableProjects
											.length === 1
											? "Detected from this board's Jira project."
											: "This board contains multiple projects. Choose the default for period comparisons."}
									</span>
								</Field>
							{:else}
								<Field label="Default project key">
									<Input
										class="max-w-xs"
										bind:value={defaultProjectKey}
										placeholder="DEMO"
										required
									/>
									<span class="mt-2 block text-xs text-muted">
										Jira could not infer a project from this board's filter.
										Enter the default for period comparisons.
									</span>
								</Field>
							{/if}

							<details
								class="rounded-2xl border border-line bg-canvas/35 p-4"
								open={!storyPointsFieldIdentifier ||
									!developerFieldIdentifier ||
									!bounceCountFieldIdentifier}
							>
								<summary class="cursor-pointer text-sm font-semibold text-ice">
									Review advanced mappings
								</summary>
								<div class="mt-5 grid gap-5 sm:grid-cols-2">
									<Field label="Story points" compact class="sm:col-span-2">
										<Select bind:value={storyPointsFieldIdentifier} required>
											<option value="" disabled>
												Select a Story Points field
											</option>
											{#each developmentSuggestion.availableFields as field (field.identifier)}
												<option value={field.identifier}>{field.name}</option>
											{/each}
										</Select>
									</Field>
									<Field label="Developer" compact>
										<Select bind:value={developerFieldIdentifier} required>
											<option value="" disabled>
												Select a Developer field
											</option>
											{#each developmentSuggestion.availableFields as field (field.identifier)}
												<option value={field.identifier}>{field.name}</option>
											{/each}
										</Select>
									</Field>
									<Field label="Bounce count" compact>
										<Select bind:value={bounceCountFieldIdentifier} required>
											<option value="" disabled>
												Select a Bounce Count field
											</option>
											{#each developmentSuggestion.availableFields as field (field.identifier)}
												<option value={field.identifier}>{field.name}</option>
											{/each}
										</Select>
									</Field>
									{#each [["Done", doneStatus], ["QA", qualityAssuranceStatus], ["Ready for QA", readyForQualityAssuranceStatus]] as statusEntry (statusEntry[0])}
										<Field label={statusEntry[0]} compact>
											<Select
												value={statusEntry[1]}
												onchange={(event) => {
													const selectedValue =
														event.currentTarget
															.value;
													if (
														statusEntry[0] ===
														"Done"
													)
														doneStatus =
															selectedValue;
													else if (
														statusEntry[0] === "QA"
													)
														qualityAssuranceStatus =
															selectedValue;
													else
														readyForQualityAssuranceStatus =
															selectedValue;
												}}
											>
												{#each developmentSuggestion.availableStatuses as status (status.identifier)}
													<option value={status.name}>{status.name}</option>
												{/each}
											</Select>
										</Field>
									{/each}
								</div>
							</details>
						{/if}

						<section class="rounded-2xl border border-line bg-canvas/35 p-4">
							<label
								class="flex cursor-pointer items-start gap-3"
								for="include-quality-assurance"
							>
								<Checkbox
									id="include-quality-assurance"
									class="mt-1"
									checked={includeQualityAssurance}
									onchange={handleQualityAssuranceToggle}
									disabled={isSetupLoading}
								/>
								<span>
									<span class="block text-sm font-semibold text-ice"
										>Add QA performance</span
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
										<Field label="QA board" compact>
											<Select
												bind:value={selectedQualityAssuranceBoardIdentifier}
												onchange={() =>
												void loadSelectedQualityAssuranceBoard()}
												disabled={isLoadingQualityAssuranceSuggestion}
											>
												{#each availableQualityAssuranceBoards as board (board.identifier)}
													<option value={String(board.identifier)}>
														{board.name}
														· {board.type} · #{board.identifier}
													</option>
												{/each}
											</Select>
										</Field>

										{#if isLoadingQualityAssuranceSuggestion}
											<LoadingState
												compact
												message="Reading QA board configuration…"
											/>
										{:else if qualityAssuranceSuggestion}
											<div class="mt-5 grid gap-5 sm:grid-cols-2">
												<Field label="Story points" compact>
													<Select
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
													</Select>
												</Field>
												<Field label="Tester" compact>
													<Select bind:value={testerFieldIdentifier} required>
														<option value="" disabled>Select Tester</option>
														{#each qualityAssuranceSuggestion.availableFields as field (field.identifier)}
															<option value={field.identifier}>
																{field.name}
															</option>
														{/each}
													</Select>
												</Field>
												<Field label="Done" compact>
													<Select bind:value={qualityAssuranceDoneStatus}>
														{#each qualityAssuranceSuggestion.availableStatuses as status (status.identifier)}
															<option value={status.name}>{status.name}</option>
														{/each}
													</Select>
												</Field>
												<Field label="Ready for QA" compact>
													<Select bind:value={qualityAssuranceReadyStatus}>
														{#each qualityAssuranceSuggestion.availableStatuses as status (status.identifier)}
															<option value={status.name}>{status.name}</option>
														{/each}
													</Select>
												</Field>
											</div>
										{/if}
									{/if}
								</div>
							{/if}
						</section>

						{#if errorMessage}
							<Alert
								message={errorMessage}
								onRetry={hasRetryableSetupError
									? retrySetupFailure
									: undefined}
							/>
						{/if}

						<Button
							class="w-full"
							variant="primary"
							size="large"
							type="submit"
							disabled={!developmentSuggestion || isSetupLoading}
						>
							Save setup and open dashboard <span aria-hidden="true">→</span>
						</Button>
					</form>
				{/if}
			</Card>
		</div>
	</div>
</main>
