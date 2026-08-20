<script lang="ts">
import Button from "./Button.svelte";

interface Properties {
	message: string;
	onRetry?: () => void;
}

let { message, onRetry }: Properties = $props();
</script>

<div
	class="flex flex-col gap-3 rounded-[0.9rem] border border-coral/30 bg-coral/8 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
	role="alert"
>
	<div class="flex items-start gap-3">
		<span
			class="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-coral/15 text-sm font-extrabold text-coral"
			aria-hidden="true"
			>!</span
		>
		<p class="text-sm leading-6 text-[#ffd8d2]">{message}</p>
	</div>
	{#if onRetry}
		<Button variant="secondary" size="small" onclick={onRetry}
			>Try again</Button
		>
	{/if}
</div>
