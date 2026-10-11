import { parseCommaOrLineList } from "../geminiPrompt";

export const WHISTLE_LANGUAGES = [
	"en",
	"de",
	"fr",
	"es",
	"it",
	"nl",
	"pl",
] as const;

export type WhistleLanguage = (typeof WHISTLE_LANGUAGES)[number];

export const WHISTLE_SAMPLE_RATE = 16000;
export const WHISTLE_MAX_CLIP_SECONDS = 30;
export const WHISTLE_STREAM_CHUNK_SAMPLES = WHISTLE_SAMPLE_RATE;

export interface WhistleWordTimestamp {
	word: string;
	start: number;
	end: number;
	probability: number;
}

export interface WhistleTranscript {
	text: string;
	language: string;
	ttft_ms: number;
	decode_tps: number;
	words?: WhistleWordTimestamp[];
}

export interface WhistleStreamResult {
	text: string;
	words?: WhistleWordTimestamp[];
	pending: string;
	language: string;
	received: number;
	pass_ms: number;
}

export interface WhistleCallOptions {
	language: WhistleLanguage | null;
	keywords: string | null;
	wordTimestamps: boolean;
}

const LANGUAGE_SET = new Set<string>(WHISTLE_LANGUAGES);

export function normalizeWhistleLanguage(input: string): WhistleLanguage | null {
	const trimmed = input.trim();
	if (!trimmed || trimmed.toLowerCase() === "auto") {
		return null;
	}
	const base = trimmed.split(/[-_]/)[0].toLowerCase();
	if (LANGUAGE_SET.has(base)) {
		return base as WhistleLanguage;
	}
	return null;
}

export function normalizeWhistleKeywords(input: string): string | null {
	const terms = parseCommaOrLineList(input);
	if (terms.length === 0) {
		return null;
	}
	return terms.join("\n");
}

export function buildWhistleCallOptions(
	settings: {
		whistleLanguage: string;
		whistleKeywords: string;
		whistleWordTimestamps: boolean;
		language?: string;
	}
): WhistleCallOptions {
	const fromWhistle = normalizeWhistleLanguage(settings.whistleLanguage);
	const language =
		fromWhistle ??
		(settings.language
			? normalizeWhistleLanguage(settings.language)
			: null);
	return {
		language,
		keywords: normalizeWhistleKeywords(settings.whistleKeywords),
		wordTimestamps: settings.whistleWordTimestamps,
	};
}

export function parseWhistleTranscriptJson(raw: string): WhistleTranscript {
	const parsed = JSON.parse(raw) as WhistleTranscript;
	return {
		text: parsed.text ?? "",
		language: parsed.language ?? "",
		ttft_ms: parsed.ttft_ms ?? 0,
		decode_tps: parsed.decode_tps ?? 0,
		words: parsed.words,
	};
}

export function parseWhistleStreamJson(raw: string): WhistleStreamResult {
	const parsed = JSON.parse(raw) as WhistleStreamResult;
	return {
		text: parsed.text ?? "",
		words: parsed.words,
		pending: parsed.pending ?? "",
		language: parsed.language ?? "",
		received: parsed.received ?? 0,
		pass_ms: parsed.pass_ms ?? 0,
	};
}

export function joinTranscripts(parts: string[]): string {
	return parts
		.map((p) => p.trim())
		.filter(Boolean)
		.join(" ");
}
