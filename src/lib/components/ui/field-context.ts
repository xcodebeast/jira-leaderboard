import { getContext, setContext } from "svelte";

export interface FieldContext {
	readonly controlIdentifier: string;
	readonly descriptionIdentifier: string | undefined;
	readonly invalid: boolean;
}

const fieldContextKey = Symbol("field-context");

export function setFieldContext(context: FieldContext): void {
	setContext(fieldContextKey, context);
}

export function getFieldContext(): FieldContext | undefined {
	return getContext<FieldContext | undefined>(fieldContextKey);
}

export function mergeDescriptionIdentifiers(
	...identifiers: Array<string | null | undefined>
): string | undefined {
	const uniqueIdentifiers = new Set(
		identifiers.flatMap(
			(identifier) => identifier?.split(/\s+/).filter(Boolean) ?? [],
		),
	);
	return uniqueIdentifiers.size > 0
		? [...uniqueIdentifiers].join(" ")
		: undefined;
}
