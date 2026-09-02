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

	it("sends standard setup configuration on start", async () => {
		const plugin = makePlugin();
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

		expect(socket.parsed()[0].setup.model).toBe(
			"models/gemini-3.5-transcribe-live"
		);
		expect(
			socket.parsed()[0].setup.inputAudioTranscription
		).toEqual({
			mode: "smart",
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
			.filter((m) => m.realtimeInput?.audio);
		expect(audioMsgs).toHaveLength(1);
		expect(audioMsgs[0].realtimeInput.audio).toEqual({
			mimeType: "audio/pcm;rate=16000",
			data: "dGVzdA==",
		});
		expect(
			socket.parsed().some((m) => m.realtimeInput?.activityStart)
		).toBe(false);
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
		const actEnd = socket.parsed().find((m) => m.realtimeInput?.activityEnd);
		expect(actEnd).toBeUndefined();
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

	it("retries a dropped chunk after a send failure and drains the buffered tail", async () => {
		// Flaky wire: the FIRST audio chunk send fails (the transient drop),
		// everything else succeeds.
		let threwOnce = false;
		vi.spyOn(socket, "send").mockImplementation((data: string) => {
			const parsed = JSON.parse(data);
			if (!threwOnce && parsed.realtimeInput?.audio) {
				threwOnce = true;
				throw new Error("WebSocket send failed");
			}
			socket.sent.push(data);
		});

		const start = transcriber.startStream();
		await vi.waitFor(() => expect(socket.onopen).toBeTruthy());
		socket.open();
		socket.receive(JSON.stringify({ setupComplete: {} }));
		await start;

		// Voice chunk 1 transcribed, then a mid-speech pause
		socket.receive(
			JSON.stringify({
				serverContent: { inputTranscription: { text: "first part" } },
			})
		);
		await vi.waitFor(() => expect(editor.finals).toEqual(["first part"]));

		// The next chunk hits the transient send failure; the transcriber
		// tears down the dead session and opens a fresh one.
		recorder.emit("ZGF0YQ==");
		await vi.waitFor(() => expect(socket.readyState).toBe(3));
		socket.open();
		socket.receive(JSON.stringify({ setupComplete: {} }));

		// The queued chunk is drained into the re-established session
		await vi.waitFor(() =>
			expect(
				socket.sent.some((s) => s.includes("ZGF0YQ=="))
			).toBe(true)
		);

		// Voice chunk 2 after the pause also reaches the wire, in order
		recorder.emit("bW9yZQ==");
		await vi.waitFor(() => {
			const datas = socket.sent
				.map((s) => JSON.parse(s))
				.filter((m) => m.realtimeInput?.audio)
				.map((m) => m.realtimeInput.audio.data as string);
			expect(datas).toEqual(["ZGF0YQ==", "bW9yZQ=="]);
		});
	});

	it("keeps streaming audio after a mid-speech socket close by reconnecting", async () => {
		const sockets: FakeSocket[] = [];
		const live = new GeminiLiveTranscriber(makePlugin(), {
			createSocket: () => {
				const s = new FakeSocket();
				sockets.push(s);
				return s;
			},
			recorder,
			editor,
			flushDelayMs: 0,
		});

		const start = live.startStream();
		await vi.waitFor(() => expect(sockets[0].onopen).toBeTruthy());
		sockets[0].open();
		sockets[0].receive(JSON.stringify({ setupComplete: {} }));
		await start;

		// Chunk 1 transcribed, then the connection drops mid-speech
		sockets[0].receive(
			JSON.stringify({
				serverContent: { inputTranscription: { text: "before drop" } },
			})
		);
		await vi.waitFor(() => expect(editor.finals).toEqual(["before drop"]));

		sockets[0].close();

		// Voice chunk 2 arrives after the drop: the stream must recover —
		// a fresh socket is created and opened automatically.
		recorder.emit("cGllY2Uy");
		await vi.waitFor(() => {
			expect(sockets.length).toBeGreaterThanOrEqual(2);
		});
		await vi.waitFor(() => expect(sockets[1].onopen).toBeTruthy());
		sockets[1].open();
		sockets[1].receive(JSON.stringify({ setupComplete: {} }));
		await vi.waitFor(() => {
			const audio = sockets[1]
				.parsed()
				.filter((m) => m.realtimeInput?.audio);
			expect(
				audio.some((m) => m.realtimeInput.audio.data === "cGllY2Uy")
			).toBe(true);
		});
		expect(editor.finals).toEqual(["before drop"]);
	});

	it("never sends manual activity signals across the session lifecycle", async () => {
		const start = transcriber.startStream();
		await vi.waitFor(() => expect(socket.onopen).toBeTruthy());
		socket.open();
		socket.receive(JSON.stringify({ setupComplete: {} }));
		await start;

		// Voice chunk 1, pause, voice chunk 2 (with a mid-session reconnect)
		recorder.emit("Y2h1bmsx");
		socket.close();
		recorder.emit("Y2h1bmsy");
		await vi.waitFor(() => expect(socket.readyState).toBe(3));
		socket.open();
		socket.receive(JSON.stringify({ setupComplete: {} }));
		await vi.waitFor(() => {
			const datas = socket.sent
				.map((s) => JSON.parse(s))
				.filter((m) => m.realtimeInput?.audio)
				.map((m) => m.realtimeInput.audio.data);
			expect(datas).toContain("Y2h1bmsy");
		});

		await transcriber.stopStream();

		// With server-side automatic VAD enabled, manual activityStart /
		// activityEnd are not part of the wire protocol for this model.
		const manualActivity = socket
			.parsed()
			.filter(
				(m) =>
					m.realtimeInput?.activityStart !== undefined ||
					m.realtimeInput?.activityEnd !== undefined
			);
		expect(manualActivity).toEqual([]);
	});
});
