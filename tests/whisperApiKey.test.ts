import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	DEFAULT_SETTINGS,
	SettingsManager,
	LEGACY_WHISPER_SECRET_ID,
} from "../src/SettingsManager";
import {
	resolveWhisperApiKey,
	migrateLegacyWhisperSecretId,
	isWhisperApiKeyRequired,
} from "../src/whisperApiKey";

describe("resolveWhisperApiKey", () => {
	it("returns empty string when no secret id is selected", () => {
		const secrets = { getSecret: vi.fn() };
		expect(resolveWhisperApiKey(secrets, "")).toBe("");
		expect(secrets.getSecret).not.toHaveBeenCalled();
	});

	it("returns the secret value for the selected id", () => {
		const secrets = {
			getSecret: vi.fn((id: string) =>
				id === "openai-whisper" ? "sk-live-key" : null
			),
		};
		expect(resolveWhisperApiKey(secrets, "openai-whisper")).toBe(
			"sk-live-key"
		);
	});

	it("returns empty string when the secret id is missing from storage", () => {
		const secrets = { getSecret: vi.fn(() => null) };
		expect(resolveWhisperApiKey(secrets, "missing-secret")).toBe("");
	});
});

describe("migrateLegacyWhisperSecretId", () => {
	it("does nothing when a secret id is already configured", () => {
		const settings = {
			...DEFAULT_SETTINGS,
			whisperApiKeySecretId: "my-openai-key",
		};
		const secrets = { getSecret: vi.fn(() => "sk-old") };
		expect(migrateLegacyWhisperSecretId(settings, secrets)).toBe(false);
		expect(settings.whisperApiKeySecretId).toBe("my-openai-key");
	});

	it("links legacy api-key storage when no secret id is set", () => {
		const settings = { ...DEFAULT_SETTINGS, whisperApiKeySecretId: "" };
		const secrets = {
			getSecret: vi.fn((id: string) =>
				id === LEGACY_WHISPER_SECRET_ID ? "sk-legacy" : null
			),
		};
		expect(migrateLegacyWhisperSecretId(settings, secrets)).toBe(true);
		expect(settings.whisperApiKeySecretId).toBe(LEGACY_WHISPER_SECRET_ID);
	});

	it("does nothing when there is no legacy secret", () => {
		const settings = { ...DEFAULT_SETTINGS, whisperApiKeySecretId: "" };
		const secrets = { getSecret: vi.fn(() => null) };
		expect(migrateLegacyWhisperSecretId(settings, secrets)).toBe(false);
		expect(settings.whisperApiKeySecretId).toBe("");
	});
});

describe("isWhisperApiKeyRequired", () => {
	const DEFAULT_URL = "https://api.openai.com/v1/audio/transcriptions";

	it("requires a key for the default OpenAI endpoint", () => {
		expect(isWhisperApiKeyRequired(DEFAULT_URL, "")).toBe(true);
		expect(isWhisperApiKeyRequired(DEFAULT_URL, "sk-abc")).toBe(false);
	});

	it("does not require a key for custom endpoints", () => {
		expect(
			isWhisperApiKeyRequired("http://localhost:9000/asr", "")
		).toBe(false);
	});
});

describe("SettingsManager — Whisper SecretComponent integration", () => {
	let plugin: {
		app: {
			loadLocalStorage: (key: string) => string | null;
			saveLocalStorage: (key: string, value: string) => void;
			secretStorage: {
				getSecret: (id: string) => string | null;
				setSecret: (id: string, value: string) => void;
			};
		};
		loadData: () => Promise<Record<string, unknown>>;
		saveData: (data: Record<string, unknown>) => Promise<void>;
	};

	beforeEach(() => {
		const storedSecrets: Record<string, string> = {
			"openai-shared": "sk-from-keychain",
		};
		let diskData: Record<string, unknown> = {
			whisperApiKeySecretId: "openai-shared",
		};

		plugin = {
			app: {
				loadLocalStorage: () => null,
				saveLocalStorage: vi.fn(),
				secretStorage: {
					getSecret: (id: string) => storedSecrets[id] ?? null,
					setSecret: vi.fn((id: string, value: string) => {
						storedSecrets[id] = value;
					}),
				},
			},
			loadData: vi.fn(async () => diskData),
			saveData: vi.fn(async (data: Record<string, unknown>) => {
				diskData = data;
			}),
		};
	});

	it("loads the resolved whisper api key from the selected secret id", async () => {
		const manager = new SettingsManager(plugin as never);
		const settings = await manager.loadSettings();

		expect(settings.whisperApiKeySecretId).toBe("openai-shared");
		expect(settings.apiKey).toBe("sk-from-keychain");
	});

	it("persists the secret id, not the secret value, in data.json", async () => {
		const manager = new SettingsManager(plugin as never);
		const settings = await manager.loadSettings();
		settings.whisperApiKeySecretId = "another-secret";
		settings.apiKey = "sk-should-not-persist";

		await manager.saveSettings(settings);

		const saved = (plugin.saveData as ReturnType<typeof vi.fn>).mock
			.calls[0][0];
		expect(saved.whisperApiKeySecretId).toBe("another-secret");
		expect(saved.apiKey).toBe("");
		expect(plugin.app.secretStorage.setSecret).not.toHaveBeenCalledWith(
			"another-secret",
			"sk-should-not-persist"
		);
	});
});
