import { describe, it, expect, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../src/SettingsManager";
import { WhisperSettingsTab } from "../src/WhisperSettingsTab";

describe("WhisperSettingsTab — Whisper API key setting", () => {
	it("uses SecretComponent for the whisper api key", () => {
		const plugin = {
			app: {
				loadLocalStorage: () => null,
				saveLocalStorage: vi.fn(),
				secretStorage: {
					getSecret: () => null,
					setSecret: vi.fn(),
				},
			},
			settings: { ...DEFAULT_SETTINGS, whisperApiKeySecretId: "openai-shared" },
			settingsManager: {
				saveSettings: vi.fn(async () => {}),
				clearApiKey: vi.fn(),
			},
		};

		const tab = new WhisperSettingsTab(plugin.app as never, plugin as never);
		(tab as unknown as { createWhisperApiKeySetting: () => void }).createWhisperApiKeySetting();

		const secretComponents = tab.containerEl.querySelectorAll(
			"[data-whisper-secret-component]"
		);
		expect(secretComponents.length).toBe(1);
	});
});
