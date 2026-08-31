import { Notice } from "obsidian";
import Whisper from "main";
import { StreamingRecorder } from "./StreamingRecorder";
import { StreamingEditor } from "./StreamingEditor";
import {
	LIVE_WS_URL,
	audioStreamEndMessage,
	decodeWsData,
	parseLiveMessage,
	realtimeAudioMessage,
	setupMessage,
} from "./liveProtocol";
import {
	parseCommaOrLineList,
	parseLanguageCodes,
} from "./geminiPrompt";

const SETUP_TIMEOUT_MS = 10000;
const WS_OPEN = 1;

export interface LiveSocket {
	readyState: number;
	send(data: string): void;
	close(): void;
	onopen: ((ev?: unknown) => void) | null;
	onmessage: ((ev: { data: unknown }) => void) | null;
	onerror: ((ev?: unknown) => void) | null;
	onclose: ((ev: { reason?: string }) => void) | null;
}

export interface LiveAudioSource {
	setDeviceId(deviceId: string | null): void;
	start(
		onChunk: (base64Pcm: string) => void,
		onStop?: () => void
	): Promise<void>;
	stop(): void;
}

export interface LiveTranscriptSink {
	updateInterim(text: string): void;
	commitFinal(text: string): void;
	lockInterim(): void;
	reset(): void;
}

export interface LiveSessionDeps {
	createSocket?: (url: string) => LiveSocket;
	recorder?: LiveAudioSource;
	editor?: LiveTranscriptSink;
	flushDelayMs?: number;
}

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
	private socket: LiveSocket | null = null;
	private recorder: LiveAudioSource;
	private editor: LiveTranscriptSink;
	private createSocket: (url: string) => LiveSocket;
	private flushDelayMs: number;
	private streamActive = false;
	private setupComplete = false;

	constructor(plugin: Whisper, deps: LiveSessionDeps = {}) {
		this.plugin = plugin;
		this.recorder = deps.recorder ?? new StreamingRecorder();
		this.editor =
			deps.editor ??
			new StreamingEditor(plugin.app, () => ({
				enabled: plugin.settings.liveInterimHighlight,
				color: plugin.settings.liveInterimHighlightColor,
			}));
		this.createSocket =
			deps.createSocket ?? ((url) => new WebSocket(url) as LiveSocket);
		this.flushDelayMs = deps.flushDelayMs ?? 1000;
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

		const deviceId =
			this.plugin.settings.audioDeviceId === "default"
				? null
				: this.plugin.settings.audioDeviceId;
		this.recorder.setDeviceId(deviceId);

		try {
			await this.connectSocket();

			await this.recorder.start((pcmChunk) => {
				this.sendChunk(pcmChunk);
			});

			this.streamActive = true;
			if (this.plugin.settings.debugMode) {
				new Notice("Live streaming started");
			}
		} catch (err) {
			console.error("Failed to start live stream:", err);
			const detail = err instanceof Error ? err.message : String(err);
			new Notice("✘ Could not start live transcription: " + detail);
			this.cleanup();
		}
	}

	async stopStream(): Promise<void> {
		if (!this.streamActive && !this.socket) return;
		this.streamActive = false;

		this.recorder.stop();

		if (this.socket && this.socket.readyState === WS_OPEN) {
			this.socket.send(JSON.stringify(audioStreamEndMessage()));
			if (this.flushDelayMs > 0) {
				await new Promise((resolve) =>
					setTimeout(resolve, this.flushDelayMs)
				);
			}
		}

		this.editor.lockInterim();
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
			this.socket = this.createSocket(wsUrl);
			this.setupComplete = false;
			let settled = false;

			const finish = (err?: Error) => {
				if (settled) return;
				settled = true;
				clearTimeout(timeout);
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			};

			const timeout = setTimeout(() => {
				finish(new Error("Live API setup timed out"));
			}, SETUP_TIMEOUT_MS);

			this.socket.onopen = () => {
				this.socket?.send(
					JSON.stringify(
						setupMessage(this.plugin.settings.geminiLiveModel, {
							languageCodes: parseLanguageCodes(
								this.plugin.settings.geminiLiveLanguageCodes
							),
							transcriptionMode:
								this.plugin.settings.geminiLiveTranscriptionMode,
							customVocabulary: parseCommaOrLineList(
								this.plugin.settings.geminiLiveCustomVocabulary
							),
							systemPrompt:
								this.plugin.settings.geminiLiveSystemPrompt,
						})
					)
				);
			};

			this.socket.onerror = () => {
				finish(new Error("WebSocket connection failed"));
			};

			this.socket.onmessage = (event) => {
				void this.onSocketMessage(event.data, finish);
			};

			this.socket.onclose = (ev) => {
				if (!settled) {
					finish(
						new Error(
							ev.reason || "Live API connection closed during setup"
						)
					);
					return;
				}
				if (this.streamActive) {
					new Notice("✘ Live transcription disconnected");
					this.streamActive = false;
					this.recorder.stop();
					this.socket = null;
				}
			};
		});
	}

	private async onSocketMessage(
		data: unknown,
		finish: (err?: Error) => void
	): Promise<void> {
		let text: string;
		try {
			text = await decodeWsData(data);
		} catch {
			return;
		}

		let msg: unknown;
		try {
			msg = JSON.parse(text);
		} catch {
			return;
		}

		const parsed = parseLiveMessage(msg);

		if (this.plugin.settings.debugMode) {
			console.log("[gemini-live]", Object.keys(msg as object), parsed);
		}

		if (parsed.errorMessage) {
			console.error("Live API error:", parsed.errorMessage);
			new Notice("✘ Live API: " + parsed.errorMessage);
			if (!this.setupComplete) {
				finish(new Error(parsed.errorMessage));
			}
			return;
		}

		if (parsed.setupComplete) {
			this.setupComplete = true;
			finish();
		}

		if (parsed.interimText) {
			this.editor.updateInterim(parsed.interimText);
		}

		if (parsed.finalText) {
			this.editor.commitFinal(parsed.finalText);
		}
	}

	private sendChunk(base64Pcm: string): void {
		if (
			!this.setupComplete ||
			!this.socket ||
			this.socket.readyState !== WS_OPEN
		) {
			return;
		}
		this.socket.send(JSON.stringify(realtimeAudioMessage(base64Pcm)));
	}

	private cleanup(): void {
		this.setupComplete = false;
		if (this.socket) {
			try {
				this.socket.close();
			} catch {
				// ignore
			}
			this.socket = null;
		}
		try {
			this.recorder.stop();
		} catch {
			// ignore
		}
		this.editor.reset();
		this.streamActive = false;
	}

	dispose(): void {
		this.cleanup();
	}
}
