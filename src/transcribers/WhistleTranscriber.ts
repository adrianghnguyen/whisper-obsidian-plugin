import { Notice } from "obsidian";
import Whisper from "main";
import { PostProcessor } from "../PostProcessor";
import { Transcriber, TranscribeResult } from "./Transcriber";
import type { TranscriptionModuleDescriptor } from "./TranscriptionModule";
import { pcmFromDecoded } from "./whistle/audio";
import {
	loadWhistleEngine,
	type WhistleEngineProgress,
} from "./whistle/engine";
import { buildWhistleCallOptions } from "./whistle/options";
import { createVaultWhistleCache } from "./whistle/whistleCache";

export const WHISTLE_MODULE: TranscriptionModuleDescriptor = {
	id: "whistle",
	label: "Whistle (On-device)",
	statusBarLabel: "Whistle",
	isLive: false,
	order: 3,
	supportsPauseTolerance: false,
};

async function defaultDecodeAudio(
	blob: Blob
): Promise<{ channelData: Float32Array[]; sampleRate: number }> {
	const ctx = new AudioContext();
	const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
	const channelData: Float32Array[] = [];
	for (let i = 0; i < buffer.numberOfChannels; i++) {
		channelData.push(buffer.getChannelData(i));
	}
	await ctx.close();
	return { channelData, sampleRate: buffer.sampleRate };
}

export class WhistleTranscriber implements Transcriber {
	private loadEngine:
		| ((
				onProgress?: (event: WhistleEngineProgress) => void
		  ) => ReturnType<typeof loadWhistleEngine>)
		| null;
	private decodeAudio: (
		blob: Blob
	) => Promise<{ channelData: Float32Array[]; sampleRate: number }>;

	constructor(
		deps?: {
			loadEngine?: (
				onProgress?: (event: WhistleEngineProgress) => void
			) => ReturnType<typeof loadWhistleEngine>;
			decodeAudio?: (
				blob: Blob
			) => Promise<{ channelData: Float32Array[]; sampleRate: number }>;
		}
	) {
		this.decodeAudio = deps?.decodeAudio ?? defaultDecodeAudio;
		this.loadEngine = deps?.loadEngine ?? null;
	}

	async transcribe(
		plugin: Whisper,
		blob: Blob,
		_fileName: string,
		_baseFileName: string
	): Promise<TranscribeResult> {
		let downloadNotice: Notice | null = null;
		const loadEngine =
			this.loadEngine ??
			((onProgress) =>
				loadWhistleEngine({
					cache: createVaultWhistleCache(plugin),
					onProgress,
				}));
		const engine = await loadEngine((event) => {
			if (event.status === "downloading" && !downloadNotice) {
				downloadNotice = new Notice(
					"Downloading Whistle model (~17 MB)…",
					0
				);
			}
			if (event.status === "ready" && downloadNotice) {
				downloadNotice.hide();
				downloadNotice = null;
				new Notice("Whistle model ready");
			}
			if (event.status === "error" && downloadNotice) {
				downloadNotice.hide();
				downloadNotice = null;
			}
		});

		let pcm: Float32Array;
		try {
			const decoded = await this.decodeAudio(blob);
			pcm = pcmFromDecoded(decoded);
		} catch (err) {
			throw err instanceof Error ? err : new Error(String(err));
		}

		let transcript;
		try {
			transcript = await engine.transcribe(
				pcm,
				buildWhistleCallOptions(plugin.settings)
			);
		} catch (err) {
			const message =
				err instanceof Error ? err.message : String(err);
			throw new Error(`Whistle transcription failed: ${message}`);
		}

		const originalText = transcript.text ?? "";
		if (!originalText.trim()) {
			new Notice("No speech detected");
			return { text: "" };
		}

		let finalText = originalText;
		if (plugin.settings.postProcessing) {
			const ppApiKey = this.getPostProcessingApiKey(plugin);
			if (!ppApiKey) {
				new Notice("✘ Add your post-processing API key in settings");
				throw new Error("Missing post-processing API key");
			}
			try {
				if (plugin.settings.debugMode) {
					new Notice("Post-processing...");
				}
				const processor = new PostProcessor({
					apiKey: ppApiKey,
					model: plugin.settings.postProcessingModel,
					url: plugin.settings.postProcessingUrl,
					provider: plugin.settings.postProcessingProvider,
				});
				finalText = await processor.process(
					originalText,
					plugin.settings.postProcessingPrompt
				);
			} catch (err) {
				console.error("Post-processing failed:", err);
				new Notice(
					"✘ Post-processing failed, using original transcription"
				);
				finalText = originalText;
			}
		}

		return { text: finalText, originalText };
	}

	private getPostProcessingApiKey(plugin: Whisper): string {
		switch (plugin.settings.postProcessingProvider) {
			case "anthropic":
				return plugin.settings.anthropicApiKey;
			case "openai":
				return plugin.settings.openAiApiKey;
			case "custom":
				return plugin.settings.postProcessingApiKey;
		}
	}
}
