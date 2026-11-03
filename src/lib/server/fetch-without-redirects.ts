/**
 * Fetches without following redirects, so Jira credentials never reach another host.
 *
 * Cloudflare Workers reject `redirect: "error"`, so this asks for `"manual"` and fails
 * on a redirect response the way `"error"` would: by throwing a `TypeError`.
 */
export async function fetchWithoutRedirects(
	input: URL | string,
	init: RequestInit = {},
): Promise<Response> {
	const response = await fetch(input, { ...init, redirect: "manual" });
	const isRedirect = response.status >= 300 && response.status < 400;
	if (isRedirect) {
		await response.body?.cancel();
		throw new TypeError(
			`Refused to follow a redirect from ${new URL(input).host}.`,
		);
	}

	return response;
}
