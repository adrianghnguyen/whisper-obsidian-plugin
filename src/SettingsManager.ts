import { Platform, Plugin } from "obsidian";

const SECRET_IDS: Record<keyof ApiKeysSettings, string> = {
	apiKey: "api-key",
	openAiApiKey: "openai-api-key",
	anthropicApiKey: "anthropic-api-key",
	postProcessingApiKey: "post-processing-api-key",
};

export const AUDIO_DEVICE_LS_KEY = "whisper:audioDeviceId";

export type PostProcessingProvider = "anthropic" | "openai" | "custom";

export const PROVIDER_URLS: Record<PostProcessingProvider, string> = {
	anthropic: "https://api.anthropic.com/v1/messages",
	openai: "https://api.openai.com/v1/chat/completions",
	custom: "",
};

export const PROVIDER_DEFAULT_MODELS: Record<PostProcessingProvider, string> = {
	anthropic: "claude-haiku-4-5-20251001",
	openai: "gpt-5.4-nano-2026-03-17",
	custom: "",
};

export interface ApiKeysSettings {
	apiKey: string;
	openAiApiKey: string;
	anthropicApiKey: string;
	postProcessingApiKey: string;
}

export interface WhisperSettings {
	// API
	apiUrl: string;
	model: string;
	language: string;
	prompt: string;
	temperature: number;
	responseFormat: string;
	cursorContext: boolean;
	// Recording
	audioDeviceId: string;
	audioDeviceIds: Record<string, string>;
	saveAudioFile: boolean;
	audioSavePath: string;
	// Output
	createNoteFile: boolean;
	noteSavePath: string;
	noteFilenameTemplate: string;
	noteTemplate: string;
	// Advanced
	debugMode: boolean;
}

export interface PostProcessingSettings {
	postProcessing: boolean;
	postProcessingProvider: PostProcessingProvider;
	postProcessingUrl: string;
	postProcessingModel: string;
	postProcessingPrompt: string;
	autoGenerateTitle: boolean;
	titleGenerationPrompt: string;
	keepOriginalTranscription: boolean;
}

export type PluginSettings = ApiKeysSettings &
	WhisperSettings &
	PostProcessingSettings;

export const DEFAULT_API_KEYS: ApiKeysSettings = {
	apiKey: "",
	openAiApiKey: "",
	anthropicApiKey: "",
	postProcessingApiKey: "",
};

export const DEFAULT_WHISPER: WhisperSettings = {
	apiUrl: "https://api.openai.com/v1/audio/transcriptions",
	model: "whisper-1",
	language: "",
	prompt: "",
	temperature: 0,
	responseFormat: "json",
	cursorContext: false,
	audioDeviceId: "default",
	audioDeviceIds: {},
	saveAudioFile: true,
	audioSavePath: "",
	createNoteFile: true,
	noteSavePath: "",
	noteFilenameTemplate: "{{datetime}}",
	noteTemplate: "![[{{audioFile}}]]\n{{transcription}}",
	debugMode: false,
};

export const DEFAULT_POST_PROCESSING: PostProcessingSettings = {
	postProcessing: false,
	postProcessingProvider: "anthropic",
	postProcessingUrl: "https://api.anthropic.com/v1/messages",
	postProcessingModel: "claude-haiku-4-5-20251001",
	postProcessingPrompt:
		'You are a transcription editor. Clean up the following voice transcription: fix grammar, remove filler words (um, uh, like) and repetitions, and improve readability. Format the text in markdown. If there are action items or to-dos, format them as task lists with "[ ]". Preserve the original meaning and language. Return only the polished text, nothing else.',
	autoGenerateTitle: false,
	titleGenerationPrompt:
		"Generate a short title (1-5 words) for the following text. Return only the title, nothing else.",
	keepOriginalTranscription: false,
};

export const DEFAULT_SETTINGS: PluginSettings = {
	...DEFAULT_API_KEYS,
	...DEFAULT_WHISPER,
	...DEFAULT_POST_PROCESSING,
};

export function resolveDesktopHostname(
	osHostname?: string | null,
	env: Record<string, string | undefined> = {}
): string {
	const fromOs = osHostname?.trim();
	if (fromOs) {
		return fromOs;
	}
	return env.COMPUTERNAME || env.HOSTNAME || "unknown";
}

function readOsHostname(): string | undefined {
	try {
		// Node builtin; available in the desktop Electron app, not on mobile.
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const os = require("os") as { hostname: () => string };
		return os.hostname();
	} catch {
		return undefined;
	}
}

export function syncsHostAudioDeviceMap(): boolean {
	return Platform.isDesktopApp;
}

export function getHostname(): string {
	if (Platform.isDesktopApp) {
		const env =
			typeof process !== "undefined" && process.env ? process.env : {};
		return resolveDesktopHostname(readOsHostname(), env);
	}
	return "mobile";
}

export function resolveMobileAudioDeviceId(
	localStorageId: string | null
): string {
	if (localStorageId && localStorageId !== "") {
		return localStorageId;
	}
	return "default";
}

export function resolveHostAudioDeviceId(
	settings: PluginSettings,
	host: string,
	localStorageId: string | null
): {
	audioDeviceId: string;
	audioDeviceIds: Record<string, string>;
	persist: boolean;
} {
	const audioDeviceIds = { ...(settings.audioDeviceIds || {}) };
	if (audioDeviceIds[host]) {
		return {
			audioDeviceId: audioDeviceIds[host],
			audioDeviceIds,
			persist: false,
		};
	}
	if (localStorageId) {
		audioDeviceIds[host] = localStorageId;
		return {
			audioDeviceId: localStorageId,
			audioDeviceIds,
			persist: true,
		};
	}
	if (settings.audioDeviceId && settings.audioDeviceId !== "default") {
		audioDeviceIds[host] = settings.audioDeviceId;
		return {
			audioDeviceId: settings.audioDeviceId,
			audioDeviceIds,
			persist: true,
		};
	}
	return { audioDeviceId: "default", audioDeviceIds, persist: false };
}

export class SettingsManager {
	private plugin: Plugin;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
	}

	private get secrets() {
		return this.plugin.app.secretStorage;
	}

	private migrateKeysFromDataJson(settings: PluginSettings): boolean {
		// One-time migration: move plain-text keys out of data.json into SecretStorage.
		// Only runs for legacy installs that still have keys in data.json.
		let migrated = false;
		for (const [field, secretId] of Object.entries(SECRET_IDS)) {
			const key = field as keyof ApiKeysSettings;
			if (settings[key]) {
				this.secrets.setSecret(secretId, settings[key]);
				settings[key] = "";
				migrated = true;
			}
		}
		return migrated;
	}

	private syncKeysToSecretStorage(settings: PluginSettings): void {
		// Write non-empty in-memory keys to SecretStorage. An empty value does
		// not overwrite an existing secret (settings rebuilds used to wipe keys).
		// Strip keys from the settings object so they never land in data.json.
		for (const [field, secretId] of Object.entries(SECRET_IDS)) {
			const key = field as keyof ApiKeysSettings;
			const value = settings[key];
			if (!value) {
				const existing = this.secrets.getSecret(secretId);
				if (existing) {
					settings[key] = "";
					continue;
				}
			}
			this.secrets.setSecret(secretId, value);
			settings[key] = "";
		}
	}

	clearApiKey(settings: PluginSettings, field: keyof ApiKeysSettings): void {
		const secretId = SECRET_IDS[field];
		settings[field] = "";
		const secrets = this.secrets as {
			getSecret(id: string): string | null;
			setSecret(id: string, value: string): void;
			deleteSecret?: (id: string) => void;
		};
		if (typeof secrets.deleteSecret === "function") {
			secrets.deleteSecret(secretId);
		} else {
			secrets.setSecret(secretId, "");
		}
	}

	private loadKeysFromSecretStorage(settings: PluginSettings): void {
		for (const [field, secretId] of Object.entries(SECRET_IDS)) {
			const key = field as keyof ApiKeysSettings;
			settings[key] = this.secrets.getSecret(secretId) ?? "";
		}
	}

	private migratePostProcessingProvider(settings: PluginSettings): boolean {
		// Existing users without postProcessingProvider: infer from URL
		if (settings.postProcessingProvider) return false;

		for (const [provider, url] of Object.entries(PROVIDER_URLS)) {
			if (url && settings.postProcessingUrl === url) {
				settings.postProcessingProvider =
					provider as PostProcessingProvider;
				return true;
			}
		}
		if (settings.postProcessingUrl) {
			settings.postProcessingProvider = "custom";
			return true;
		}
		return false;
	}

	private persistDiskSettings(settings: PluginSettings): Promise<void> {
		const deviceId = settings.audioDeviceId || "default";
		const audioDeviceIds = { ...(settings.audioDeviceIds || {}) };
		if (syncsHostAudioDeviceMap()) {
			audioDeviceIds[getHostname()] = deviceId;
		}
		const toSave: PluginSettings = {
			...settings,
			audioDeviceId: "default",
			audioDeviceIds,
			apiKey: "",
			openAiApiKey: "",
			anthropicApiKey: "",
			postProcessingApiKey: "",
		};
		return this.plugin.saveData(toSave);
	}

	async loadSettings(): Promise<PluginSettings> {
		const settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.plugin.loadData()
		);
		if (!settings.audioDeviceIds) {
			settings.audioDeviceIds = {};
		}

		const localRaw = this.plugin.app.loadLocalStorage(AUDIO_DEVICE_LS_KEY);
		const localId =
			typeof localRaw === "string" && localRaw !== "" ? localRaw : null;

		let persist = false;
		if (syncsHostAudioDeviceMap()) {
			const resolved = resolveHostAudioDeviceId(
				settings,
				getHostname(),
				localId
			);
			settings.audioDeviceId = resolved.audioDeviceId;
			settings.audioDeviceIds = resolved.audioDeviceIds;
			persist = resolved.persist;
		} else {
			// Phone/tablet: keep the mic in localStorage only. Do not read or
			// write audioDeviceIds["mobile"] — that key is shared across devices.
			settings.audioDeviceId = resolveMobileAudioDeviceId(localId);
		}

		// Migrate provider setting for existing users
		if (this.migratePostProcessingProvider(settings)) {
			persist = true;
		}

		// One-time migration of any plain-text keys left in data.json
		if (this.migrateKeysFromDataJson(settings)) {
			persist = true;
		}

		if (persist) {
			await this.persistDiskSettings(settings);
		}

		// Populate in-memory settings from SecretStorage
		this.loadKeysFromSecretStorage(settings);
		return settings;
	}

	async saveSettings(settings: PluginSettings): Promise<void> {
		const deviceId = settings.audioDeviceId || "default";
		const disk = (await this.plugin.loadData()) ?? {};
		const audioDeviceIds = {
			...((disk.audioDeviceIds as Record<string, string>) || {}),
		};
		if (syncsHostAudioDeviceMap()) {
			audioDeviceIds[getHostname()] = deviceId;
		}
		this.plugin.app.saveLocalStorage(AUDIO_DEVICE_LS_KEY, deviceId);
		this.syncKeysToSecretStorage(settings);
		await this.plugin.saveData({
			...settings,
			audioDeviceId: "default",
			audioDeviceIds,
		});
		this.loadKeysFromSecretStorage(settings);
		settings.audioDeviceId = deviceId;
		settings.audioDeviceIds = audioDeviceIds;
	}
}
