<script lang="ts">
import type { Snippet } from "svelte";
import type { HTMLAnchorAttributes } from "svelte/elements";

type LinkVariant = "primary" | "secondary" | "ghost";
type LinkSize = "small" | "medium" | "large";

interface Properties extends HTMLAnchorAttributes {
	children: Snippet;
	href: string;
	variant?: LinkVariant;
	size?: LinkSize;
}

let {
	children,
	href,
	variant = "secondary",
	size = "medium",
	class: className = "",
	...restProperties
}: Properties = $props();

const variantClasses: Record<LinkVariant, string> = {
	primary:
		"border-brand bg-brand text-[#171306] shadow-[0_10px_28px_rgb(246_207_91/0.13)] hover:border-brand-strong hover:bg-brand-strong",
	secondary:
		"border-line bg-panel-soft/70 text-ice hover:border-[#4b5c63] hover:bg-panel-soft",
	ghost:
		"border-transparent bg-transparent text-muted hover:bg-panel-soft/70 hover:text-ice",
};
const sizeClasses: Record<LinkSize, string> = {
	small: "min-h-9 px-3 py-1.5 text-xs",
	medium: "min-h-11 px-4 py-2.5 text-sm",
	large: "min-h-12 px-5 py-3 text-sm",
};
</script>

<a
	class={`inline-flex shrink-0 items-center justify-center gap-2 rounded-[0.8rem] border font-bold transition-[transform,border-color,background,color,box-shadow] duration-150 hover:-translate-y-px ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
	{href}
	{...restProperties}
>
	{@render children()}
</a>
