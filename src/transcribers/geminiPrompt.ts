export const MAX_CUSTOM_VOCABULARY = 1000;

export function parseCommaOrLineList(
	text: string,
	max = MAX_CUSTOM_VOCABULARY
): string[] {
	if (!text.trim()) {
		return [];
	}
	return text
		.split(/[,\n]/)
		.map((term) => term.trim())
		.filter(Boolean)
		.slice(0, max);
}

export function parseLanguageCodes(text: string): string[] {
	return parseCommaOrLineList(text, 32);
}
