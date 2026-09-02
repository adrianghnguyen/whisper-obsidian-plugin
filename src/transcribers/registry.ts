import type { TranscriptionProvider } from "../SettingsManager";
import { GEMINI_LIVE_MODULE } from "./GeminiLiveTranscriber";
import { GEMINI_MODULE } from "./GeminiTranscriber";
import { OPENAI_MODULE } from "./OpenAiTranscriber";
import type { TranscriptionModuleDescriptor } from "./TranscriptionModule";

const ALL_MODULES: TranscriptionModuleDescriptor[] = [
	OPENAI_MODULE,
	GEMINI_MODULE,
	GEMINI_LIVE_MODULE,
];

export const TRANSCRIPTION_MODULES: readonly TranscriptionModuleDescriptor[] =
	[...ALL_MODULES].sort((a, b) => a.order - b.order);

export function getModuleById(
	id: TranscriptionProvider
): TranscriptionModuleDescriptor {
	const found = TRANSCRIPTION_MODULES.find((module) => module.id === id);
	if (!found) {
		return TRANSCRIPTION_MODULES[0];
	}
	return found;
}

export function getNextTranscriptionProvider(
	current: TranscriptionProvider
): TranscriptionProvider {
	const ids = TRANSCRIPTION_MODULES.map((module) => module.id);
	const index = ids.indexOf(current);
	const nextIndex = index < 0 ? 0 : (index + 1) % ids.length;
	return ids[nextIndex];
}

export function getTranscriptionProviderOptions(): Record<
	TranscriptionProvider,
	string
> {
	const options = {} as Record<TranscriptionProvider, string>;
	for (const module of TRANSCRIPTION_MODULES) {
		options[module.id] = module.label;
	}
	return options;
}
