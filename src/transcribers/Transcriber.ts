import Whisper from "main";

export interface TranscribeResult {
	text: string;
	originalText?: string;
}

export interface Transcriber {
	transcribe(
		plugin: Whisper,
		blob: Blob,
		fileName: string,
		baseFileName: string
	): Promise<TranscribeResult>;
}