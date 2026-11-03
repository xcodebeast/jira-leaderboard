import { afterEach, expect, mock, test } from "bun:test";
import { fetchWithoutRedirects } from "../src/lib/server/fetch-without-redirects";

const originalFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = originalFetch;
});

function respondWith(status: number) {
	const fetchMock = mock(
		async (_input: unknown, _init?: RequestInit) =>
			new Response(null, { status }),
	);
	globalThis.fetch = fetchMock as unknown as typeof fetch;
	return fetchMock;
}

test("asks for manual redirects, which Cloudflare Workers support", async () => {
	const fetchMock = respondWith(200);
	await fetchWithoutRedirects("https://example.atlassian.net/rest", {
		redirect: "follow",
	});
	expect(fetchMock.mock.calls[0]?.[1]?.redirect).toBe("manual");
});

test("refuses redirects, like redirect: error", async () => {
	respondWith(302);
	await expect(
		fetchWithoutRedirects("https://example.atlassian.net/rest"),
	).rejects.toBeInstanceOf(TypeError);
});

test("passes other responses through", async () => {
	respondWith(404);
	expect(
		(await fetchWithoutRedirects("https://example.atlassian.net/rest")).status,
	).toBe(404);
});
