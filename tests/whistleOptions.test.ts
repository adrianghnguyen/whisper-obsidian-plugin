import { describe, it, expect } from "vitest";
import {
	WHISTLE_LANGUAGES,
	WHISTLE_MAX_CLIP_SECONDS,
	WHISTLE_SAMPLE_RATE,
	buildWhistleCallOptions,
	joinTranscripts,
	normalizeWhistleKeywords,
	normalizeWhistleLanguage,
	parseWhistleTranscriptJson,
} from "../src/transcribers/whistle/options";

describe("Whistle language list", () => {
	it("covers exactly the seven Cactus languages", () => {
		expect([...WHISTLE_LANGUAGES]).toEqual([
			"en",
			"de",
			"fr",
			"es",
			"it",
			"nl",
			"pl",
		]);
	});

	it("transcribes 16 kHz audio in 30-second windows", () => {
		expect(WHISTLE_SAMPLE_RATE).toBe(16000);
		expect(WHISTLE_MAX_CLIP_SECONDS).toBe(30);
	});
});

describe("normalizeWhistleLanguage", () => {
	it("treats empty, auto, and whitespace as detect-language", () => {
		expect(normalizeWhistleLanguage("")).toBeNull();
		expect(normalizeWhistleLanguage("   ")).toBeNull();
		expect(normalizeWhistleLanguage("auto")).toBeNull();
		expect(normalizeWhistleLanguage("AUTO")).toBeNull();
	});

	it("accepts ISO 639-1 codes from the supported set", () => {
		expect(normalizeWhistleLanguage("en")).toBe("en");
		expect(normalizeWhistleLanguage("DE")).toBe("de");
		expect(normalizeWhistleLanguage(" pl ")).toBe("pl");
	});

	it("strips a BCP-47 region tag", () => {
		expect(normalizeWhistleLanguage("en-US")).toBe("en");
		expect(normalizeWhistleLanguage("fr_CA")).toBe("fr");
		expect(normalizeWhistleLanguage("nl-NL")).toBe("nl");
	});

	it("returns null for languages Whistle cannot transcribe", () => {
		expect(normalizeWhistleLanguage("ja")).toBeNull();
		expect(normalizeWhistleLanguage("zh-CN")).toBeNull();
		expect(normalizeWhistleLanguage("pt")).toBeNull();
	});
});

describe("normalizeWhistleKeywords", () => {
	it("returns null when the list is empty", () => {
		expect(normalizeWhistleKeywords("")).toBeNull();
		expect(normalizeWhistleKeywords("  \n  ")).toBeNull();
	});

	it("joins comma and newline lists with newlines for the C API", () => {
		expect(normalizeWhistleKeywords("Siobhan, Kraków")).toBe(
			"Siobhan\nKraków"
		);
		expect(normalizeWhistleKeywords("Needle\nWhistle")).toBe(
			"Needle\nWhistle"
		);
	});

	it("keeps a multi-word phrase as one keyword", () => {
		expect(normalizeWhistleKeywords("living room, kitchen")).toBe(
			"living room\nkitchen"
		);
	});
});

describe("buildWhistleCallOptions", () => {
	it("detects language and skips keywords by default", () => {
		expect(
			buildWhistleCallOptions({
				whistleLanguage: "",
				whistleKeywords: "",
				whistleWordTimestamps: false,
			})
		).toEqual({
			language: null,
			keywords: null,
			wordTimestamps: false,
		});
	});

	it("prefers whistleLanguage over the shared language field", () => {
		expect(
			buildWhistleCallOptions({
				whistleLanguage: "de",
				language: "en",
				whistleKeywords: "Obsidian",
				whistleWordTimestamps: true,
			})
		).toEqual({
			language: "de",
			keywords: "Obsidian",
			wordTimestamps: true,
		});
	});

	it("falls back to the shared language field when whistleLanguage is empty", () => {
		expect(
			buildWhistleCallOptions({
				whistleLanguage: "",
				language: "fr-FR",
				whistleKeywords: "",
				whistleWordTimestamps: false,
			}).language
		).toBe("fr");
	});
});

describe("parseWhistleTranscriptJson", () => {
	it("reads the C API JSON object", () => {
		expect(
			parseWhistleTranscriptJson(
				'{"text":"turn off the kitchen lights","language":"en","ttft_ms":11.1,"decode_tps":1319}'
			)
		).toEqual({
			text: "turn off the kitchen lights",
			language: "en",
			ttft_ms: 11.1,
			decode_tps: 1319,
		});
	});

	it("treats silence as an empty transcript, not an error", () => {
		expect(
			parseWhistleTranscriptJson(
				'{"text":"","language":"","ttft_ms":0,"decode_tps":0}'
			)
		).toEqual({
			text: "",
			language: "",
			ttft_ms: 0,
			decode_tps: 0,
		});
	});

	it("includes word timestamps when present", () => {
		const parsed = parseWhistleTranscriptJson(
			JSON.stringify({
				text: "bedroom",
				language: "en",
				ttft_ms: 1,
				decode_tps: 100,
				words: [
					{
						word: "bedroom",
						start: 0.48,
						end: 0.8,
						probability: 0.997,
					},
				],
			})
		);
		expect(parsed.words).toEqual([
			{
				word: "bedroom",
				start: 0.48,
				end: 0.8,
				probability: 0.997,
			},
		]);
	});

	it("throws on invalid JSON", () => {
		expect(() => parseWhistleTranscriptJson("not-json")).toThrow();
	});
});

describe("joinTranscripts", () => {
	it("joins non-empty window transcripts with a space", () => {
		expect(joinTranscripts(["hello", "world"])).toBe("hello world");
	});

	it("drops empty silence windows", () => {
		expect(joinTranscripts(["hello", "", "  ", "there"])).toBe(
			"hello there"
		);
	});
});
