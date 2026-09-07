import { describe, it, expect } from "vitest";
import {
	TRANSCRIPTION_MODULES,
	getFirstEnabledProvider,
	getModuleById,
	getNextTranscriptionProvider,
	getTranscriptionProviderOptions,
	isProviderEnabled,
} from "../src/transcribers/registry";
import { OPENAI_MODULE } from "../src/transcribers/OpenAiTranscriber";
import { GEMINI_MODULE } from "../src/transcribers/GeminiTranscriber";
import { GEMINI_LIVE_MODULE } from "../src/transcribers/GeminiLiveTranscriber";

describe("transcriber registry", () => {
	it("lists modules in order", () => {
		expect(TRANSCRIPTION_MODULES.map((module) => module.id)).toEqual([
			"openai",
			"gemini",
			"gemini-live",
		]);
	});

	it("cycles providers in order and wraps", () => {
		expect(getNextTranscriptionProvider("openai")).toBe("gemini");
		expect(getNextTranscriptionProvider("gemini")).toBe("gemini-live");
		expect(getNextTranscriptionProvider("gemini-live")).toBe("openai");
	});

	it("looks up modules by id", () => {
		expect(getModuleById("openai")).toBe(OPENAI_MODULE);
		expect(getModuleById("gemini")).toBe(GEMINI_MODULE);
		expect(getModuleById("gemini-live")).toBe(GEMINI_LIVE_MODULE);
		expect(getModuleById("unknown" as "openai").id).toBe("openai");
	});

	it("builds provider options from module labels", () => {
		expect(getTranscriptionProviderOptions()).toEqual({
			openai: "OpenAI (Whisper)",
			gemini: "Gemini API",
			"gemini-live": "Gemini Live (Streaming)",
		});
	});

	it("treats missing disabled list as all enabled", () => {
		expect(isProviderEnabled({}, "openai")).toBe(true);
		expect(isProviderEnabled({ disabledTranscriptionProviders: [] }, "gemini")).toBe(
			true
		);
	});

	it("reports disabled providers", () => {
		const settings = {
			disabledTranscriptionProviders: ["gemini" as const],
		};
		expect(isProviderEnabled(settings, "openai")).toBe(true);
		expect(isProviderEnabled(settings, "gemini")).toBe(false);
	});

	it("filters dropdown options to enabled providers", () => {
		expect(
			getTranscriptionProviderOptions({
				disabledTranscriptionProviders: ["gemini-live"],
			})
		).toEqual({
			openai: "OpenAI (Whisper)",
			gemini: "Gemini API",
		});
	});

	it("cycles only among enabled providers", () => {
		const settings = {
			disabledTranscriptionProviders: ["gemini" as const],
		};
		expect(getNextTranscriptionProvider("openai", settings)).toBe(
			"gemini-live"
		);
		expect(getNextTranscriptionProvider("gemini-live", settings)).toBe(
			"openai"
		);
	});

	it("returns first enabled when current provider is disabled", () => {
		const settings = {
			disabledTranscriptionProviders: ["openai" as const],
		};
		expect(getNextTranscriptionProvider("openai", settings)).toBe("gemini");
		expect(getFirstEnabledProvider(settings)).toBe("gemini");
	});
});
