import {
	type JiraSprint,
	type JiraSprintPage,
	jiraSprintSortTime,
	mergeJiraSprints,
} from "../domain/jira";
import { loadSprintPage } from "./api-client";

export type ClosedSprintTraversalDirection = "higherOffsets" | "lowerOffsets";

export interface ClosedSprintPageRequest {
	startAt: number;
	maxResults: number;
	direction: ClosedSprintTraversalDirection;
}

export interface SprintHistorySnapshot {
	sprints: JiraSprint[];
	totalClosedSprints: number | null;
	nextClosedSprintPageRequest: ClosedSprintPageRequest | null;
}

const closedSprintPageSize = 25;

function latestSprintTime(page: JiraSprintPage): number {
	return Math.max(-Infinity, ...page.sprints.map(jiraSprintSortTime));
}

export function selectRecentClosedSprintPage(
	firstPage: JiraSprintPage,
	lastPage: JiraSprintPage,
): {
	page: JiraSprintPage;
	direction: ClosedSprintTraversalDirection;
} {
	if (latestSprintTime(lastPage) >= latestSprintTime(firstPage)) {
		return { page: lastPage, direction: "lowerOffsets" };
	}

	return { page: firstPage, direction: "higherOffsets" };
}

export function createNextClosedSprintPageRequest(
	page: JiraSprintPage,
	direction: ClosedSprintTraversalDirection,
): ClosedSprintPageRequest | null {
	if (direction === "higherOffsets") {
		return page.nextStartAt === null
			? null
			: {
					startAt: page.nextStartAt,
					maxResults: closedSprintPageSize,
					direction,
				};
	}

	if (page.startAt === 0) {
		return null;
	}
	const maxResults = Math.min(closedSprintPageSize, page.startAt);
	return {
		startAt: page.startAt - maxResults,
		maxResults,
		direction,
	};
}

export async function initializeSprintHistory(
	boardIdentifier: number,
): Promise<SprintHistorySnapshot> {
	const [activeSprintPage, firstClosedSprintPage] = await Promise.all([
		loadSprintPage(boardIdentifier, "active", 0, 50),
		loadSprintPage(boardIdentifier, "closed", 0, closedSprintPageSize),
	]);
	let recentClosedSprintPage = firstClosedSprintPage;
	let direction: ClosedSprintTraversalDirection = "higherOffsets";
	const totalClosedSprints = firstClosedSprintPage.total;
	if (
		totalClosedSprints !== null &&
		totalClosedSprints > firstClosedSprintPage.sprints.length
	) {
		const lastPageStartAt = Math.max(
			0,
			totalClosedSprints - closedSprintPageSize,
		);
		if (lastPageStartAt !== firstClosedSprintPage.startAt) {
			const lastClosedSprintPage = await loadSprintPage(
				boardIdentifier,
				"closed",
				lastPageStartAt,
				closedSprintPageSize,
			);
			const selection = selectRecentClosedSprintPage(
				firstClosedSprintPage,
				lastClosedSprintPage,
			);
			recentClosedSprintPage = selection.page;
			direction = selection.direction;
		}
	}

	return {
		sprints: mergeJiraSprints(
			activeSprintPage.sprints,
			recentClosedSprintPage.sprints,
		),
		totalClosedSprints,
		nextClosedSprintPageRequest: createNextClosedSprintPageRequest(
			recentClosedSprintPage,
			direction,
		),
	};
}

export async function loadOlderSprintHistoryPage(
	boardIdentifier: number,
	request: ClosedSprintPageRequest,
): Promise<SprintHistorySnapshot> {
	const page = await loadSprintPage(
		boardIdentifier,
		"closed",
		request.startAt,
		request.maxResults,
	);

	return {
		sprints: page.sprints,
		totalClosedSprints: page.total,
		nextClosedSprintPageRequest: createNextClosedSprintPageRequest(
			page,
			request.direction,
		),
	};
}
