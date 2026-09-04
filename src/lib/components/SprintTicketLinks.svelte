<script lang="ts">
import { jiraIssueUrl } from "../presentation/jira";

interface TicketLink {
	issueKey: string;
	summary: string;
	status: string;
}

interface Properties {
	jiraSiteUrl?: string | null;
	tickets: TicketLink[];
}

let { jiraSiteUrl = null, tickets }: Properties = $props();
</script>

<p class="mt-2 text-xs leading-5 text-muted">
	{#each tickets as ticket, index (ticket.issueKey)}
		{#if index > 0}
			,
		{/if}
		{#if jiraSiteUrl}
			<a
				class="font-bold text-sky underline decoration-sky/35 underline-offset-2 transition-colors hover:text-ice focus-visible:text-ice"
				href={jiraIssueUrl(jiraSiteUrl, ticket.issueKey)}
				target="_blank"
				rel="noopener noreferrer"
				title={`${ticket.issueKey}: ${ticket.summary}`}
				aria-label={`Open ${ticket.issueKey} in Jira in a new tab`}
				>{ticket.issueKey}</a
			>
		{:else}
			<span
				class="font-bold text-sky"
				title={`${ticket.issueKey}: ${ticket.summary}`}
				>{ticket.issueKey}</span
			>
		{/if}
		<span> ({ticket.status})</span>
	{/each}
</p>
