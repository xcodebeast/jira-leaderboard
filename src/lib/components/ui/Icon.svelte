<script lang="ts">
export type IconName =
	| "sprint"
	| "trophy"
	| "compare"
	| "settings"
	| "refresh"
	| "spark"
	| "shield"
	| "arrowLeft"
	| "arrowRight"
	| "check"
	| "copy"
	| "close";

interface Properties {
	name: IconName;
	size?: number;
	strokeWidth?: number;
	label?: string;
	class?: string;
}

let {
	name,
	size = 18,
	strokeWidth = 1.8,
	label,
	class: className = "",
}: Properties = $props();
</script>

<svg
	class={className}
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width={strokeWidth}
	stroke-linecap="round"
	stroke-linejoin="round"
	role={label ? "img" : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : "true"}
>
	{#if name === "sprint"}
		<path d="M5 21V4" />
		<path d="M5 5h11l-2.5 4L16 13H5" />
		<path d="M9 18h8" />
	{:else if name === "trophy"}
		<path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />
		<path d="M8 6H5v1a4 4 0 0 0 4 4" />
		<path d="M16 6h3v1a4 4 0 0 1-4 4" />
		<path d="M12 12v5M9 20h6M9 17h6" />
	{:else if name === "compare"}
		<path d="M7 7h11M15 4l3 3-3 3" />
		<path d="M17 17H6M9 14l-3 3 3 3" />
	{:else if name === "settings"}
		<circle cx="12" cy="12" r="3" />
		<path
			d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.09A1.7 1.7 0 0 0 8.95 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.58 15 1.7 1.7 0 0 0 3 14H3v-4h.09A1.7 1.7 0 0 0 4.6 8.95a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.58 1.7 1.7 0 0 0 10 3h4v.09A1.7 1.7 0 0 0 15.05 4.6a1.7 1.7 0 0 0 1.88-.34L17 4.2 19.83 7l-.06.06A1.7 1.7 0 0 0 19.42 9 1.7 1.7 0 0 0 21 10h.09v4H21a1.7 1.7 0 0 0-1.6 1Z"
		/>
	{:else if name === "refresh"}
		<path d="M20 11a8 8 0 0 0-14.9-3M4 4v5h5" />
		<path d="M4 13a8 8 0 0 0 14.9 3M20 20v-5h-5" />
	{:else if name === "spark"}
		<path
			d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z"
		/>
		<path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
	{:else if name === "shield"}
		<path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6l-7-3Z" />
		<path d="m9 12 2 2 4-4" />
	{:else if name === "arrowLeft"}
		<path d="M19 12H5M10 7l-5 5 5 5" />
	{:else if name === "arrowRight"}
		<path d="M5 12h14M14 7l5 5-5 5" />
	{:else if name === "check"}
		<path d="m5 12 4 4L19 6" />
	{:else if name === "copy"}
		<rect x="9" y="9" width="11" height="11" rx="2" />
		<path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" />
	{:else if name === "close"}
		<path d="m6 6 12 12M18 6 6 18" />
	{/if}
</svg>
