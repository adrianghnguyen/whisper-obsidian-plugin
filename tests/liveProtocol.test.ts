import { describe, it, expect } from "vitest";
import {
	audioStreamEndMessage,
	decodeWsData,
	floatToPcm16Base64,
	parseLiveMessage,
	realtimeAudioMessage,
	resampleTo16k,
	setupMessage,
} from "../src/transcribers/liveProtocol";

describe("setupMessage", () => {
	it("prefixes models/ and enables smart transcription", () => {
		expect(setupMessage("gemini-3.5-transcribe-live")).toEqual({
			setup: {
				model: "models/gemini-3.5-transcribe-live",
				generationConfig: { responseModalities: ["TEXT"] },
				inputAudioTranscription: { mode: "smart" },
			},
		});
	});

	it("omits realtimeInputConfig when vadTolerance is unset or default", () => {
		expect(
			(setupMessage("gemini-3.5-transcribe-live") as any).setup
				.realtimeInputConfig
		).toBeUndefined();
		expect(
			(
				setupMessage("gemini-3.5-transcribe-live", {
					vadTolerance: "default",
				}) as any
			).setup.realtimeInputConfig
		).toBeUndefined();
	});

	it("maps medium tolerance to conservative end-of-speech VAD", () => {
		const msg = setupMessage("gemini-3.5-transcribe-live", {
			vadTolerance: "medium",
		});
		expect((msg.setup as any).realtimeInputConfig).toEqual({
			automaticActivityDetection: {
				disabled: false,
				endOfSpeechSensitivity: "END_SENSITIVITY_LOW",
				startOfSpeechSensitivity: "START_SENSITIVITY_HIGH",
				silenceDurationMs: 1500,
				prefixPaddingMs: 300,
			},
		});
	});

	it("maps high tolerance to a longer silence window", () => {
		const msg = setupMessage("gemini-3.5-transcribe-live", {
			vadTolerance: "high",
		});
		expect((msg.setup as any).realtimeInputConfig).toEqual({
			automaticActivityDetection: {
				disabled: false,
				endOfSpeechSensitivity: "END_SENSITIVITY_LOW",
				startOfSpeechSensitivity: "START_SENSITIVITY_HIGH",
				silenceDurationMs: 2500,
				prefixPaddingMs: 500,
			},
		});
	});

	it("adds language codes when provided", () => {
		const msg = setupMessage("models/gemini-3.5-transcribe-live", {
			languageCodes: ["en"],
		});
		expect((msg.setup as any).model).toBe(
			"models/gemini-3.5-transcribe-live"
		);
		expect((msg.setup as any).inputAudioTranscription.languageCodes).toEqual(
			["en"]
		);
	});

	it("adds systemInstruction, mode, and customVocabulary when provided", () => {
		const msg = setupMessage("gemini-3.5-transcribe-live", {
			languageCodes: ["en"],
			transcriptionMode: "verbatim",
			customVocabulary: ["ZyntriQix", "Digique Plus"],
			systemPrompt: "Translate speech to French.",
		});
		expect((msg.setup as any).systemInstruction).toEqual({
			parts: [{ text: "Translate speech to French." }],
		});
		expect((msg.setup as any).inputAudioTranscription).toEqual({
			mode: "verbatim",
			languageCodes: ["en"],
			customVocabulary: ["ZyntriQix", "Digique Plus"],
		});
	});
});

describe("realtime audio messages", () => {
	it("sends PCM on audio, not deprecated mediaChunks", () => {
		const msg = realtimeAudioMessage("abc123") as any;
		expect(msg.realtimeInput.audio).toEqual({
			mimeType: "audio/pcm;rate=16000",
			data: "abc123",
		});
		expect(msg.realtimeInput.mediaChunks).toBeUndefined();
	});

	it("ends the stream with audioStreamEnd", () => {
		expect(audioStreamEndMessage()).toEqual({
			realtimeInput: { audioStreamEnd: true },
		});
	});
});

describe("parseLiveMessage", () => {
	it("reads setupComplete", () => {
		expect(parseLiveMessage({ setupComplete: {} })).toEqual({
			setupComplete: true,
		});
	});

	it("reads nested interim and final transcriptions", () => {
		expect(
			parseLiveMessage({
				serverContent: {
					interimInputTranscription: { text: "hel" },
					inputTranscription: { text: "hello" },
				},
			})
		).toEqual({
			interimText: "hel",
			finalText: "hello",
		});
	});

	it("reads top-level transcription fields", () => {
		expect(
			parseLiveMessage({
				inputTranscription: { text: "done" },
			})
		).toEqual({ finalText: "done" });
	});

	it("reads API errors", () => {
		expect(
			parseLiveMessage({
				error: { code: 400, message: "invalid argument" },
			})
		).toEqual({ errorMessage: "invalid argument" });
	});

	it("ignores empty or non-objects", () => {
		expect(parseLiveMessage(null)).toEqual({});
		expect(parseLiveMessage("nope")).toEqual({});
	});
});

describe("decodeWsData", () => {
	it("passes strings through", async () => {
		expect(await decodeWsData('{"setupComplete":{}}')).toBe(
			'{"setupComplete":{}}'
		);
	});

	it("decodes ArrayBuffer JSON", async () => {
		const bytes = new TextEncoder().encode('{"a":1}');
		expect(await decodeWsData(bytes.buffer)).toBe('{"a":1}');
	});

	it("decodes Blob JSON so binary WS frames are not dropped", async () => {
		const blob = new Blob(['{"setupComplete":{}}'], {
			type: "application/json",
		});
		expect(await decodeWsData(blob)).toBe('{"setupComplete":{}}');
	});
});

describe("resampleTo16k", () => {
	it("returns the same buffer at 16 kHz", () => {
		const input = new Float32Array([0.1, 0.2, 0.3]);
		expect(resampleTo16k(input, 16000)).toBe(input);
	});

	it("downsamples 48 kHz to 16 kHz", () => {
		const input = new Float32Array(480);
		for (let i = 0; i < input.length; i++) {
			input[i] = 0.5;
		}
		const out = resampleTo16k(input, 48000);
		expect(out.length).toBe(160);
		expect(out[0]).toBeCloseTo(0.5);
		expect(out[out.length - 1]).toBeCloseTo(0.5);
	});
});

describe("floatToPcm16Base64", () => {
	it("encodes silence as zeros", () => {
		const encoded = floatToPcm16Base64(new Float32Array(4));
		const bytes = Buffer.from(encoded, "base64");
		expect(bytes.length).toBe(8);
		expect([...bytes].every((b) => b === 0)).toBe(true);
	});
});
