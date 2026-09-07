import Whisper from "main";
import { App, Notice, PluginSettingTab, SecretComponent, Setting } from "obsidian";
import {
	SettingsManager,
	TranscriptionProvider,
	PostProcessingProvider,
	PROVIDER_URLS,
	PROVIDER_DEFAULT_MODELS,
	ApiKeysSettings,
	GeminiTranscriptionMode,
	getHostname,
} from "./SettingsManager";
import {
	applyAudioDeviceSelection,
	formatMicrophoneSettingDesc,
	listInputDevices,
	resolveOsDefaultDeviceId,
} from "./audioDevices";
import {
	TRANSCRIPTION_MODULES,
	getFirstEnabledProvider,
	getTranscriptionProviderOptions,
	isProviderEnabled,
} from "./transcribers/registry";
import {
	DEFAULT_LIVE_HIGHLIGHT_COLOR,
	LIVE_HIGHLIGHT_PRESETS,
	normalizeHighlightColor,
} from "./transcribers/liveHighlight";

export class WhisperSettingsTab extends PluginSettingTab {
	private static readonly SAVE_DEBOUNCE_MS = 800;

	private plugin: Whisper;
	private settingsManager: SettingsManager;
	private rebuilding = false;
	private saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(app: App, plugin: Whisper) {
		super(app, plugin);
		this.plugin = plugin;
		this.settingsManager = plugin.settingsManager;
	}

	hide(): void {
		this.flushDebouncedSave();
		super.hide();
	}

	display(): void {
		const { containerEl } = this;
		const scrollTop = containerEl.scrollTop;
		this.rebuilding = true;

		containerEl.empty();

		const isGemini =
			this.plugin.settings.transcriptionProvider === "gemini";
		const isGeminiLive =
			this.plugin.settings.transcriptionProvider === "gemini-live";
		const isAnyGemini = isGemini || isGeminiLive;

		// --- Provider (first, drives everything below) ---
		new Setting(containerEl).setName("Provider").setHeading();
		this.createTranscriptionProviderSetting();

		// --- API Keys (only the relevant ones for the chosen provider) ---
		new Setting(containerEl)
			.setName(isAnyGemini ? "API Key" : "API Keys")
			.setHeading();
		if (isAnyGemini) {
			this.createGeminiApiKeySetting();
		} else {
			this.createWhisperApiKeySetting();
			// Post-processing keys: show only the relevant one
			if (this.plugin.settings.postProcessing) {
				switch (this.plugin.settings.postProcessingProvider) {
					case "openai":
						this.createOpenAiApiKeySetting();
						break;
					case "anthropic":
						this.createAnthropicApiKeySetting();
						break;
					case "custom":
						this.createPostProcessingApiKeySetting();
						break;
				}
			}
		}

		// --- Transcription (OpenAI only) ---
		if (!isAnyGemini) {
			new Setting(containerEl).setName("Transcription").setHeading();
			this.createApiUrlSetting();
			this.createModelSetting();
			this.createLanguageSetting();
			this.createPromptSetting();
			this.createSendCursorContextSetting();
			this.createTemperatureSetting();
			this.createResponseFormatSetting();
		}

		// --- Recording ---
		new Setting(containerEl).setName("Recording").setHeading();
		// async — populates device dropdown after enumeration completes
		void this.createAudioDeviceSetting();
		this.createSaveAudioFileToggleSetting();
		if (this.plugin.settings.saveAudioFile) {
			this.createSaveAudioFilePathSetting();
		}

		// --- Output ---
		new Setting(containerEl).setName("Output").setHeading();
		this.createNewFileToggleSetting();
		if (this.plugin.settings.createNoteFile) {
			this.createNewFilePathSetting();
			this.createNoteFilenameTemplateSetting();
			this.createNoteTemplateSetting();
		}

		// --- Post-Processing (hidden for Gemini paths) ---
		if (!isAnyGemini) {
			new Setting(containerEl).setName("Post-processing").setHeading();
			this.createPostProcessingToggleSetting();
			if (this.plugin.settings.postProcessing) {
				this.createPostProcessingProviderSetting();
				this.createPostProcessingUrlSetting();
				this.createPostProcessingModelSetting();
				this.createPostProcessingPromptSetting();
				this.createAutoGenerateTitleSetting();
				this.createTitleGenerationPromptSetting();
				this.createKeepOriginalTranscriptionSetting();
			}
		}

		// --- Advanced ---
		new Setting(containerEl).setName("Advanced").setHeading();
		if (isGeminiLive) {
			new Setting(containerEl)
				.setName("Gemini Live — API config")
				.setHeading();
			this.createGeminiLiveModelSetting();
			this.createGeminiLiveTranscriptionModeSetting();
			this.createGeminiLiveLanguageCodesSetting();
			this.createGeminiLiveCustomVocabularySetting();
			new Setting(containerEl)
				.setName("Gemini Live — editor")
				.setHeading();
			this.createGeminiLivePauseDelaySetting();
			this.createLiveInterimHighlightSettings();
		} else if (isGemini) {
			new Setting(containerEl)
				.setName("Gemini API — API config")
				.setHeading();
			this.createGeminiModelSetting();
			this.createGeminiTranscriptionModeSetting();
			this.createGeminiLanguageCodesSetting();
			this.createGeminiCustomVocabularySetting();
			if (this.plugin.settings.geminiTranscriptionMode === "verbatim") {
				this.createGeminiDiarizationSetting();
				this.createGeminiWordTimestampsSetting();
			}
		}
		this.createDebugModeToggleSetting();

		this.rebuilding = false;
		// Restore scroll position after re-render to prevent jumping
		containerEl.scrollTop = scrollTop;
	}

	private async save(): Promise<void> {
		await this.settingsManager.saveSettings(this.plugin.settings);
	}

	private scheduleDebouncedSave(): void {
		if (this.saveDebounceTimer !== null) {
			clearTimeout(this.saveDebounceTimer);
		}
		this.saveDebounceTimer = setTimeout(() => {
			this.saveDebounceTimer = null;
			void this.save();
		}, WhisperSettingsTab.SAVE_DEBOUNCE_MS);
	}

	private flushDebouncedSave(): void {
		if (this.saveDebounceTimer === null) {
			return;
		}
		clearTimeout(this.saveDebounceTimer);
		this.saveDebounceTimer = null;
		void this.save();
	}

	/**
	 * Textarea settings: update in-memory values immediately, persist to disk
	 * after idle or on blur/tab close. Gemini Live API config (system
	 * instruction, custom vocabulary, etc.) is not pushed to an active Live
	 * WebSocket — a new recording or failover reconnect reads the latest
	 * in-memory settings.
	 */
	private createDebouncedTextAreaSetting(
		name: string,
		desc: string,
		placeholder: string,
		value: string,
		rows: number,
		apply: (value: string) => void
	): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(desc)
			.addTextArea((text) => {
				text
					.setPlaceholder(placeholder)
					.setValue(value)
					.onChange((next) => {
						apply(next);
						this.scheduleDebouncedSave();
					});
				text.inputEl.rows = rows;
				text.inputEl.cols = 50;
				text.inputEl.addEventListener("blur", () => {
					this.flushDebouncedSave();
				});
			});
	}

	private createTextSetting(
		name: string,
		desc: string,
		placeholder: string,
		value: string,
		onChange: (value: string) => Promise<void>
	): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(desc)
			.addText((text) =>
				text
					.setPlaceholder(placeholder)
					.setValue(value)
					.onChange(async (value) => await onChange(value))
			);
	}

	private createApiKeySetting(
		name: string,
		desc: string,
		placeholder: string,
		value: string,
		field: Exclude<keyof ApiKeysSettings, "apiKey">,
		onChange: (value: string) => Promise<void>
	): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(
				desc +
					" The key lives in Obsidian secret storage on this device. Clear removes it from there."
			)
			.addText((text) => {
				text.inputEl.type = "password";
				text.setPlaceholder(placeholder)
					.setValue(value)
					.onChange(async (value) => {
						if (this.rebuilding) return;
						await onChange(value);
					});
			})
			.addButton((button) => {
				button.setButtonText("Clear").onClick(() => {
					this.settingsManager.clearApiKey(
						this.plugin.settings,
						field
					);
					this.display();
				});
			});
	}

	private createWhisperApiKeySetting(): void {
		new Setting(this.containerEl)
			.setName("Whisper API Key")
			.setDesc(
				"Select an Obsidian keychain secret for Whisper transcription (OpenAI, Groq, or Azure). Create or manage secrets in Settings → General → Keychain."
			)
			.addComponent((el) => {
				el.setAttribute("data-whisper-secret-component", "true");
				return new SecretComponent(this.app, el)
					.setValue(this.plugin.settings.whisperApiKeySecretId)
					.onChange(async (value) => {
						if (this.rebuilding) return;
						this.plugin.settings.whisperApiKeySecretId = value;
						await this.settingsManager.saveSettings(
							this.plugin.settings
						);
					});
			});
	}

	private createGeminiApiKeySetting(): void {
		this.createApiKeySetting(
			"Gemini API Key",
			"One Google AI Studio key for Gemini API and Gemini Live. Google uses the same key for REST and WebSocket.",
			"AIza...xxxx",
			this.plugin.settings.geminiApiKey,
			"geminiApiKey",
			async (value) => {
				this.plugin.settings.geminiApiKey = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
			}
		);
	}

	private createOpenAiApiKeySetting(): void {
		this.createApiKeySetting(
			"OpenAI API Key",
			"API key for GPT post-processing models",
			"sk-...xxxx",
			this.plugin.settings.openAiApiKey,
			"openAiApiKey",
			async (value) => {
				this.plugin.settings.openAiApiKey = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
			}
		);
	}

	private createAnthropicApiKeySetting(): void {
		this.createApiKeySetting(
			"Anthropic API Key",
			"API key for Claude post-processing models",
			"sk-ant-...xxxx",
			this.plugin.settings.anthropicApiKey,
			"anthropicApiKey",
			async (value) => {
				this.plugin.settings.anthropicApiKey = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
			}
		);
	}

	private createTranscriptionProviderSetting(): void {
		const providers = getTranscriptionProviderOptions(this.plugin.settings);

		new Setting(this.containerEl)
			.setName("Active provider")
			.setDesc(
				"OpenAI / Whisper-compatible endpoints use multipart uploads. Gemini API and Gemini Live share one Google AI Studio key. Live streams in real time."
			)
			.addDropdown((dropdown) => {
				for (const [value, label] of Object.entries(providers)) {
					dropdown.addOption(value, label);
				}
				dropdown
					.setValue(this.plugin.settings.transcriptionProvider)
					.onChange(async (value) => {
						this.plugin.settings.transcriptionProvider =
							value as TranscriptionProvider;
						await this.save();
						this.display();
					});
			});

		for (const module of TRANSCRIPTION_MODULES) {
			new Setting(this.containerEl)
				.setName(module.label)
				.setDesc(
					"When off, this provider is hidden from the dropdown and status-bar cycle."
				)
				.addToggle((toggle) => {
					toggle
						.setValue(
							isProviderEnabled(this.plugin.settings, module.id)
						)
						.onChange(async (enabled) => {
							const disabled = [
								...(this.plugin.settings
									.disabledTranscriptionProviders ?? []),
							];
							if (!enabled) {
								if (
									!disabled.includes(module.id) &&
									TRANSCRIPTION_MODULES.every(
										(m) =>
											m.id === module.id ||
											disabled.includes(m.id)
									)
								) {
									new Notice(
										"Keep at least one provider enabled"
									);
									toggle.setValue(true);
									return;
								}
								if (!disabled.includes(module.id)) {
									disabled.push(module.id);
								}
								this.plugin.settings.disabledTranscriptionProviders =
									disabled;
								if (
									this.plugin.settings.transcriptionProvider ===
									module.id
								) {
									this.plugin.settings.transcriptionProvider =
										getFirstEnabledProvider(
											this.plugin.settings
										);
								}
							} else {
								this.plugin.settings.disabledTranscriptionProviders =
									disabled.filter((id) => id !== module.id);
							}
							await this.save();
							this.display();
						});
				});
		}
	}

	private createGeminiLiveModelSetting(): void {
		this.createTextSetting(
			"Gemini model",
			"Model ID for Gemini Live streaming (e.g. gemini-3.5-transcribe-live)",
			"gemini-3.5-transcribe-live",
			this.plugin.settings.geminiLiveModel,
			async (value) => {
				this.plugin.settings.geminiLiveModel = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
			}
		);
	}

	private createGeminiLivePauseDelaySetting(): void {
		new Setting(this.containerEl)
			.setName("Pause delay")
			.setDesc(
				"How long to pause before in-progress speech is locked into the note. Lower values commit faster; higher values give you more time between words without locking. Subsequent speech always appends smoothly at the cursor."
			)
			.addDropdown((dropdown) => {
				dropdown.addOption("500", "Fast (500 ms)");
				dropdown.addOption("750", "Standard (750 ms)");
				dropdown.addOption("1200", "Relaxed (1.2 s)");
				dropdown.addOption("2000", "Long (2.0 s)");
				dropdown
					.setValue(
						String(
							this.plugin.settings.geminiLivePauseDelay || 750
						)
					)
					.onChange(async (value) => {
						this.plugin.settings.geminiLivePauseDelay =
							Number(value) || 750;
						await this.save();
						this.display();
					});
			});
	}

	private createGeminiLiveTranscriptionModeSetting(): void {
		this.createTranscriptionModeSetting(
			"Transcription mode",
			"Smart removes filler words and formats text. Verbatim preserves exact speech.",
			this.plugin.settings.geminiLiveTranscriptionMode,
			async (value) => {
				this.plugin.settings.geminiLiveTranscriptionMode = value;
				await this.save();
			}
		);
	}

	private createGeminiLiveLanguageCodesSetting(): void {
		this.createTextSetting(
			"Language codes",
			"Comma-separated BCP-47 codes (e.g. en-US, fr-CA). Leave empty for auto-detect.",
			"en-US",
			this.plugin.settings.geminiLiveLanguageCodes,
			async (value) => {
				this.plugin.settings.geminiLiveLanguageCodes = value;
				await this.save();
			}
		);
	}

	private createGeminiLiveCustomVocabularySetting(): void {
		this.createDebouncedTextAreaSetting(
			"Custom vocabulary",
			"Terms sent as inputAudioTranscription.customVocabulary (one per line or comma-separated, up to 1000).",
			"Gemini\nKubernetes\nBigQuery",
			this.plugin.settings.geminiLiveCustomVocabulary,
			4,
			(value) => {
				this.plugin.settings.geminiLiveCustomVocabulary = value;
			}
		);
	}

	private createLiveInterimHighlightSettings(): void {
		new Setting(this.containerEl)
			.setName("Highlight live text")
			.setDesc(
				"Show a background on interim (in-progress) transcription while Gemini Live is streaming."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.liveInterimHighlight)
					.onChange(async (value) => {
						this.plugin.settings.liveInterimHighlight = value;
						await this.save();
						this.display();
					})
			);

		if (!this.plugin.settings.liveInterimHighlight) {
			return;
		}

		const currentColor = this.plugin.settings.liveInterimHighlightColor;
		const presetMatch = Object.entries(LIVE_HIGHLIGHT_PRESETS).find(
			([, hex]) => hex.toLowerCase() === currentColor.toLowerCase()
		);

		new Setting(this.containerEl)
			.setName("Highlight color preset")
			.setDesc("Quick-pick a semi-transparent color for light and dark themes.")
			.addDropdown((dropdown) => {
				dropdown.addOption("custom", "Custom");
				for (const [label, hex] of Object.entries(LIVE_HIGHLIGHT_PRESETS)) {
					dropdown.addOption(hex, label);
				}
				dropdown
					.setValue(presetMatch ? presetMatch[1] : "custom")
					.onChange(async (value) => {
						if (value === "custom") return;
						this.plugin.settings.liveInterimHighlightColor = value;
						await this.save();
						this.display();
					});
			});

		new Setting(this.containerEl)
			.setName("Highlight color")
			.setDesc("Hex color (#RRGGBB or #RRGGBBAA). Invalid values fall back to light grey.")
			.addText((text) => {
				text
					.setPlaceholder(DEFAULT_LIVE_HIGHLIGHT_COLOR)
					.setValue(currentColor)
					.onChange(async (value) => {
						if (this.rebuilding) return;
						this.plugin.settings.liveInterimHighlightColor =
							normalizeHighlightColor(value);
						await this.save();
					});
			})
			.addExtraButton((button) => {
				button.setIcon("palette").setTooltip("Pick color");
				const input = document.createElement("input");
				input.type = "color";
				input.value = this.toColorInputValue(currentColor);
				input.style.width = "0";
				input.style.height = "0";
				input.style.opacity = "0";
				input.style.position = "absolute";
				input.addEventListener("change", () => {
					const hex = this.fromColorInputValue(input.value);
					this.plugin.settings.liveInterimHighlightColor = hex;
					void this.save().then(() => this.display());
				});
				button.extraSettingsEl.appendChild(input);
				button.onClick(() => input.click());
			});
	}

	private toColorInputValue(hex: string): string {
		const normalized = normalizeHighlightColor(hex);
		return normalized.slice(0, 7);
	}

	private fromColorInputValue(value: string): string {
		if (!value.startsWith("#") || value.length !== 7) {
			return DEFAULT_LIVE_HIGHLIGHT_COLOR;
		}
		return `${value}66`;
	}

	private createGeminiModelSetting(): void {
		this.createTextSetting(
			"Gemini model",
			"Model ID for Gemini transcription (e.g. gemini-3.5-transcribe)",
			"gemini-3.5-transcribe",
			this.plugin.settings.geminiModel,
			async (value) => {
				this.plugin.settings.geminiModel = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
			}
		);
	}

	private createGeminiTranscriptionModeSetting(): void {
		this.createTranscriptionModeSetting(
			"Transcription mode",
			"Smart cleans up speech for readability. Verbatim preserves exact words and enables diarization/timestamps.",
			this.plugin.settings.geminiTranscriptionMode,
			async (value) => {
				this.plugin.settings.geminiTranscriptionMode = value;
				await this.save();
				this.display();
			}
		);
	}

	private createGeminiLanguageCodesSetting(): void {
		this.createTextSetting(
			"Language codes",
			"Comma-separated BCP-47 codes sent as transcription_config.language_codes. Leave empty for auto-detect.",
			"en-US",
			this.plugin.settings.geminiLanguageCodes,
			async (value) => {
				this.plugin.settings.geminiLanguageCodes = value;
				await this.save();
			}
		);
	}

	private createGeminiCustomVocabularySetting(): void {
		this.createDebouncedTextAreaSetting(
			"Custom vocabulary",
			"Terms sent as transcription_config.custom_vocabulary (one per line or comma-separated, up to 1000).",
			"ZyntriQix, Digique Plus, gemini-3.5-transcribe",
			this.plugin.settings.geminiCustomVocabulary,
			4,
			(value) => {
				this.plugin.settings.geminiCustomVocabulary = value;
			}
		);
	}

	private createGeminiDiarizationSetting(): void {
		new Setting(this.containerEl)
			.setName("Speaker diarization")
			.setDesc(
				"Label speakers in verbatim batch transcription (transcription_config.mode.diarization_mode)."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.geminiDiarization)
					.onChange(async (value) => {
						this.plugin.settings.geminiDiarization = value;
						await this.save();
					})
			);
	}

	private createGeminiWordTimestampsSetting(): void {
		new Setting(this.containerEl)
			.setName("Word timestamps")
			.setDesc(
				"Include word-level timestamps in verbatim batch transcription (may reduce accuracy)."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.geminiWordTimestamps)
					.onChange(async (value) => {
						this.plugin.settings.geminiWordTimestamps = value;
						await this.save();
					})
			);
	}

	private createTranscriptionModeSetting(
		name: string,
		desc: string,
		value: GeminiTranscriptionMode,
		onChange: (value: GeminiTranscriptionMode) => Promise<void>
	): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(desc)
			.addDropdown((dropdown) => {
				dropdown.addOption("smart", "Smart");
				dropdown.addOption("verbatim", "Verbatim");
				dropdown.setValue(value).onChange(async (next) => {
					await onChange(next as GeminiTranscriptionMode);
				});
			});
	}

	private createApiUrlSetting(): void {
		this.createTextSetting(
			"API URL",
			"Specify the endpoint that will be used to make requests to",
			"https://api.your-custom-url.com",
			this.plugin.settings.apiUrl,
			async (value) => {
				this.plugin.settings.apiUrl = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
			}
		);
	}

	private createModelSetting(): void {
		this.createTextSetting(
			"Model",
			"Model for transcription (whisper-1 for OpenAI, whisper-large-v3 for Groq)",
			"whisper-1",
			this.plugin.settings.model,
			async (value) => {
				this.plugin.settings.model = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
			}
		);
	}

	private createPromptSetting(): void {
		this.createTextSetting(
			"Prompt",
			"Optional: Add words with their correct spellings to help with transcription. Make sure it matches the chosen language.",
			"Example: ZyntriQix, Digique Plus, CynapseFive",
			this.plugin.settings.prompt,
			async (value) => {
				this.plugin.settings.prompt = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
			}
		);
	}

	private createLanguageSetting(): void {
		this.createTextSetting(
			"Language",
			"Specify the language, or leave empty for auto-detection",
			"en (leave empty for auto-detect)",
			this.plugin.settings.language,
			async (value) => {
				this.plugin.settings.language = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
			}
		);
	}

	private async createAudioDeviceSetting(): Promise<void> {
		const setting = new Setting(this.containerEl).setName("Microphone");

		let osDefaultDeviceId: string | null = null;
		// Request permission first to get device labels (some browsers hide labels until permission is granted)
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: true,
			});
			osDefaultDeviceId = resolveOsDefaultDeviceId(stream);
			// Stop the stream immediately to release the microphone
			stream.getTracks().forEach((track) => track.stop());
		} catch (err) {
			// Permission denied or error - continue anyway, devices may still be listed
			console.log(
				"Microphone permission not granted, device labels may be limited"
			);
		}

		const devices = await listInputDevices();
		const options: Record<string, string> = {};
		for (const device of devices) {
			options[device.id] = device.label;
		}

		// Get current value, defaulting to "default" if not set or device not found
		let currentValue = this.plugin.settings.audioDeviceId || "default";
		if (currentValue !== "default" && !options[currentValue]) {
			// Device no longer available, reset to default
			currentValue = "default";
			this.plugin.settings.audioDeviceId = "default";
			await this.settingsManager.saveSettings(this.plugin.settings);
		}

		setting.setDesc(
			formatMicrophoneSettingDesc(
				getHostname(),
				currentValue,
				devices,
				osDefaultDeviceId
			)
		);

		setting.addDropdown((dropdown) => {
			Object.keys(options).forEach((deviceId) => {
				dropdown.addOption(deviceId, options[deviceId]);
			});
			dropdown.setValue(currentValue);
			dropdown.onChange(async (value) => {
				await applyAudioDeviceSelection(this.plugin, value);
				this.display();
			});
		});
	}

	private createSaveAudioFileToggleSetting(): void {
		new Setting(this.containerEl)
			.setName("Save audio file")
			.setDesc("Save the audio recording to the vault")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.saveAudioFile)
					.onChange(async (value) => {
						this.plugin.settings.saveAudioFile = value;
						if (!value) {
							this.plugin.settings.audioSavePath = "";
						}
						await this.save();
						this.display();
					})
			);
	}

	private createSaveAudioFilePathSetting(): void {
		new Setting(this.containerEl)
			.setName("Audio save path")
			.setDesc("Folder in the vault where audio files are saved")
			.addText((text) =>
				text
					.setPlaceholder("Example: folder/audio")
					.setValue(this.plugin.settings.audioSavePath)
					.onChange(async (value) => {
						this.plugin.settings.audioSavePath = value;
						await this.save();
					})
			);
	}

	private createTemperatureSetting(): void {
		this.createTextSetting(
			"Temperature",
			"Sampling temperature (0 to 1). Higher values produce more random output.",
			"0",
			String(this.plugin.settings.temperature),
			async (value) => {
				const num = parseFloat(value);
				this.plugin.settings.temperature = isNaN(num)
					? 0
					: Math.max(0, Math.min(1, num));
				await this.settingsManager.saveSettings(this.plugin.settings);
			}
		);
	}

	private createResponseFormatSetting(): void {
		this.createTextSetting(
			"Response format",
			"Output format: json, text, srt, verbose_json, or vtt",
			"json",
			this.plugin.settings.responseFormat,
			async (value) => {
				this.plugin.settings.responseFormat = value;
				await this.settingsManager.saveSettings(this.plugin.settings);
			}
		);
	}

	private createNewFileToggleSetting(): void {
		new Setting(this.containerEl)
			.setName("Create note file")
			.setDesc("Create a new note file for each transcription")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.createNoteFile)
					.onChange(async (value) => {
						this.plugin.settings.createNoteFile = value;
						if (!value) {
							this.plugin.settings.noteSavePath = "";
						}
						await this.save();
						this.display();
					});
			});
	}

	private createNewFilePathSetting(): void {
		new Setting(this.containerEl)
			.setName("Note save path")
			.setDesc("Folder in the vault where note files are saved")
			.addText((text) => {
				text.setPlaceholder("Example: folder/note")
					.setValue(this.plugin.settings.noteSavePath)
					.onChange(async (value) => {
						this.plugin.settings.noteSavePath = value;
						await this.save();
					});
			});
	}

	private createNoteFilenameTemplateSetting(): void {
		new Setting(this.containerEl)
			.setName("Note filename template")
			.setDesc(
				"Template for note filenames. Variables: {{date}}, {{time}}, {{datetime}}, {{title}}"
			)
			.addText((text) =>
				text
					.setPlaceholder("{{datetime}}")
					.setValue(this.plugin.settings.noteFilenameTemplate)
					.onChange(async (value) => {
						this.plugin.settings.noteFilenameTemplate = value;
						await this.settingsManager.saveSettings(
							this.plugin.settings
						);
					})
			);
	}

	private createNoteTemplateSetting(): void {
		this.createDebouncedTextAreaSetting(
			"Note template",
			"Template for note content. Variables: {{transcription}}, {{audioFile}}, {{date}}, {{time}}, {{datetime}}, {{title}}. Use ![[{{audioFile}}]] to embed or [[{{audioFile}}]] to link.",
			"![[{{audioFile}}]]\n{{transcription}}",
			this.plugin.settings.noteTemplate,
			4,
			(value) => {
				this.plugin.settings.noteTemplate = value;
			}
		);
	}

	private createSendCursorContextSetting(): void {
		new Setting(this.containerEl)
			.setName("Cursor context")
			.setDesc(
				"Send text around the cursor to Whisper for better transcription accuracy"
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.cursorContext)
					.onChange(async (value) => {
						this.plugin.settings.cursorContext = value;
						await this.settingsManager.saveSettings(
							this.plugin.settings
						);
					});
			});
	}

	private createPostProcessingToggleSetting(): void {
		new Setting(this.containerEl)
			.setName("Enable post-processing")
			.setDesc(
				"Clean up transcriptions with an LLM — fix grammar, remove filler words, improve readability"
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.postProcessing)
					.onChange(async (value) => {
						this.plugin.settings.postProcessing = value;
						await this.save();
						this.display();
					});
			});
	}

	private createPostProcessingProviderSetting(): void {
		const providers: Record<PostProcessingProvider, string> = {
			anthropic: "Anthropic",
			openai: "OpenAI",
			custom: "Custom",
		};

		new Setting(this.containerEl)
			.setName("Provider")
			.setDesc(
				"Anthropic and OpenAI use the API keys from the API Keys section above"
			)
			.addDropdown((dropdown) => {
				for (const [value, label] of Object.entries(providers)) {
					dropdown.addOption(value, label);
				}
				dropdown
					.setValue(this.plugin.settings.postProcessingProvider)
					.onChange(async (value) => {
						const provider = value as PostProcessingProvider;
						this.plugin.settings.postProcessingProvider = provider;
						if (provider !== "custom") {
							this.plugin.settings.postProcessingUrl =
								PROVIDER_URLS[provider];
							this.plugin.settings.postProcessingModel =
								PROVIDER_DEFAULT_MODELS[provider];
						}
						await this.save();
						this.display();
					});
			});
	}

	private createPostProcessingUrlSetting(): void {
		if (this.plugin.settings.postProcessingProvider !== "custom") return;

		new Setting(this.containerEl)
			.setName("Post-processing API URL")
			.setDesc("Endpoint for post-processing requests")
			.addText((text) =>
				text
					.setPlaceholder("https://api.example.com/v1/chat/completions")
					.setValue(this.plugin.settings.postProcessingUrl)
					.onChange(async (value) => {
						this.plugin.settings.postProcessingUrl = value;
						await this.save();
					})
			);
	}

	private createPostProcessingApiKeySetting(): void {
		if (this.plugin.settings.postProcessingProvider !== "custom") return;

		this.createApiKeySetting(
			"Post-processing API Key",
			"API key for the custom endpoint",
			"sk-...xxxx",
			this.plugin.settings.postProcessingApiKey,
			"postProcessingApiKey",
			async (value) => {
				this.plugin.settings.postProcessingApiKey = value;
				await this.save();
			}
		);
	}

	private createPostProcessingModelSetting(): void {
		new Setting(this.containerEl)
			.setName("Post-processing model")
			.setDesc("Model ID for the selected provider")
			.addText((text) =>
				text
					.setPlaceholder("claude-haiku-4-5-20251001")
					.setValue(this.plugin.settings.postProcessingModel)
					.onChange(async (value) => {
						this.plugin.settings.postProcessingModel = value;
						await this.save();
					})
			);
	}

	private createPostProcessingPromptSetting(): void {
		this.createDebouncedTextAreaSetting(
			"Post-processing prompt",
			"Instructions for the LLM on how to clean up the transcription",
			"You are a transcription editor...",
			this.plugin.settings.postProcessingPrompt,
			4,
			(value) => {
				this.plugin.settings.postProcessingPrompt = value;
			}
		);
	}

	private createAutoGenerateTitleSetting(): void {
		new Setting(this.containerEl)
			.setName("Auto-generate title")
			.setDesc("Use the LLM to generate a descriptive filename for notes")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.autoGenerateTitle)
					.onChange(async (value) => {
						this.plugin.settings.autoGenerateTitle = value;
						await this.save();
						this.display();
					});
			});
	}

	private createTitleGenerationPromptSetting(): void {
		if (!this.plugin.settings.autoGenerateTitle) return;

		this.createDebouncedTextAreaSetting(
			"Title generation prompt",
			"Instructions for the LLM on how to generate the title",
			"Generate a short title...",
			this.plugin.settings.titleGenerationPrompt,
			2,
			(value) => {
				this.plugin.settings.titleGenerationPrompt = value;
			}
		);
	}

	private createKeepOriginalTranscriptionSetting(): void {
		new Setting(this.containerEl)
			.setName("Keep original transcription")
			.setDesc(
				"Append the raw Whisper transcription below the post-processed text"
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.keepOriginalTranscription)
					.onChange(async (value) => {
						this.plugin.settings.keepOriginalTranscription = value;
						await this.save();
					});
			});
	}

	private createDebugModeToggleSetting(): void {
		new Setting(this.containerEl)
			.setName("Debug mode")
			.setDesc("Increase the plugin's verbosity for troubleshooting")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.debugMode)
					.onChange(async (value) => {
						this.plugin.settings.debugMode = value;
						await this.settingsManager.saveSettings(
							this.plugin.settings
						);
					});
			});
	}
}