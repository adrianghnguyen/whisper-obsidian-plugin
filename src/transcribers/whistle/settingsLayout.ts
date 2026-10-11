import type { TranscriptionProvider } from "../../SettingsManager";

export interface WhisperSettingsLayout {
	showWhisperApiKey: boolean;
	showGeminiApiKey: boolean;
	showOpenAiTranscriptionSettings: boolean;
	showWhistleTranscriptionSettings: boolean;
	showPostProcessing: boolean;
	showGeminiApiConfig: boolean;
	showGeminiLiveConfig: boolean;
}

export function getWhisperSettingsLayout(
	provider: TranscriptionProvider
): WhisperSettingsLayout {
	switch (provider) {
		case "gemini":
			return {
				showWhisperApiKey: false,
				showGeminiApiKey: true,
				showOpenAiTranscriptionSettings: false,
				showWhistleTranscriptionSettings: false,
				showPostProcessing: false,
				showGeminiApiConfig: true,
				showGeminiLiveConfig: false,
			};
		case "gemini-live":
			return {
				showWhisperApiKey: false,
				showGeminiApiKey: true,
				showOpenAiTranscriptionSettings: false,
				showWhistleTranscriptionSettings: false,
				showPostProcessing: false,
				showGeminiApiConfig: false,
				showGeminiLiveConfig: true,
			};
		case "whistle":
			return {
				showWhisperApiKey: false,
				showGeminiApiKey: false,
				showOpenAiTranscriptionSettings: false,
				showWhistleTranscriptionSettings: true,
				showPostProcessing: true,
				showGeminiApiConfig: false,
				showGeminiLiveConfig: false,
			};
		default:
			return {
				showWhisperApiKey: true,
				showGeminiApiKey: false,
				showOpenAiTranscriptionSettings: true,
				showWhistleTranscriptionSettings: false,
				showPostProcessing: true,
				showGeminiApiConfig: false,
				showGeminiLiveConfig: false,
			};
	}
}
