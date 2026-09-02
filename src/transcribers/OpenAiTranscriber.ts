import axios from "axios";
import { Notice, MarkdownView } from "obsidian";
import Whisper from "main";
import { getCursorContext } from "../utils";
import { PostProcessor } from "../PostProcessor";
import { Transcriber, TranscribeResult } from "./Transcriber";
import type { TranscriptionModuleDescriptor } from "./TranscriptionModule";
import { isWhisperApiKeyRequired } from "../whisperApiKey";

export const OPENAI_MODULE: TranscriptionModuleDescriptor = {
	id: "openai",
	label: "OpenAI (Whisper)",
	statusBarLabel: "Whisper",
	isLive: false,
	order: 0,
};

export class OpenAiTranscriber implements Transcriber {
	async transcribe(
		plugin: Whisper,
		blob: Blob,
		fileName: string,
		_baseFileName: string
	): Promise<TranscribeResult> {
		const isDefaultApi =
			plugin.settings.apiUrl ===
			"https://api.openai.com/v1/audio/transcriptions";
		if (isWhisperApiKeyRequired(plugin.settings.apiUrl, plugin.settings.apiKey)) {
			new Notice("✘ Add your API key in Whisper settings");
			throw new Error("Missing API key");
		}

		const formData = new FormData();
		formData.append("file", blob, fileName);
		formData.append("model", plugin.settings.model);
		if (
			plugin.settings.language &&
			plugin.settings.language !== "auto"
		) {
			formData.append("language", plugin.settings.language);
		}

		let prompt = plugin.settings.prompt || "";
		if (plugin.settings.cursorContext) {
			const editor =
				plugin.app.workspace.getActiveViewOfType(
					MarkdownView
				)?.editor;
			if (editor) {
				const context = getCursorContext(editor);
				prompt = prompt ? `${prompt}\n${context}` : context;
			}
		}
		if (prompt) formData.append("prompt", prompt);

		if (plugin.settings.temperature !== 0)
			formData.append(
				"temperature",
				String(plugin.settings.temperature)
			);
		if (plugin.settings.responseFormat !== "json")
			formData.append(
				"response_format",
				plugin.settings.responseFormat
			);

		if (plugin.settings.debugMode) {
			new Notice("Transcribing...");
		}
		const response = await axios.post(
			plugin.settings.apiUrl,
			formData,
			{
				headers: {
					"Content-Type": "multipart/form-data",
					...(plugin.settings.apiKey
						? {
								Authorization: `Bearer ${plugin.settings.apiKey}`,
						  }
						: {}),
				},
			}
		);

		const originalText: string = response.data.text;
		let finalText = originalText;

		// Post-process with LLM if enabled
		if (plugin.settings.postProcessing) {
			const ppApiKey = this.getPostProcessingApiKey(plugin);
			if (!ppApiKey) {
				new Notice(
					"✘ Add your post-processing API key in settings"
				);
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