import type { TranscriptionProvider } from "../SettingsManager";

export interface TranscriptionModuleDescriptor {
	id: TranscriptionProvider;
	label: string;
	statusBarLabel: string;
	isLive: boolean;
	order: number;
	/*
	 * Whether this provider has a meaningful silence/pause window the user can
	 * tune. Only streaming providers qualify — one-shot providers transcribe a
	 * finished file and never see a live pause.
	 */
	supportsPauseTolerance: boolean;
}
