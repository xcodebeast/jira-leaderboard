import type { JiraSprint } from "../domain/jira";

const numberFormatter = new Intl.NumberFormat("en-US", {
	maximumFractionDigits: 1,
});

export function formatNumber(value: number): string {
	return numberFormatter.format(value);
}

export function formatDelta(value: number): string {
	return `${value > 0 ? "+" : ""}${formatNumber(value)}`;
}

export function sprintDateDescription(sprint: JiraSprint | null): string {
	if (!sprint?.startDate || !sprint.endDate) {
		return "Dates unavailable";
	}

	const dateFormatter = new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
	});
	return `${dateFormatter.format(new Date(sprint.startDate))} – ${dateFormatter.format(new Date(sprint.endDate))}`;
}
