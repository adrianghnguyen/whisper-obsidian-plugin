import axios from "axios";
import { Notice } from "obsidian";
import Whisper from "main";
import {
	parseCommaOrLineList,
	parseLanguageCodes,
} from "./geminiPrompt";
import { Transcriber, TranscribeResult } from "./Transcriber";
import type { GeminiTranscriptionMode } from "../SettingsManager";

export interface GeminiInteractionPayload {
	model: string;
	input: Array<Record<string, string>>;
	generation_config: {
		transcription_config: Record<string, unknown>;
	};
}

export interface GeminiBatchSettings {
	geminiModel: string;
	geminiTranscriptionMode: GeminiTranscriptionMode;
	geminiLanguageCodes: string;
	geminiCustomVocabulary: string;
	geminiDiarization: boolean;
	geminiWordTimestamps: boolean;
}

export function buildGeminiInteractionPayload(
	settings: GeminiBatchSettings,
	base64Audio: string,
	mimeType: string
): GeminiInteractionPayload {
	const customVocabulary = parseCommaOrLineList(settings.geminiCustomVocabulary);
	const languageCodes = parseLanguageCodes(settings.geminiLanguageCodes);

	const mode: Record<string, unknown> = {
		type: settings.geminiTranscriptionMode,
	};
	if (settings.geminiTranscriptionMode === "verbatim") {
		if (settings.geminiDiarization) {
			mode.diarization_mode = "speaker";
		}
		if (settings.geminiWordTimestamps) {
			mode.timestamp_granularities = ["word"];
		}
	}

	const transcriptionConfig: Record<string, unknown> = { mode };
	if (customVocabulary.length) {
		transcriptionConfig.custom_vocabulary = customVocabulary;
	}
	if (languageCodes.length) {
		transcriptionConfig.language_codes = languageCodes;
	}

	return {
		model: settings.geminiModel,
		input: [
			{
				type: "audio",
				data: base64Audio,
				mime_type: mimeType,
			},
		],
		generation_config: {
			transcription_config: transcriptionConfig,
		},
	};
}

export class GeminiTranscriber implements Transcriber {
	async transcribe(
		plugin: Whisper,
		blob: Blob,
		_fileName: string,
		_baseFileName: string
	): Promise<TranscribeResult> {
		if (!plugin.settings.geminiApiKey) {
			new Notice("✘ Add your Gemini API key in settings");
			throw new Error("Missing Gemini API key");
		}

		if (plugin.settings.debugMode) {
			new Notice("Transcribing with Gemini...");
		}

		const base64Audio = await blobToBase64(blob);
		const mimeType = blob.type || "audio/webm";

		if (plugin.settings.debugMode) {
			new Notice("Sending to Gemini Interactions API...");
		}

		const payload = buildGeminiInteractionPayload(
			plugin.settings,
			base64Audio,
			mimeType
		);

		const response = await axios.post(
			"https://generativelanguage.googleapis.com/v1beta/interactions",
			payload,
			{
				headers: {
					"x-goog-api-key": plugin.settings.geminiApiKey,
					"Content-Type": "application/json",
				},
			}
		);

		if (plugin.settings.debugMode) {
			new Notice(
				"Gemini responded: " +
					JSON.stringify(response.data).substring(0, 300)
			);
		}

		const text: string =
			response.data?.steps?.[0]?.content?.[0]?.text?.trim() || "";
		if (!text) {
			console.error("Gemini response:", JSON.stringify(response.data));
			new Notice("✘ Gemini returned empty transcription");
			throw new Error("Empty transcription from Gemini");
		}

		return { text };
	}
}

function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = () => {
			const result = reader.result as string;
			const base64 = result.split(",")[1];
			resolve(base64);
		};
		reader.onerror = reject;
		reader.readAsDataURL(blob);
	});
}
