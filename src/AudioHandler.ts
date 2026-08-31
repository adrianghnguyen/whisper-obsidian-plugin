import Whisper from "main";
import { Notice, MarkdownView } from "obsidian";
import {
	getBaseFileName,
	buildTemplateVariables,
	resolveTemplate,
} from "./utils";
import { Transcriber } from "./transcribers/Transcriber";
import { OpenAiTranscriber } from "./transcribers/OpenAiTranscriber";
import { GeminiTranscriber } from "./transcribers/GeminiTranscriber";

export class AudioHandler {
	private plugin: Whisper;
	private openAi: OpenAiTranscriber;
	private gemini: GeminiTranscriber;

	constructor(plugin: Whisper) {
		this.plugin = plugin;
		this.openAi = new OpenAiTranscriber();
		this.gemini = new GeminiTranscriber();
	}

	private getTranscriber(): Transcriber {
		switch (this.plugin.settings.transcriptionProvider) {
			case "gemini":
				return this.gemini;
			default:
				return this.openAi;
		}
	}

	private async ensureFolderExists(folderPath: string): Promise<void> {
		if (
			folderPath &&
			!(await this.plugin.app.vault.adapter.exists(folderPath))
		) {
			await this.plugin.app.vault.createFolder(folderPath);
		}
	}

	async sendAudioData(blob: Blob, fileName: string): Promise<void> {
		const baseFileName = getBaseFileName(fileName);

		const audioFilePath = `${
			this.plugin.settings.audioSavePath
				? `${this.plugin.settings.audioSavePath}/`
				: ""
		}${fileName}`;

		if (this.plugin.settings.debugMode) {
			new Notice(`Sending ${Math.round(blob.size / 1000)} KB...`);
		}

		const MIN_AUDIO_SIZE_BYTES = 1000;
		if (blob.size < MIN_AUDIO_SIZE_BYTES) {
			new Notice("✘ Recording too short");
			return;
		}

		// Save audio file first (shared by both providers)
		try {
			if (this.plugin.settings.saveAudioFile) {
				await this.ensureFolderExists(
					this.plugin.settings.audioSavePath
				);
				const arrayBuffer = await blob.arrayBuffer();
				await this.plugin.app.vault.adapter.writeBinary(
					audioFilePath,
					new Uint8Array(arrayBuffer)
				);
			}
		} catch (err) {
			console.error("Error saving audio file:", err);
			new Notice(
				"✘ Couldn't save audio: " +
					(err instanceof Error ? err.message : String(err))
			);
		}

		try {
			const transcriber = this.getTranscriber();
			const result = await transcriber.transcribe(
				this.plugin,
				blob,
				fileName,
				baseFileName
			);

			let finalText = result.text;

			// Auto-generate title (OpenAI path only — Gemini skips this)
			let generatedTitle = baseFileName;
			if (
				this.plugin.settings.transcriptionProvider === "openai" &&
				this.plugin.settings.autoGenerateTitle &&
				this.plugin.settings.createNoteFile
			) {
				generatedTitle = await this.generateTitle(finalText, baseFileName);
			}

			// Build note content with templates
			const outputText =
				this.plugin.settings.transcriptionProvider === "openai" &&
				this.plugin.settings.keepOriginalTranscription &&
				result.originalText &&
				finalText !== result.originalText
					? `${finalText}\n\n---\n\n*Original transcription:*\n${result.originalText}`
					: finalText;

			await this.handleOutput(
				outputText,
				generatedTitle,
				audioFilePath,
				baseFileName
			);

			new Notice("Transcription complete");
		} catch (err) {
			console.error("Transcription error:", err);
			// Don't show a notice for errors that already displayed one
			if (
				!(err instanceof Error && err.message.startsWith("Missing"))
			) {
				new Notice(
					"✘ Transcription failed: " +
						(err instanceof Error ? err.message : String(err))
				);
			}
		}
	}

	private async generateTitle(
		text: string,
		baseFileName: string
	): Promise<string> {
		const ppApiKey = this.getPostProcessingApiKey();
		if (!ppApiKey) return baseFileName;

		try {
			const { PostProcessor } = await import("./PostProcessor");
			const processor = new PostProcessor({
				apiKey: ppApiKey,
				model: this.plugin.settings.postProcessingModel,
				url: this.plugin.settings.postProcessingUrl,
				provider: this.plugin.settings.postProcessingProvider,
			});
			const title = await processor.process(
				text,
				this.plugin.settings.titleGenerationPrompt
			);
			const sanitized = title
				.replace(/[/\\?%*:|"<>\n]/g, "-")
				.trim();
			return sanitized || baseFileName;
		} catch (err) {
			console.error("Title generation failed:", err);
			return baseFileName;
		}
	}

	private getPostProcessingApiKey(): string {
		switch (this.plugin.settings.postProcessingProvider) {
			case "anthropic":
				return this.plugin.settings.anthropicApiKey;
			case "openai":
				return this.plugin.settings.openAiApiKey;
			case "custom":
				return this.plugin.settings.postProcessingApiKey;
		}
	}

	private async handleOutput(
		outputText: string,
		generatedTitle: string,
		audioFilePath: string,
		baseFileName: string
	): Promise<void> {
		if (this.plugin.settings.createNoteFile) {
			await this.ensureFolderExists(
				this.plugin.settings.noteSavePath
			);

			const vars = buildTemplateVariables(
				outputText,
				generatedTitle,
				audioFilePath
			);

			const resolvedFilename =
				resolveTemplate(
					this.plugin.settings.noteFilenameTemplate,
					vars
				)
					.replace(/[/\\?%*:|"<>\n]/g, "-")
					.trim() || baseFileName;

			const folder = this.plugin.settings.noteSavePath;
			const resolvedNoteFilePath = `${
				folder ? `${folder}/` : ""
			}${resolvedFilename}.md`;

			const noteContent = resolveTemplate(
				this.plugin.settings.noteTemplate,
				vars
			).trim();

			await this.plugin.app.vault.create(
				resolvedNoteFilePath,
				noteContent
			);
		}

		const editor =
			this.plugin.app.workspace.getActiveViewOfType(
				MarkdownView
			)?.editor;
		if (editor) {
			const cursorPosition = editor.getCursor();
			editor.replaceRange(outputText, cursorPosition);

			const newPosition = {
				line: cursorPosition.line,
				ch: cursorPosition.ch + outputText.length,
			};
			editor.setCursor(newPosition);
		}
	}
}