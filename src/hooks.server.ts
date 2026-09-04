import type { Handle } from "@sveltejs/kit";
import {
	isShareSnapshotPath,
	originMatchesRequestHost,
} from "$lib/server/request-security";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const handle: Handle = async ({ event, resolve }) => {
	if (unsafeMethods.has(event.request.method)) {
		const origin = event.request.headers.get("Origin");
		if (
			origin &&
			!originMatchesRequestHost(origin, event.request.headers.get("Host"))
		) {
			return new Response(
				JSON.stringify({ message: "Cross-origin requests are not allowed." }),
				{
					status: 403,
					headers: {
						"Content-Type": "application/json",
						"Cache-Control": "no-store",
					},
				},
			);
		}
	}

	const contentLength = Number(
		event.request.headers.get("Content-Length") ?? 0,
	);
	if (event.url.pathname.startsWith("/api/") && contentLength > 20_000) {
		return new Response(
			JSON.stringify({ message: "The request body is too large." }),
			{
				status: 413,
				headers: {
					"Content-Type": "application/json",
					"Cache-Control": "no-store",
				},
			},
		);
	}

	const response = await resolve(event);
	response.headers.set("Referrer-Policy", "same-origin");
	response.headers.set("X-Content-Type-Options", "nosniff");
	response.headers.set("X-Frame-Options", "DENY");
	response.headers.set(
		"Permissions-Policy",
		"camera=(), microphone=(), geolocation=(), payment=(), usb=()",
	);
	if (event.url.pathname.startsWith("/api/")) {
		response.headers.set("Cache-Control", "no-store");
	}
	if (isShareSnapshotPath(event.url.pathname)) {
		response.headers.set("Cache-Control", "no-store");
		response.headers.set("Referrer-Policy", "no-referrer");
		response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
	}

	return response;
};
