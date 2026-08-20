<script lang="ts">
import type { Snippet } from "svelte";
import type { HTMLButtonAttributes } from "svelte/elements";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "small" | "medium" | "large" | "icon";

interface Properties extends HTMLButtonAttributes {
	children: Snippet;
	variant?: ButtonVariant;
	size?: ButtonSize;
	loading?: boolean;
}

let {
	children,
	variant = "secondary",
	size = "medium",
	loading = false,
	disabled = false,
	type = "button",
	class: className = "",
	...restProperties
}: Properties = $props();

const variantClasses: Record<ButtonVariant, string> = {
	primary:
		"border-brand bg-brand text-[#171306] shadow-[0_10px_28px_rgb(246_207_91/0.13)] hover:border-brand-strong hover:bg-brand-strong hover:shadow-[0_13px_30px_rgb(246_207_91/0.18)]",
	secondary:
		"border-line bg-panel-soft/70 text-ice hover:border-[#4b5c63] hover:bg-panel-soft",
	ghost:
		"border-transparent bg-transparent text-muted hover:bg-panel-soft/70 hover:text-ice",
	danger:
		"border-coral/35 bg-coral/8 text-coral hover:border-coral/55 hover:bg-coral/14",
};

const sizeClasses: Record<ButtonSize, string> = {
	small: "min-h-9 px-3 py-1.5 text-xs",
	medium: "min-h-11 px-4 py-2.5 text-sm",
	large: "min-h-12 px-5 py-3 text-sm",
	icon: "size-10 p-0",
};

let buttonClasses = $derived(
	`inline-flex shrink-0 items-center justify-center gap-2 rounded-[0.8rem] border font-bold transition-[transform,border-color,background,color,box-shadow] duration-150 enabled:hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`,
);
</script>

<button
	class={buttonClasses}
	{type}
	disabled={disabled || loading}
	aria-busy={loading}
	{...restProperties}
>
	{#if loading}
		<span class="button-spinner" aria-hidden="true"></span>
	{/if}
	{@render children()}
</button>

<style>
.button-spinner {
	width: 0.95rem;
	height: 0.95rem;
	border: 2px solid currentColor;
	border-right-color: transparent;
	border-radius: 999px;
	opacity: 0.7;
	animation: rotate 0.75s linear infinite;
}

@keyframes rotate {
	to {
		transform: rotate(360deg);
	}
}
</style>
