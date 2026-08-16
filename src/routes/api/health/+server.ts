import { apiErrorResponse, apiJson } from "$lib/server/api";
import { validateSessionConfiguration } from "$lib/server/session";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
	try {
		validateSessionConfiguration();
		return apiJson({ status: "ok" });
	} catch (error) {
		return apiErrorResponse(error);
	}
};
