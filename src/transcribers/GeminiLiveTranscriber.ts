import { Notice } from "obsidian";
import Whisper from "main";
import { StreamingRecorder } from "./StreamingRecorder";
import { StreamingEditor } from "./StreamingEditor";

const LIVE_WS_URL =
	"wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

/**
 * GeminiLiveTranscriber
 *
 * Real-time streaming transcription via the Gemini Live API (WebSockets).
 * Uses `gemini-3.5-transcribe-live` and streams raw 16kHz PCM chunks,
 * receiving interim (partial) and final transcriptions that stream
 * directly into the active editor.
 */
export class GeminiLiveTranscriber {
	private plugin: Whisper;
	private socket: WebSocket | null = null;
	private recorder: StreamingRecorder;
	private editor: StreamingEditor;
	private streamActive = false;

	constructor(plugin: Whisper) {
		this.plugin = plugin;
		this.recorder = new StreamingRecorder();
		this.editor = new StreamingEditor(plugin.app);
	}

	get isActive(): boolean {
		return this.streamActive;
	}

	async startStream(): Promise<void> {
		if (this.streamActive) return;

		if (!this.plugin.settings.geminiApiKey) {
			new Notice("✘ Add your Gemini API key in settings");
			return;
		}

		try {
			await this.connectSocket();

			// Start streaming audio chunks over the socket
			await this.recorder.start((pcmChunk) => {
				this.sendChunk(pcmChunk);
			});

			this.streamActive = true;
			if (this.plugin.settings.debugMode) {
				new Notice("Live streaming started");
			}
		} catch (err) {
			console.error("Failed to start live stream:", err);
			new Notice("✘ Could not start live transcription");
			this.cleanup();
		}
	}

	async stopStream(): Promise<void> {
		if (!this.streamActive) return;
		this.streamActive = false;

		this.recorder.stop();

		// Send the end-of-stream signal to the Live API
		this.socket?.send(
			JSON.stringify({
				realtimeInput: {
					mediaChunks: [{ data: "", mimeType: "" }],
				},
			})
		);
		// Signal end of realtime input
		this.socket?.send(
			JSON.stringify({
				realtimeInput: {
					mediaChunks: [],
				},
			})
		);

		// Give the server a moment to flush final transcriptions
		await new Promise((resolve) => setTimeout(resolve, 500));

		this.editor.reset();
		this.cleanup();
		if (this.plugin.settings.debugMode) {
			new Notice("Live streaming stopped");
		}
	}

	private async connectSocket(): Promise<void> {
		return new Promise((resolve, reject) => {
			const wsUrl = `${LIVE_WS_URL}?key=${encodeURIComponent(
				this.plugin.settings.geminiApiKey
			)}`;
			this.socket = new WebSocket(wsUrl);

			this.socket.onopen = () => {
				// Send the setup message
				this.socket?.send(
					JSON.stringify({
						setup: {
							model: `models/${this.plugin.settings.geminiLiveModel}`,
							generationConfig: {
								responseModalities: ["TEXT"],
							},
							inputAudioTranscription: {},
						},
					})
				);
				resolve();
			};

			this.socket.onerror = (err) => {
				console.error("WebSocket error:", err);
				reject(err);
			};

			this.socket.onmessage = (event) => {
				this.handleMessage(event.data);
			};

			this.socket.onclose = () => {
				this.streamActive = false;
				this.cleanup();
			};
		});
	}

	private sendChunk(base64Pcm: string): void {
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
			return;
		}
		this.socket.send(
			JSON.stringify({
				realtimeInput: {
					mediaChunks: [
						{
							mimeType: "audio/pcm;rate=16000",
							data: base64Pcm,
						},
					],
				},
			})
		);
	}

	private handleMessage(data: any): void {
		let msg: any;
		try {
			msg = JSON.parse(data);
		} catch {
			return;
		}

		const serverContent = msg?.serverContent;
		if (!serverContent) return;

		// Interim transcriptions (partial hypotheses)
		if (serverContent.interimTranscription?.text) {
			const text = serverContent.interimTranscription.text;
			if (this.plugin.settings.debugMode) {
				console.log("[interim]", text);
			}
			this.editor.updateInterim(text);
		}

		// Finalized transcriptions
		if (serverContent.inputTranscription?.text) {
			const text = serverContent.inputTranscription.text;
			if (this.plugin.settings.debugMode) {
				console.log("[final]", text);
			}
			this.editor.commitFinal(text);
		}
	}

	private cleanup(): void {
		if (this.socket) {
			try {
				this.socket.close();
			} catch {
				// ignore
			}
			this.socket = null;
		}
		this.editor.reset();
		this.streamActive = false;
	}

	dispose(): void {
		this.cleanup();
	}
}