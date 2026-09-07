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

export type ProviderEnableSettings = {
	disabledTranscriptionProviders?: TranscriptionProvider[];
};

export function isProviderEnabled(
	settings: ProviderEnableSettings,
	id: TranscriptionProvider
): boolean {
	const disabled = settings.disabledTranscriptionProviders ?? [];
	return !disabled.includes(id);
}

export function getEnabledModules(
	settings: ProviderEnableSettings
): TranscriptionModuleDescriptor[] {
	return TRANSCRIPTION_MODULES.filter((module) =>
		isProviderEnabled(settings, module.id)
	);
}

export function getFirstEnabledProvider(
	settings: ProviderEnableSettings
): TranscriptionProvider {
	const enabled = getEnabledModules(settings);
	return (enabled[0] ?? TRANSCRIPTION_MODULES[0]).id;
}

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
	current: TranscriptionProvider,
	settings: ProviderEnableSettings = {}
): TranscriptionProvider {
	const ids = getEnabledModules(settings).map((module) => module.id);
	if (ids.length === 0) {
		return TRANSCRIPTION_MODULES[0].id;
	}
	const index = ids.indexOf(current);
	if (index < 0) {
		return ids[0];
	}
	return ids[(index + 1) % ids.length];
}

export function getTranscriptionProviderOptions(
	settings: ProviderEnableSettings = {}
): Partial<Record<TranscriptionProvider, string>> {
	const options: Partial<Record<TranscriptionProvider, string>> = {};
	for (const module of getEnabledModules(settings)) {
		options[module.id] = module.label;
	}
	return options;
}
