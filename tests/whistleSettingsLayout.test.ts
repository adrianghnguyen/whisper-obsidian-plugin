import { describe, it, expect } from "vitest";
import { getWhisperSettingsLayout } from "../src/transcribers/whistle/settingsLayout";

describe("getWhisperSettingsLayout", () => {
	it("shows OpenAI key and transcription fields for openai", () => {
		expect(getWhisperSettingsLayout("openai")).toEqual({
			showWhisperApiKey: true,
			showGeminiApiKey: false,
			showOpenAiTranscriptionSettings: true,
			showWhistleTranscriptionSettings: false,
			showWhistleWordTimestamps: false,
			showPostProcessing: true,
			showGeminiApiConfig: false,
			showGeminiLiveConfig: false,
			showWhistleLiveConfig: false,
		});
	});

	it("shows only the Gemini key and batch config for gemini", () => {
		expect(getWhisperSettingsLayout("gemini")).toEqual({
			showWhisperApiKey: false,
			showGeminiApiKey: true,
			showOpenAiTranscriptionSettings: false,
			showWhistleTranscriptionSettings: false,
			showWhistleWordTimestamps: false,
			showPostProcessing: false,
			showGeminiApiConfig: true,
			showGeminiLiveConfig: false,
			showWhistleLiveConfig: false,
		});
	});

	it("shows Gemini Live config without post-processing", () => {
		expect(getWhisperSettingsLayout("gemini-live")).toEqual({
			showWhisperApiKey: false,
			showGeminiApiKey: true,
			showOpenAiTranscriptionSettings: false,
			showWhistleTranscriptionSettings: false,
			showWhistleWordTimestamps: false,
			showPostProcessing: false,
			showGeminiApiConfig: false,
			showGeminiLiveConfig: true,
			showWhistleLiveConfig: false,
		});
	});

	it("hides cloud keys and OpenAI fields for on-device Whistle", () => {
		expect(getWhisperSettingsLayout("whistle")).toEqual({
			showWhisperApiKey: false,
			showGeminiApiKey: false,
			showOpenAiTranscriptionSettings: false,
			showWhistleTranscriptionSettings: true,
			showWhistleWordTimestamps: true,
			showPostProcessing: true,
			showGeminiApiConfig: false,
			showGeminiLiveConfig: false,
			showWhistleLiveConfig: false,
		});
	});

	it("shows Whistle language plus live editor settings for Whistle Live", () => {
		expect(getWhisperSettingsLayout("whistle-live")).toEqual({
			showWhisperApiKey: false,
			showGeminiApiKey: false,
			showOpenAiTranscriptionSettings: false,
			showWhistleTranscriptionSettings: true,
			showWhistleWordTimestamps: false,
			showPostProcessing: false,
			showGeminiApiConfig: false,
			showGeminiLiveConfig: false,
			showWhistleLiveConfig: true,
		});
	});
});
