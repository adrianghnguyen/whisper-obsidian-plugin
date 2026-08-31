import axios from "axios";
import { Notice } from "obsidian";
import Whisper from "main";
import { Transcriber, TranscribeResult } from "./Transcriber";

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

		const response = await axios.post(
			`https://generativelanguage.googleapis.com/v1beta/models/${plugin.settings.geminiModel}:generateContent`,
			{
				contents: [
					{
						parts: [
							{ text: "Transcribe this audio." },
							{
								inline_data: {
									mime_type: mimeType,
									data: base64Audio,
								},
							},
						],
					},
				],
			},
			{
				headers: {
					"x-goog-api-key": plugin.settings.geminiApiKey,
					"Content-Type": "application/json",
				},
			}
		);

		const text: string =
			response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
			"";
		if (!text) {
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