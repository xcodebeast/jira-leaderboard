export function originMatchesRequestHost(
	origin: string,
	requestHost: string | null,
): boolean {
	if (!requestHost) {
		return false;
	}

	try {
		const originUrl = new URL(origin);
		return (
			originUrl.host.toLocaleLowerCase() === requestHost.toLocaleLowerCase()
		);
	} catch {
		return false;
	}
}
