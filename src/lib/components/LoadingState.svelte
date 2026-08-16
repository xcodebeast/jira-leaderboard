<script lang="ts">
interface Properties {
	message?: string;
	compact?: boolean;
}

let { message = "Loading Jira data…", compact = false }: Properties = $props();
</script>

<div
	class:py-20={!compact}
	class:py-6={compact}
	class="flex items-center justify-center gap-3 text-muted"
>
	<span class="loader-ring" aria-hidden="true"></span>
	<span class="text-sm font-medium">{message}</span>
</div>

<style>
.loader-ring {
	width: 1.25rem;
	height: 1.25rem;
	border: 2px solid rgb(139 255 202 / 18%);
	border-top-color: var(--color-mint);
	border-radius: 999px;
	animation: rotate 0.8s linear infinite;
}

@keyframes rotate {
	to {
		transform: rotate(360deg);
	}
}
</style>
