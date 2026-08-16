<script lang="ts">
interface Properties {
	message: string;
	onRetry?: () => void;
}

let { message, onRetry }: Properties = $props();
</script>

<div
	class="flex flex-col gap-3 rounded-xl border border-coral/25 bg-coral/8 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
	role="alert"
>
	<div class="flex items-start gap-3">
		<span
			class="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-coral/15 text-sm font-bold text-coral"
			>!</span
		>
		<p class="text-sm leading-6 text-[#ffd8d0]">{message}</p>
	</div>
	{#if onRetry}
		<button
			class="secondary-button shrink-0 text-sm"
			type="button"
			onclick={onRetry}
		>
			Try again
		</button>
	{/if}
</div>
