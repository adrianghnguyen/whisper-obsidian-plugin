import { describe, it, expect, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../src/SettingsManager";
import { WHISTLE_MODULE, WhistleTranscriber } from "../src/transcribers/WhistleTranscriber";
import type { WhistleEngine } from "../src/transcribers/whistle/engine";
import { WHISTLE_SAMPLE_RATE } from "../src/transcribers/whistle/options";

function pluginWith(overrides: Record<string, unknown> = {}) {
	return {
		settings: { ...DEFAULT_SETTINGS, ...overrides },
		app: {
			workspace: { getActiveViewOfType: () => null },
		},
	} as never;
}

function pcmBlob(): Blob {
	return new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/webm" });
}

describe("WHISTLE_MODULE", () => {
	it("registers as an on-device batch provider", () => {
		expect(WHISTLE_MODULE).toMatchObject({
			id: "whistle",
			label: "Whistle (On-device)",
			statusBarLabel: "Whistle",
			isLive: false,
			order: 3,
			supportsPauseTolerance: false,
		});
	});
});

describe("WhistleTranscriber", () => {
	it("does not require an API key", async () => {
		const transcribe = vi.fn(() => ({
			text: "hello from whistle",
			language: "en",
			ttft_ms: 5,
			decode_tps: 200,
		}));
		const engine: WhistleEngine = { transcribe };
		const transcriber = new WhistleTranscriber({
			loadEngine: async () => engine,
			decodeAudio: async () => ({
				channelData: [new Float32Array([0.1, 0.2])],
				sampleRate: WHISTLE_SAMPLE_RATE,
			}),
		});

		const result = await transcriber.transcribe(
			pluginWith({ geminiApiKey: "", apiKey: "" }),
			pcmBlob(),
			"clip.webm",
			"clip"
		);

		expect(result.text).toBe("hello from whistle");
		expect(transcribe).toHaveBeenCalledTimes(1);
	});

	it("passes 16 kHz mono PCM plus language and keywords to the engine", async () => {
		const transcribe = vi.fn((_pcm: Float32Array, options?: unknown) => ({
			text: "kitchen",
			language: "en",
			ttft_ms: 1,
			decode_tps: 1,
		}));
		const samples = new Float32Array([0.5, -0.5, 0.25]);
		const transcriber = new WhistleTranscriber({
			loadEngine: async () => ({ transcribe }),
			decodeAudio: async () => ({
				channelData: [samples],
				sampleRate: WHISTLE_SAMPLE_RATE,
			}),
		});

		await transcriber.transcribe(
			pluginWith({
				whistleLanguage: "en-US",
				whistleKeywords: "kitchen, living room",
				whistleWordTimestamps: true,
			}),
			pcmBlob(),
			"clip.webm",
			"clip"
		);

		expect(transcribe).toHaveBeenCalledTimes(1);
		const [pcm, options] = transcribe.mock.calls[0];
		expect(Array.from(pcm)).toEqual([0.5, -0.5, 0.25]);
		expect(options).toEqual({
			language: "en",
			keywords: "kitchen\nliving room",
			wordTimestamps: true,
		});
	});

	it("returns an empty string for silence instead of throwing", async () => {
		const transcriber = new WhistleTranscriber({
			loadEngine: async () => ({
				transcribe: () => ({
					text: "",
					language: "",
					ttft_ms: 0,
					decode_tps: 0,
				}),
			}),
			decodeAudio: async () => ({
				channelData: [new Float32Array(1600)],
				sampleRate: WHISTLE_SAMPLE_RATE,
			}),
		});

		const result = await transcriber.transcribe(
			pluginWith(),
			pcmBlob(),
			"silence.webm",
			"silence"
		);
		expect(result).toEqual({ text: "" });
	});

	it("surfaces a decode failure as a transcription error", async () => {
		const transcriber = new WhistleTranscriber({
			loadEngine: async () => ({
				transcribe: () => ({
					text: "nope",
					language: "en",
					ttft_ms: 0,
					decode_tps: 0,
				}),
			}),
			decodeAudio: async () => {
				throw new Error("Unsupported audio type");
			},
		});

		await expect(
			transcriber.transcribe(pluginWith(), pcmBlob(), "clip.webm", "clip")
		).rejects.toThrow(/Unsupported audio type/);
	});

	it("wraps engine failures with a readable message", async () => {
		const transcriber = new WhistleTranscriber({
			loadEngine: async () => ({
				transcribe: () => {
					throw new Error("needle_transcribe failed");
				},
			}),
			decodeAudio: async () => ({
				channelData: [new Float32Array([0])],
				sampleRate: WHISTLE_SAMPLE_RATE,
			}),
		});

		await expect(
			transcriber.transcribe(pluginWith(), pcmBlob(), "clip.webm", "clip")
		).rejects.toThrow(/Whistle/);
	});

	it("loads the engine before decoding audio", async () => {
		const order: string[] = [];
		const transcriber = new WhistleTranscriber({
			loadEngine: async () => {
				order.push("load");
				return {
					transcribe: () => {
						order.push("transcribe");
						return {
							text: "ready",
							language: "en",
							ttft_ms: 1,
							decode_tps: 1,
						};
					},
				};
			},
			decodeAudio: async () => {
				order.push("decode");
				return {
					channelData: [new Float32Array([0.1])],
					sampleRate: WHISTLE_SAMPLE_RATE,
				};
			},
		});

		await transcriber.transcribe(
			pluginWith(),
			pcmBlob(),
			"clip.webm",
			"clip"
		);
		expect(order).toEqual(["load", "decode", "transcribe"]);
	});
});
