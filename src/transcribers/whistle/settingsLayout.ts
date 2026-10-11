import type { TranscriptionProvider } from "../../SettingsManager";

export interface WhisperSettingsLayout {
	showWhisperApiKey: boolean;
	showGeminiApiKey: boolean;
	showOpenAiTranscriptionSettings: boolean;
	showWhistleTranscriptionSettings: boolean;
	showWhistleWordTimestamps: boolean;
	showPostProcessing: boolean;
	showGeminiApiConfig: boolean;
	showGeminiLiveConfig: boolean;
	showWhistleLiveConfig: boolean;
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
				showWhistleWordTimestamps: false,
				showPostProcessing: false,
				showGeminiApiConfig: true,
				showGeminiLiveConfig: false,
				showWhistleLiveConfig: false,
			};
		case "gemini-live":
			return {
				showWhisperApiKey: false,
				showGeminiApiKey: true,
				showOpenAiTranscriptionSettings: false,
				showWhistleTranscriptionSettings: false,
				showWhistleWordTimestamps: false,
				showPostProcessing: false,
				showGeminiApiConfig: false,
				showGeminiLiveConfig: true,
				showWhistleLiveConfig: false,
			};
		case "whistle":
			return {
				showWhisperApiKey: false,
				showGeminiApiKey: false,
				showOpenAiTranscriptionSettings: false,
				showWhistleTranscriptionSettings: true,
				showWhistleWordTimestamps: true,
				showPostProcessing: true,
				showGeminiApiConfig: false,
				showGeminiLiveConfig: false,
				showWhistleLiveConfig: false,
			};
		case "whistle-live":
			return {
				showWhisperApiKey: false,
				showGeminiApiKey: false,
				showOpenAiTranscriptionSettings: false,
				showWhistleTranscriptionSettings: true,
				showWhistleWordTimestamps: false,
				showPostProcessing: false,
				showGeminiApiConfig: false,
				showGeminiLiveConfig: false,
				showWhistleLiveConfig: true,
			};
		default:
			return {
				showWhisperApiKey: true,
				showGeminiApiKey: false,
				showOpenAiTranscriptionSettings: true,
				showWhistleTranscriptionSettings: false,
				showWhistleWordTimestamps: false,
				showPostProcessing: true,
				showGeminiApiConfig: false,
				showGeminiLiveConfig: false,
				showWhistleLiveConfig: false,
			};
	}
}
