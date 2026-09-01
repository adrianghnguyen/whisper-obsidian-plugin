import { describe, it, expect, vi, beforeEach } from "vitest";
import Whisper from "main";
import {
	GeminiLiveTranscriber,
	LiveAudioSource,
	LiveSocket,
	LiveTranscriptSink,
} from "../src/transcribers/GeminiLiveTranscriber";
import { DEFAULT_SETTINGS } from "../src/SettingsManager";

class FakeSocket implements LiveSocket {
	readyState = 0;
	sent: string[] = [];
	onopen: LiveSocket["onopen"] = null;
	onmessage: LiveSocket["onmessage"] = null;
	onerror: LiveSocket["onerror"] = null;
	onclose: LiveSocket["onclose"] = null;

	send(data: string): void {
		this.sent.push(data);
	}

	close(): void {
		this.readyState = 3;
		this.onclose?.({ reason: "" });
	}

	open(): void {
		this.readyState = 1;
		this.onopen?.();
	}

	receive(data: unknown): void {
		this.onmessage?.({ data });
	}

	parsed(): any[] {
		return this.sent.map((s) => JSON.parse(s));
	}
}

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

	updateInterim(text: string): void {
		this.interims.push(text);
	}

	commitFinal(text: string): void {
		this.finals.push(text);
	}

	lockInterim(): void {}
	reset(): void {}
}

function makePlugin(): Whisper {
	return {
		settings: {
			...DEFAULT_SETTINGS,
			geminiApiKey: "test-key",
			geminiLiveModel: "gemini-3.5-transcribe-live",
			audioDeviceId: "mic-abc",
			language: "",
			debugMode: false,
		},
		app: {},
	} as unknown as Whisper;
}

describe("GeminiLiveTranscriber session", () => {
	let socket: FakeSocket;
	let recorder: FakeRecorder;
	let editor: FakeEditor;
	let transcriber: GeminiLiveTranscriber;

	beforeEach(() => {
		socket = new FakeSocket();
		recorder = new FakeRecorder();
		editor = new FakeEditor();
		transcriber = new GeminiLiveTranscriber(makePlugin(), {
			createSocket: () => socket,
			recorder,
			editor,
			flushDelayMs: 0,
		});
	});

	it("sends setup on open and does not start the mic until setupComplete", async () => {
		const start = transcriber.startStream();
		await vi.waitFor(() => expect(socket.onopen).toBeTruthy());
		socket.open();

		expect(recorder.started).toBe(false);
		expect(socket.parsed()[0].setup.model).toBe(
			"models/gemini-3.5-transcribe-live"
		);
		expect(
			socket.parsed().some((m) => m.realtimeInput)
		).toBe(false);

		socket.receive(JSON.stringify({ setupComplete: {} }));
		await start;

		expect(recorder.started).toBe(true);
		expect(transcriber.isActive).toBe(true);
		expect(recorder.deviceId).toBe("mic-abc");
	});

	it("sends VAD config from the pause tolerance setting", async () => {
		const plugin = makePlugin();
		plugin.settings.geminiLiveVadTolerance = "high";
		const live = new GeminiLiveTranscriber(plugin, {
			createSocket: () => socket,
			recorder,
			editor,
			flushDelayMs: 0,
		});
		const start = live.startStream();
		await vi.waitFor(() => expect(socket.onopen).toBeTruthy());
		socket.open();

		socket.receive(JSON.stringify({ setupComplete: {} }));
		await start;

		expect(
			socket.parsed()[0].setup.realtimeInputConfig
		).toEqual({
			automaticActivityDetection: {
				disabled: false,
				endOfSpeechSensitivity: "END_SENSITIVITY_LOW",
				startOfSpeechSensitivity: "START_SENSITIVITY_HIGH",
				silenceDurationMs: 2500,
				prefixPaddingMs: 500,
			},
		});
	});

	it("drops PCM until setupComplete, then sends audio not mediaChunks", async () => {
		const start = transcriber.startStream();
		await vi.waitFor(() => expect(socket.onopen).toBeTruthy());
		socket.open();

		recorder.emit("before-setup");
		expect(
			socket.parsed().some((m) => m.realtimeInput)
		).toBe(false);

		socket.receive(JSON.stringify({ setupComplete: {} }));
		await start;

		recorder.emit("dGVzdA==");
		const audioMsgs = socket
			.parsed()
			.filter((m) => m.realtimeInput);
		expect(audioMsgs).toHaveLength(1);
		expect(audioMsgs[0].realtimeInput.audio).toEqual({
			mimeType: "audio/pcm;rate=16000",
			data: "dGVzdA==",
		});
		expect(audioMsgs[0].realtimeInput.mediaChunks).toBeUndefined();
	});

	it("parses Blob server messages into the editor", async () => {
		const start = transcriber.startStream();
		await vi.waitFor(() => expect(socket.onopen).toBeTruthy());
		socket.open();
		socket.receive(
			new Blob([JSON.stringify({ setupComplete: {} })], {
				type: "application/json",
			})
		);
		await start;

		socket.receive(
			new Blob(
				[
					JSON.stringify({
						serverContent: {
							interimInputTranscription: { text: "hel" },
						},
					}),
				],
				{ type: "application/json" }
			)
		);
		await vi.waitFor(() => expect(editor.interims).toEqual(["hel"]));

		socket.receive(
			new Blob(
				[
					JSON.stringify({
						serverContent: {
							inputTranscription: { text: "hello" },
						},
					}),
				],
				{ type: "application/json" }
			)
		);
		await vi.waitFor(() => expect(editor.finals).toEqual(["hello"]));
	});

	it("ends the stream with audioStreamEnd", async () => {
		const start = transcriber.startStream();
		await vi.waitFor(() => expect(socket.onopen).toBeTruthy());
		socket.open();
		socket.receive(JSON.stringify({ setupComplete: {} }));
		await start;

		await transcriber.stopStream();
		const end = socket.parsed().find((m) => m.realtimeInput?.audioStreamEnd);
		expect(end).toEqual({ realtimeInput: { audioStreamEnd: true } });
		expect(transcriber.isActive).toBe(false);
	});

	it("does not go active when setup returns an error", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const start = transcriber.startStream();
		await vi.waitFor(() => expect(socket.onopen).toBeTruthy());
		socket.open();
		socket.receive(
			JSON.stringify({ error: { message: "invalid model" } })
		);
		await start;

		expect(transcriber.isActive).toBe(false);
		expect(recorder.started).toBe(false);
	});
});
