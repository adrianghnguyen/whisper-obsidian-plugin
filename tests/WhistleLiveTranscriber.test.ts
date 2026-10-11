import { describe, it, expect, vi, beforeEach } from "vitest";
import Whisper from "main";
import { DEFAULT_SETTINGS } from "../src/SettingsManager";
import {
	LiveAudioSource,
	LiveTranscriptSink,
} from "../src/transcribers/GeminiLiveTranscriber";
import { floatToPcm16Base64 } from "../src/transcribers/liveProtocol";
import {
	WHISTLE_LIVE_MODULE,
	WhistleLiveTranscriber,
} from "../src/transcribers/WhistleLiveTranscriber";
import type { WhistleEngine } from "../src/transcribers/whistle/engine";
import type { WhistleStreamResult } from "../src/transcribers/whistle/options";
import { WHISTLE_STREAM_CHUNK_SAMPLES } from "../src/transcribers/whistle/options";

class FakeRecorder implements LiveAudioSource {
	deviceId: string | null = null;
	started = false;
	private onChunk: ((base64Pcm: string) => void) | null = null;

	setDeviceId(deviceId: string | null): void {
		this.deviceId = deviceId;
	}

	async start(onChunk: (base64Pcm: string) => void): Promise<void> {
		this.started = true;
		this.onChunk = onChunk;
	}

	stop(): void {
		this.started = false;
	}

	emit(chunk: string): void {
		this.onChunk?.(chunk);
	}
}

class FakeEditor implements LiveTranscriptSink {
	interims: string[] = [];
	finals: string[] = [];
	locked = 0;
	resets = 0;

	updateInterim(text: string): void {
		this.interims.push(text);
	}

	commitFinal(text: string): void {
		this.finals.push(text);
	}

	lockInterim(): void {
		this.locked += 1;
	}

	reset(): void {
		this.resets += 1;
	}
}

function pcmChunk(samples: number, fill = 0.1): string {
	return floatToPcm16Base64(new Float32Array(samples).fill(fill));
}

function streamResult(
	overrides: Partial<WhistleStreamResult> = {}
): WhistleStreamResult {
	return {
		text: "",
		pending: "",
		language: "en",
		received: 1,
		pass_ms: 10,
		...overrides,
	};
}

function makePlugin(): Whisper {
	return {
		settings: {
			...DEFAULT_SETTINGS,
			apiKey: "",
			geminiApiKey: "",
			audioDeviceId: "mic-whistle",
			whistleLanguage: "de",
			whistleKeywords: "Obsidian, vault",
			debugMode: false,
		},
		app: {},
	} as unknown as Whisper;
}

describe("WHISTLE_LIVE_MODULE", () => {
	it("registers as an on-device live provider without pause tolerance", () => {
		expect(WHISTLE_LIVE_MODULE).toMatchObject({
			id: "whistle-live",
			label: "Whistle Live (On-device)",
			statusBarLabel: "Whistle Live",
			isLive: true,
			order: 4,
			supportsPauseTolerance: false,
		});
	});
});

describe("WhistleLiveTranscriber session", () => {
	let recorder: FakeRecorder;
	let editor: FakeEditor;
	let streamProcess: ReturnType<typeof vi.fn>;
	let streamStop: ReturnType<typeof vi.fn>;
	let transcriber: WhistleLiveTranscriber;

	beforeEach(() => {
		recorder = new FakeRecorder();
		editor = new FakeEditor();
		streamProcess = vi.fn((_pcm: Float32Array) => streamResult());
		streamStop = vi.fn(() => streamResult({ received: 0, pass_ms: 1 }));
		const engine: WhistleEngine = {
			transcribe: () => ({
				text: "",
				language: "",
				ttft_ms: 0,
				decode_tps: 0,
			}),
			streamProcess,
			streamStop,
		};
		transcriber = new WhistleLiveTranscriber(makePlugin(), {
			recorder,
			editor,
			loadEngine: async () => engine,
		});
	});

	it("starts without an API key and loads the engine before the mic", async () => {
		const order: string[] = [];
		const engine: WhistleEngine = {
			transcribe: () => ({
				text: "",
				language: "",
				ttft_ms: 0,
				decode_tps: 0,
			}),
			streamProcess,
			streamStop,
		};
		const live = new WhistleLiveTranscriber(makePlugin(), {
			recorder,
			editor,
			loadEngine: async () => {
				order.push("load");
				expect(recorder.started).toBe(false);
				return engine;
			},
		});

		await live.startStream();

		expect(order).toEqual(["load"]);
		expect(recorder.started).toBe(true);
		expect(live.isActive).toBe(true);
		expect(recorder.deviceId).toBe("mic-whistle");
	});

	it("does not call streamProcess until one second of PCM is buffered", async () => {
		await transcriber.startStream();
		recorder.emit(pcmChunk(WHISTLE_STREAM_CHUNK_SAMPLES - 1));
		await vi.waitFor(() => expect(recorder.started).toBe(true));
		expect(streamProcess).not.toHaveBeenCalled();
	});

	it("feeds 1 s windows with language and keywords", async () => {
		await transcriber.startStream();
		recorder.emit(pcmChunk(WHISTLE_STREAM_CHUNK_SAMPLES));
		await vi.waitFor(() => expect(streamProcess).toHaveBeenCalledTimes(1));

		const [pcm, options] = streamProcess.mock.calls[0];
		expect(pcm.length).toBe(WHISTLE_STREAM_CHUNK_SAMPLES);
		expect(options).toEqual({
			language: "de",
			keywords: "Obsidian\nvault",
			wordTimestamps: false,
		});
	});

	it("commits agreed words and shows pending as interim", async () => {
		streamProcess.mockReturnValue(
			streamResult({ text: "turn off", pending: "the kitchen" })
		);
		await transcriber.startStream();
		recorder.emit(pcmChunk(WHISTLE_STREAM_CHUNK_SAMPLES));
		await vi.waitFor(() => expect(editor.finals).toEqual(["turn off"]));
		expect(editor.interims).toEqual(["the kitchen"]);
	});

	it("does not write silence to the editor", async () => {
		streamProcess.mockReturnValue(streamResult({ text: "", pending: "" }));
		await transcriber.startStream();
		recorder.emit(pcmChunk(WHISTLE_STREAM_CHUNK_SAMPLES));
		await vi.waitFor(() => expect(streamProcess).toHaveBeenCalledTimes(1));
		expect(editor.finals).toEqual([]);
		expect(editor.interims).toEqual([]);
	});

	it("flushes the remainder then stops the stream on stopStream", async () => {
		streamProcess
			.mockReturnValueOnce(streamResult({ text: "hello", pending: "" }))
			.mockReturnValueOnce(streamResult({ text: "there", pending: "friend" }));
		streamStop.mockReturnValue(
			streamResult({ text: "friend", pending: "", received: 1.2 })
		);

		await transcriber.startStream();
		recorder.emit(pcmChunk(WHISTLE_STREAM_CHUNK_SAMPLES));
		await vi.waitFor(() => expect(streamProcess).toHaveBeenCalledTimes(1));
		recorder.emit(pcmChunk(400));
		await transcriber.stopStream();

		expect(streamProcess).toHaveBeenCalledTimes(2);
		expect(streamProcess.mock.calls[1][0].length).toBe(400);
		expect(streamStop).toHaveBeenCalledTimes(1);
		expect(editor.finals).toEqual(["hello", "there", "friend"]);
		expect(editor.locked).toBe(1);
		expect(editor.resets).toBeGreaterThanOrEqual(1);
		expect(transcriber.isActive).toBe(false);
		expect(recorder.started).toBe(false);
	});

	it("surfaces an engine load failure and stays idle", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const live = new WhistleLiveTranscriber(makePlugin(), {
			recorder,
			editor,
			loadEngine: async () => {
				throw new Error("wasm explode");
			},
		});

		await live.startStream();

		expect(live.isActive).toBe(false);
		expect(recorder.started).toBe(false);
		errorSpy.mockRestore();
	});
});
