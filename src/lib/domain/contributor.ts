export type ContributorRole = "development" | "qualityAssurance";

export interface ContributorReference {
	displayName: string;
	accountIdentifier: string | null;
}

export interface ContributorProfileSelection {
	contributor: ContributorReference;
	role: ContributorRole;
	scope: "board" | "global";
	sourceLabel: string;
}

function normalizedContributorName(displayName: string): string {
	return displayName
		.trim()
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLocaleLowerCase("en-US");
}

export function contributorIdentityKey(
	displayName: string,
	accountIdentifier?: string | null,
): string {
	return accountIdentifier
		? `account:${accountIdentifier}`
		: `name:${normalizedContributorName(displayName)}`;
}

export function isSameContributor(
	leftContributor: ContributorReference,
	rightContributor: ContributorReference,
): boolean {
	if (leftContributor.accountIdentifier && rightContributor.accountIdentifier) {
		return (
			leftContributor.accountIdentifier === rightContributor.accountIdentifier
		);
	}

	return (
		!leftContributor.accountIdentifier &&
		!rightContributor.accountIdentifier &&
		normalizedContributorName(leftContributor.displayName) ===
			normalizedContributorName(rightContributor.displayName)
	);
}
