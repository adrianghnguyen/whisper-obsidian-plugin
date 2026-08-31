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

		if (plugin.settings.debugMode) {
			new Notice("Sending to Gemini Interactions API...");
		}

		const response = await axios.post(
			"https://generativelanguage.googleapis.com/v1beta/interactions",
			{
				model: plugin.settings.geminiModel,
				input: [
					{ type: "text", text: "Transcribe this audio." },
					{
						type: "audio",
						data: base64Audio,
						mime_type: mimeType,
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

		if (plugin.settings.debugMode) {
			new Notice(
				"Gemini responded: " +
					JSON.stringify(response.data).substring(0, 300)
			);
		}

		// Interactions API returns text in steps[0].content[0].text
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