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
import type { TranscriptionModuleDescriptor } from "./TranscriptionModule";

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

/**
 * Optional recovery hook. Implemented by StreamingEditor: after an audio
 * interruption (dropped chunk / disconnect) it lets the editor keep the
 * locked segment as the active transcript prefix so the resumed voice pass
 * is treated as a continuation of the same utterance, not a split.
 */
export interface LiveSessionRecovery {
	recoverInterim(): void;
}

export interface LiveSessionDeps {
	createSocket?: (url: string) => LiveSocket;
	recorder?: LiveAudioSource;
	editor?: LiveTranscriptSink;
	flushDelayMs?: number;
}

export const GEMINI_LIVE_MODULE: TranscriptionModuleDescriptor = {
	id: "gemini-live",
	label: "Gemini Live (Streaming)",
	statusBarLabel: "Gemini Live",
	isLive: true,
	order: 2,
};

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
	private recovering = false;
	private pendingChunks: string[] = [];
	private recoveryFailures = 0;
	private lastFailoverAt = 0;
	private static readonly MAX_PENDING_CHUNKS = 240;

	constructor(plugin: Whisper, deps: LiveSessionDeps = {}) {
		this.plugin = plugin;
		this.recorder = deps.recorder ?? new StreamingRecorder();
		this.editor =
			deps.editor ??
			new StreamingEditor(
				plugin.app,
				() => ({
					enabled: plugin.settings.liveInterimHighlight,
					color: plugin.settings.liveInterimHighlightColor,
				}),
				() => plugin.settings.geminiLivePauseDelay
			);
		this.createSocket =
			deps.createSocket ?? ((url) => new WebSocket(url) as LiveSocket);
		this.flushDelayMs = deps.flushDelayMs ?? 1000;
	}

	get isActive(): boolean {
		return this.streamActive;
	}

	setDeviceId(deviceId: string | null): void {
		this.recorder.setDeviceId(deviceId);
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
				if (this.streamActive && !this.recovering) {
					this.setupComplete = false;
					void this.failoverChunk(this.pendingChunks[0] ?? "");
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
			this.queueChunk(base64Pcm);
			const wait = this.recoveryBackoffRemaining();
			const gap = Date.now() - this.lastFailoverAt;
			if (
				!this.recovering &&
				wait === 0 &&
				gap >= GeminiLiveTranscriber.MIN_FAILOVER_GAP_MS
			) {
				void this.failoverChunk(base64Pcm);
			}
			return;
		}
		try {
			this.socket.send(JSON.stringify(realtimeAudioMessage(base64Pcm)));
			this.recoveryFailures = 0;
		} catch (err) {
			this.queueChunk(base64Pcm);
			if (!this.recovering) {
				void this.failoverChunk(base64Pcm, err);
			}
		}
	}

	private queueChunk(base64Pcm: string): void {
		this.pendingChunks.push(base64Pcm);
		if (this.pendingChunks.length > GeminiLiveTranscriber.MAX_PENDING_CHUNKS) {
			this.pendingChunks.shift();
		}
	}

	private static readonly RECOVERY_BASE_DELAY_MS = 500;
	private static readonly RECOVERY_MAX_DELAY_MS = 4000;
	private static readonly MIN_FAILOVER_GAP_MS = 800;

	/**
	 * Recover after audio was dropped (send failure, socket not ready, or
	 * mid-session close). Reconnects while the mic keeps running — chunks
	 * arriving during recovery are queued — then drains the queue into the
	 * new session. The queue survives failed attempts and retries with
	 * backoff on the next incoming chunk, so audio is only lost after a
	 * sustained outage exceeds the queue capacity. Also tells the editor to
	 * treat the next transcript as a continuation of the interrupted
	 * utterance.
	 */
	private async failoverChunk(
		base64Pcm: string,
		err?: unknown
	): Promise<void> {
		if (!this.streamActive || this.recovering) return;
		const now = Date.now();
		if (now - this.lastFailoverAt < GeminiLiveTranscriber.MIN_FAILOVER_GAP_MS) {
			this.queueChunk(base64Pcm);
			return;
		}
		this.recovering = true;
		this.lastFailoverAt = now;
		if (this.plugin.settings.debugMode) {
			console.warn(
				"[gemini-live] audio chunk dropped, reconnecting",
				err instanceof Error ? err.message : err ?? ""
			);
			new Notice("Live audio paused — reconnecting…");
		}
		this.editor.lockInterim();
		// The editor hook is a UX refinement only; a throw here must not
		// abort the audio recovery path.
		try {
			(
				this.editor as LiveTranscriptSink & Partial<LiveSessionRecovery>
			).recoverInterim?.();
		} catch (err) {
			console.warn("[gemini-live] editor recovery skipped", err);
		}
		try {
			await this.recoverSession();
			const queued = this.pendingChunks;
			this.pendingChunks = [];
			if (this.socket && this.socket.readyState === WS_OPEN) {
				this.recoveryFailures = 0;
				for (const chunk of queued) {
					this.socket.send(
						JSON.stringify(realtimeAudioMessage(chunk))
					);
				}
			} else {
				// Attempt failed: restore the queue so the next chunk retries
				// (with backoff) instead of silently discarding buffered audio.
				this.pendingChunks = queued.concat(this.pendingChunks);
				this.recoveryFailures = Math.min(
					this.recoveryFailures + 1,
					6
				);
			}
		} catch (err) {
			console.error("Live audio recovery failed:", err);
			this.recoveryFailures = Math.min(this.recoveryFailures + 1, 6);
			new Notice("✘ Live audio interrupted — could not reconnect");
		} finally {
			this.recovering = false;
		}
	}

	/** Backoff gate before the next recovery attempt is allowed. */
	private recoveryBackoffRemaining(): number {
		if (this.recoveryFailures === 0) return 0;
		return Math.min(
			GeminiLiveTranscriber.RECOVERY_BASE_DELAY_MS *
				2 ** (this.recoveryFailures - 1),
			GeminiLiveTranscriber.RECOVERY_MAX_DELAY_MS
		);
	}

	/**
	 * Serial recovery: only one attempt at a time, one attempt per socket
	 * failure so consecutive drops while down do not loop endlessly.
	 */
	private async recoverSession(): Promise<void> {
		this.cleanupSocket();
		try {
			await this.connectSocket();
		} catch (err) {
			if (this.plugin.settings.debugMode) {
				console.error("[gemini-live] reconnect failed", err);
			}
		}
	}

	private cleanupSocket(): void {
		if (this.socket) {
			const dead = this.socket;
			this.socket = null;
			try {
				dead.onclose = null;
				dead.onerror = null;
				dead.onmessage = null;
				dead.close();
			} catch {
				// ignore
			}
		}
	}

	private cleanup(): void {
		this.setupComplete = false;
		this.cleanupSocket();
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
