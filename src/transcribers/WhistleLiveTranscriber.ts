import { Notice } from "obsidian";
import Whisper from "main";
import {
	LiveAudioSource,
	LiveTranscriptSink,
} from "./GeminiLiveTranscriber";
import { StreamingEditor } from "./StreamingEditor";
import { StreamingRecorder } from "./StreamingRecorder";
import type { TranscriptionModuleDescriptor } from "./TranscriptionModule";
import {
	concatFloat32,
	pcm16Base64ToFloat32,
	takeStreamChunks,
} from "./whistle/audio";
import {
	loadWhistleEngine,
	type WhistleEngine,
	type WhistleEngineProgress,
} from "./whistle/engine";
import {
	buildWhistleCallOptions,
	type WhistleCallOptions,
	type WhistleStreamResult,
} from "./whistle/options";
import { createVaultWhistleCache } from "./whistle/whistleCache";

const WHISTLE_LIVE_INTERIM_LOCK_MS = 60_000;

export const WHISTLE_LIVE_MODULE: TranscriptionModuleDescriptor = {
	id: "whistle-live",
	label: "Whistle Live (On-device)",
	statusBarLabel: "Whistle Live",
	isLive: true,
	order: 4,
	supportsPauseTolerance: false,
};

export interface WhistleLiveSessionDeps {
	recorder?: LiveAudioSource;
	editor?: LiveTranscriptSink;
	loadEngine?: (
		onProgress?: (event: WhistleEngineProgress) => void
	) => Promise<WhistleEngine>;
}

export class WhistleLiveTranscriber {
	private plugin: Whisper;
	private recorder: LiveAudioSource;
	private editor: LiveTranscriptSink;
	private loadEngine:
		| ((
				onProgress?: (event: WhistleEngineProgress) => void
		  ) => Promise<WhistleEngine>)
		| null;
	private engine: WhistleEngine | null = null;
	private streamActive = false;
	private buffer = new Float32Array(0);
	private drainQueue: Promise<void> = Promise.resolve();

	constructor(plugin: Whisper, deps: WhistleLiveSessionDeps = {}) {
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
				() => WHISTLE_LIVE_INTERIM_LOCK_MS
			);
		this.loadEngine = deps.loadEngine ?? null;
	}

	get isActive(): boolean {
		return this.streamActive;
	}

	setDeviceId(deviceId: string | null): void {
		this.recorder.setDeviceId(deviceId);
	}

	async startStream(): Promise<void> {
		if (this.streamActive) return;

		const deviceId =
			this.plugin.settings.audioDeviceId === "default"
				? null
				: this.plugin.settings.audioDeviceId;
		this.recorder.setDeviceId(deviceId);

		const download = { notice: null as Notice | null };
		try {
			const loadEngine =
				this.loadEngine ??
				((onProgress) =>
					loadWhistleEngine({
						cache: createVaultWhistleCache(this.plugin),
						onProgress,
					}));
			this.engine = await loadEngine((event) => {
				if (event.status === "downloading" && !download.notice) {
					download.notice = new Notice(
						"Downloading Whistle model (~17 MB)…",
						0
					);
				}
				if (event.status === "ready" && download.notice) {
					download.notice.hide();
					download.notice = null;
					new Notice("Whistle model ready");
				}
				if (event.status === "error" && download.notice) {
					download.notice.hide();
					download.notice = null;
				}
			});
			if (!this.engine.streamProcess || !this.engine.streamStop) {
				throw new Error("Whistle stream API is unavailable");
			}

			this.buffer = new Float32Array(0);
			this.drainQueue = Promise.resolve();
			await this.recorder.start((chunk) => {
				this.onAudioChunk(chunk);
			});
			this.streamActive = true;
			if (this.plugin.settings.debugMode) {
				new Notice("Whistle Live streaming started");
			}
		} catch (err) {
			download.notice?.hide();
			console.error("Failed to start Whistle Live stream:", err);
			const detail = err instanceof Error ? err.message : String(err);
			new Notice("✘ Could not start live transcription: " + detail);
			this.cleanup();
		}
	}

	async stopStream(): Promise<void> {
		if (!this.streamActive && !this.engine) return;
		this.streamActive = false;
		try {
			this.recorder.stop();
		} catch {
			// ignore
		}
		await this.enqueue(async () => {
			await this.flushWindows(true);
			if (this.engine?.streamStop) {
				try {
					this.applyStreamResult(await this.engine.streamStop());
				} catch (err) {
					console.error("Whistle Live stream stop failed:", err);
				}
			}
		});
		this.editor.lockInterim();
		this.editor.reset();
		this.engine = null;
		this.buffer = new Float32Array(0);
		if (this.plugin.settings.debugMode) {
			new Notice("Whistle Live streaming stopped");
		}
	}

	dispose(): void {
		this.cleanup();
	}

	private onAudioChunk(base64Pcm: string): void {
		if (!this.streamActive) return;
		this.buffer = concatFloat32(
			this.buffer,
			pcm16Base64ToFloat32(base64Pcm)
		);
		void this.enqueue(() => this.flushWindows(false));
	}

	private enqueue(work: () => Promise<void>): Promise<void> {
		this.drainQueue = this.drainQueue.then(work, work);
		return this.drainQueue;
	}

	private async flushWindows(flushRemainder: boolean): Promise<void> {
		if (!this.engine?.streamProcess) return;
		const options = this.streamOptions();
		const { chunks, remainder } = takeStreamChunks(this.buffer);
		this.buffer = remainder;
		for (const chunk of chunks) {
			await this.processWindow(chunk, options);
		}
		if (flushRemainder && this.buffer.length > 0) {
			const tail = this.buffer;
			this.buffer = new Float32Array(0);
			await this.processWindow(tail, options);
		}
	}

	private async processWindow(
		pcm: Float32Array,
		options: WhistleCallOptions
	): Promise<void> {
		if (!this.engine?.streamProcess) return;
		try {
			this.applyStreamResult(
				await this.engine.streamProcess(pcm, options)
			);
		} catch (err) {
			console.error("Whistle Live stream process failed:", err);
			new Notice(
				"✘ Whistle Live: " +
					(err instanceof Error ? err.message : String(err))
			);
		}
	}

	private streamOptions(): WhistleCallOptions {
		const options = buildWhistleCallOptions(this.plugin.settings);
		return { ...options, wordTimestamps: false };
	}

	private applyStreamResult(result: WhistleStreamResult): void {
		if (result.text) {
			this.editor.commitFinal(result.text);
		}
		if (result.pending) {
			this.editor.updateInterim(result.pending);
		}
	}

	private cleanup(): void {
		this.streamActive = false;
		this.engine = null;
		this.buffer = new Float32Array(0);
		try {
			this.recorder.stop();
		} catch {
			// ignore
		}
		this.editor.reset();
	}
}
