import type { TranscriptionProvider } from "../SettingsManager";

export interface TranscriptionModuleDescriptor {
	id: TranscriptionProvider;
	label: string;
	statusBarLabel: string;
	isLive: boolean;
	order: number;
}
