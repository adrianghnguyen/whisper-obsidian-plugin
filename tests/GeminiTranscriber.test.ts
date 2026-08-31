import { describe, it, expect } from "vitest";
import { buildGeminiInteractionPayload } from "../src/transcribers/GeminiTranscriber";

describe("buildGeminiInteractionPayload", () => {
	it("sends audio-only input with smart transcription config", () => {
		const payload = buildGeminiInteractionPayload(
			{
				geminiModel: "gemini-3.5-transcribe-preview",
				geminiTranscriptionMode: "smart",
				geminiLanguageCodes: "",
				geminiCustomVocabulary: "",
				geminiDiarization: false,
				geminiWordTimestamps: false,
			},
			"abc123",
			"audio/webm"
		);

		expect(payload).toEqual({
			model: "gemini-3.5-transcribe-preview",
			input: [
				{
					type: "audio",
					data: "abc123",
					mime_type: "audio/webm",
				},
			],
			generation_config: {
				transcription_config: {
					mode: { type: "smart" },
				},
			},
		});
	});

	it("includes vocabulary and language hints from settings", () => {
		const payload = buildGeminiInteractionPayload(
			{
				geminiModel: "gemini-3.5-transcribe-preview",
				geminiTranscriptionMode: "smart",
				geminiLanguageCodes: "en",
				geminiCustomVocabulary: "ZyntriQix, Digique Plus",
				geminiDiarization: false,
				geminiWordTimestamps: false,
			},
			"audio",
			"audio/wav"
		);

		expect(payload.generation_config.transcription_config).toEqual({
			mode: { type: "smart" },
			custom_vocabulary: ["ZyntriQix", "Digique Plus"],
			language_codes: ["en"],
		});
	});

	it("adds verbatim-only diarization and timestamps", () => {
		const payload = buildGeminiInteractionPayload(
			{
				geminiModel: "gemini-3.5-transcribe-preview",
				geminiTranscriptionMode: "verbatim",
				geminiLanguageCodes: "",
				geminiCustomVocabulary: "",
				geminiDiarization: true,
				geminiWordTimestamps: true,
			},
			"audio",
			"audio/wav"
		);

		expect(payload.generation_config.transcription_config.mode).toEqual({
			type: "verbatim",
			diarization_mode: "speaker",
			timestamp_granularities: ["word"],
		});
	});
});
