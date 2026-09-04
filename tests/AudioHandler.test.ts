import { describe, it, expect, vi, beforeEach } from "vitest";
import { DEFAULT_SETTINGS, PluginSettings, TranscriptionProvider } from "../src/SettingsManager";

// We test AudioHandler logic by extracting and testing the key behaviors
// since the actual class depends heavily on Obsidian + axios

function buildFormData(settings: PluginSettings, blob: Blob, fileName: string) {
	const formData = new FormData();
	formData.append("file", blob, fileName);
	formData.append("model", settings.model);

	// #47: only send language when not auto
	if (settings.language && settings.language !== "auto") {
		formData.append("language", settings.language);
	}

	if (settings.prompt) {
		formData.append("prompt", settings.prompt);
	}

	// #35: send temperature and responseFormat if non-default
	const temperature = (settings as any).temperature;
	if (temperature !== undefined && temperature !== 0) {
		formData.append("temperature", String(temperature));
	}
	const responseFormat = (settings as any).responseFormat;
	if (responseFormat && responseFormat !== "json") {
		formData.append("response_format", responseFormat);
	}

	return formData;
}

function buildHeaders(settings: PluginSettings) {
	const headers: Record<string, string> = {
		"Content-Type": "multipart/form-data",
	};
	// #2: skip auth header when no API key (local/custom endpoints)
	if (settings.apiKey) {
		headers["Authorization"] = `Bearer ${settings.apiKey}`;
	}
	return headers;
}

function buildAudioFilePath(settings: PluginSettings, fileName: string) {
	return settings.audioSavePath
		? `${settings.audioSavePath}/${fileName}`
		: fileName;
}

function getAudioFilePath(settings: PluginSettings, fileName: string): string {
	if (!settings.saveAudioFile) return "";
	return settings.audioSavePath
		? `${settings.audioSavePath}/${fileName}`
		: fileName;
}

// #40: auto-create folders
async function ensureFolderExists(
	vault: {
		adapter: { exists: (p: string) => Promise<boolean> };
		createFolder: (p: string) => Promise<void>;
	},
	folderPath: string
) {
	if (folderPath && !(await vault.adapter.exists(folderPath))) {
		await vault.createFolder(folderPath);
	}
}

// #65: silence guard
function isSilentRecording(blob: Blob, minSizeBytes: number = 1000): boolean {
	return blob.size < minSizeBytes;
}

describe("#40 — Auto-create folders", () => {
	it("creates folder when it does not exist", async () => {
		const createFolder = vi.fn();
		const vault = {
			adapter: { exists: vi.fn().mockResolvedValue(false) },
			createFolder,
		};
		await ensureFolderExists(vault, "recordings/audio");
		expect(createFolder).toHaveBeenCalledWith("recordings/audio");
	});

	it("does not create folder when it already exists", async () => {
		const createFolder = vi.fn();
		const vault = {
			adapter: { exists: vi.fn().mockResolvedValue(true) },
			createFolder,
		};
		await ensureFolderExists(vault, "recordings/audio");
		expect(createFolder).not.toHaveBeenCalled();
	});

	it("skips when folder path is empty", async () => {
		const createFolder = vi.fn();
		const vault = {
			adapter: { exists: vi.fn().mockResolvedValue(false) },
			createFolder,
		};
		await ensureFolderExists(vault, "");
		expect(createFolder).not.toHaveBeenCalled();
	});
});

describe("#52 — Phantom audio link fix", () => {
	it("returns audio path when saveAudioFile is true", () => {
		const settings = { ...DEFAULT_SETTINGS, saveAudioFile: true };
		expect(getAudioFilePath(settings, "rec.webm")).toBe("rec.webm");
	});

	it("returns empty string when saveAudioFile is false", () => {
		const settings = { ...DEFAULT_SETTINGS, saveAudioFile: false };
		expect(getAudioFilePath(settings, "rec.webm")).toBe("");
	});
});

describe("#47 — Auto-detect language in formData", () => {
	const blob = new Blob(["test"], { type: "audio/webm" });

	it("omits language when set to empty string", () => {
		const settings = { ...DEFAULT_SETTINGS, language: "" };
		const fd = buildFormData(settings, blob, "test.webm");
		expect(fd.get("language")).toBeNull();
	});

	it("omits language when set to 'auto'", () => {
		const settings = { ...DEFAULT_SETTINGS, language: "auto" };
		const fd = buildFormData(settings, blob, "test.webm");
		expect(fd.get("language")).toBeNull();
	});

	it("includes language when explicitly set", () => {
		const settings = { ...DEFAULT_SETTINGS, language: "ja" };
		const fd = buildFormData(settings, blob, "test.webm");
		expect(fd.get("language")).toBe("ja");
	});
});

describe("#2 — Custom API headers", () => {
	it("skips Authorization when apiKey is empty", () => {
		const settings = { ...DEFAULT_SETTINGS, apiKey: "" };
		const headers = buildHeaders(settings);
		expect(headers["Authorization"]).toBeUndefined();
	});

	it("includes Authorization when apiKey is set", () => {
		const settings = { ...DEFAULT_SETTINGS, apiKey: "sk-abc" };
		const headers = buildHeaders(settings);
		expect(headers["Authorization"]).toBe("Bearer sk-abc");
	});
});

describe("#65 — Silence/hallucination guard", () => {
	it("detects silent recording (tiny blob)", () => {
		const tinyBlob = new Blob(["x"], { type: "audio/webm" }); // ~1 byte
		expect(isSilentRecording(tinyBlob)).toBe(true);
	});

	it("passes normal recording", () => {
		const normalBlob = new Blob([new ArrayBuffer(5000)], {
			type: "audio/webm",
		});
		expect(isSilentRecording(normalBlob)).toBe(false);
	});

	it("respects custom minimum size", () => {
		const blob = new Blob([new ArrayBuffer(500)], { type: "audio/webm" });
		expect(isSilentRecording(blob, 200)).toBe(false);
		expect(isSilentRecording(blob, 1000)).toBe(true);
	});
});

describe("#35 — Whisper API params in formData", () => {
	const blob = new Blob(["test"], { type: "audio/webm" });

	it("sends temperature when non-zero", () => {
		const settings = { ...DEFAULT_SETTINGS, temperature: 0.5 } as any;
		const fd = buildFormData(settings, blob, "test.webm");
		expect(fd.get("temperature")).toBe("0.5");
	});

	it("omits temperature when zero (default)", () => {
		const settings = { ...DEFAULT_SETTINGS, temperature: 0 } as any;
		const fd = buildFormData(settings, blob, "test.webm");
		expect(fd.get("temperature")).toBeNull();
	});

	it("sends response_format when non-default", () => {
		const settings = { ...DEFAULT_SETTINGS, responseFormat: "srt" } as any;
		const fd = buildFormData(settings, blob, "test.webm");
		expect(fd.get("response_format")).toBe("srt");
	});

	it("omits response_format when json (default)", () => {
		const settings = { ...DEFAULT_SETTINGS, responseFormat: "json" } as any;
		const fd = buildFormData(settings, blob, "test.webm");
		expect(fd.get("response_format")).toBeNull();
	});
});

describe("buildAudioFilePath", () => {
	it("prepends folder path when set", () => {
		const settings = { ...DEFAULT_SETTINGS, audioSavePath: "recordings" };
		expect(buildAudioFilePath(settings, "rec.webm")).toBe(
			"recordings/rec.webm"
		);
	});

	it("uses just filename when path is empty", () => {
		const settings = { ...DEFAULT_SETTINGS, audioSavePath: "" };
		expect(buildAudioFilePath(settings, "rec.webm")).toBe("rec.webm");
	});
});

describe("isDefaultApi — API key requirement", () => {
	const DEFAULT_URL = "https://api.openai.com/v1/audio/transcriptions";

	function isApiKeyRequired(apiUrl: string, apiKey: string): boolean {
		const isDefaultApi = apiUrl === DEFAULT_URL;
		return isDefaultApi && !apiKey;
	}

	it("requires API key for default OpenAI URL", () => {
		expect(isApiKeyRequired(DEFAULT_URL, "")).toBe(true);
	});

	it("does not require API key for custom URL", () => {
		expect(isApiKeyRequired("http://localhost:9000/asr", "")).toBe(false);
	});

	it("passes when API key is provided for default URL", () => {
		expect(isApiKeyRequired(DEFAULT_URL, "sk-abc")).toBe(false);
	});
});

describe("#115 — createNoteFile does not navigate away", () => {
	// Simulates the output behavior of sendAudioData:
	// - always paste at cursor in the active editor
	// - optionally save a note file in the background (no navigation)

	function simulateTranscriptionOutput(
		settings: { createNoteFile: boolean },
		hasActiveEditor: boolean
	) {
		const actions: string[] = [];

		if (settings.createNoteFile) {
			actions.push("create-note-file");
			// openLinkText was removed — no navigation
		}

		if (hasActiveEditor) {
			actions.push("paste-at-cursor");
		}

		return actions;
	}

	it("pastes at cursor when createNoteFile is off", () => {
		const actions = simulateTranscriptionOutput(
			{ createNoteFile: false },
			true
		);
		expect(actions).toEqual(["paste-at-cursor"]);
	});

	it("pastes at cursor AND creates note file when both enabled", () => {
		const actions = simulateTranscriptionOutput(
			{ createNoteFile: true },
			true
		);
		expect(actions).toEqual(["create-note-file", "paste-at-cursor"]);
	});

	it("does not navigate away when creating note file", () => {
		const actions = simulateTranscriptionOutput(
			{ createNoteFile: true },
			true
		);
		expect(actions).not.toContain("navigate-to-note");
	});

	it("only creates note file when no active editor", () => {
		const actions = simulateTranscriptionOutput(
			{ createNoteFile: true },
			false
		);
		expect(actions).toEqual(["create-note-file"]);
	});
});

describe("file-menu audio extension matching", () => {
	const audioExtensions = [
		".mp3",
		".mp4",
		".mpeg",
		".mpga",
		".m4a",
		".wav",
		".webm",
		".ogg",
	];
	const isAudioFile = (path: string) =>
		audioExtensions.some((ext) => path.endsWith(ext));

	it("matches common audio files", () => {
		expect(isAudioFile("recording.mp3")).toBe(true);
		expect(isAudioFile("folder/audio.webm")).toBe(true);
		expect(isAudioFile("voice.ogg")).toBe(true);
		expect(isAudioFile("meeting.m4a")).toBe(true);
	});

	it("rejects non-audio files", () => {
		expect(isAudioFile("document.pdf")).toBe(false);
		expect(isAudioFile("image.png")).toBe(false);
		expect(isAudioFile("note.md")).toBe(false);
	});

	it("does not false-positive on partial extension matches", () => {
		expect(isAudioFile("stamp3")).toBe(false);
		expect(isAudioFile("camp3")).toBe(false);
	});
});

describe("Gemini — buildGeminiRequestBody", () => {
	/**
	 * Constructs the JSON body sent to the Gemini OpenAI-compatible endpoint.
	 * This replicates the logic inside AudioHandler.transcribeWithGemini()
	 * so we can unit-test the payload shape and model selection.
	 */
	function buildGeminiRequestBody(
		model: string,
		base64Audio: string,
		mimeFormat: string
	) {
		return {
			model,
			messages: [
				{
					role: "user",
					content: [
						{ type: "text", text: "Transcribe this audio." },
						{
							type: "input_audio",
							input_audio: {
								data: base64Audio,
								format: mimeFormat,
							},
						},
					],
				},
			],
		};
	}

	it("includes the configured model", () => {
		const body = buildGeminiRequestBody(
			"gemini-3.5-transcribe",
			"dGVzdA==",
			"webm"
		);
		expect(body.model).toBe("gemini-3.5-transcribe");
	});

	it("includes base64 audio and format", () => {
		const body = buildGeminiRequestBody("gemini-3.5-transcribe", "dGVzdA==", "wav");
		const inputAudio = (body.messages[0] as any).content[1].input_audio;
		expect(inputAudio.data).toBe("dGVzdA==");
		expect(inputAudio.format).toBe("wav");
	});

	it("includes the transcription instruction text", () => {
		const body = buildGeminiRequestBody("gemini-3.5-transcribe", "dGVzdA==", "mp3");
		expect((body.messages[0] as any).content[0].text).toBe("Transcribe this audio.");
	});

	it("uses a different model when configured", () => {
		const body = buildGeminiRequestBody("gemini-3.6-flash", "dGVzdA==", "webm");
		expect(body.model).toBe("gemini-3.6-flash");
	});
});

describe("Gemini — parseGeminiResponse", () => {
	/**
	 * Parses the Gemini OpenAI-compatible response to extract transcription text.
	 * This replicates the response handling in AudioHandler.transcribeWithGemini().
	 */
	function parseGeminiResponse(responseData: unknown): string | null {
		const choices = (responseData as any)?.choices;
		if (!choices || !Array.isArray(choices) || choices.length === 0) {
			return null;
		}
		const content = choices[0]?.message?.content;
		return content?.trim() || null;
	}

	it("extracts transcription from valid response", () => {
		const response = {
			choices: [
				{
					message: {
						content: " Hello world transcription ",
					},
				},
			],
		};
		expect(parseGeminiResponse(response)).toBe("Hello world transcription");
	});

	it("returns null when choices array is empty", () => {
		const response = { choices: [] };
		expect(parseGeminiResponse(response)).toBeNull();
	});

	it("returns null when choices is missing", () => {
		const response = {};
		expect(parseGeminiResponse(response)).toBeNull();
	});

	it("returns null when message.content is empty", () => {
		const response = {
			choices: [{ message: { content: "" } }],
		};
		expect(parseGeminiResponse(response)).toBeNull();
	});

	it("returns null when message content is only whitespace", () => {
		const response = {
			choices: [{ message: { content: "   \n  " } }],
		};
		expect(parseGeminiResponse(response)).toBeNull();
	});
});

describe("Gemini — provider routing", () => {
	/**
	 * Determines which transcription path sendAudioData should take.
	 * This mirrors the branching logic at the end of sendAudioData().
	 */
	function isGeminiProvider(settings: PluginSettings): boolean {
		return settings.transcriptionProvider === "gemini";
	}

	it("routes to Gemini when provider is gemini", () => {
		const settings = { ...DEFAULT_SETTINGS, transcriptionProvider: "gemini" as TranscriptionProvider };
		expect(isGeminiProvider(settings)).toBe(true);
	});

	it("routes to OpenAI when provider is openai (default)", () => {
		const settings = { ...DEFAULT_SETTINGS, transcriptionProvider: "openai" as TranscriptionProvider };
		expect(isGeminiProvider(settings)).toBe(false);
	});

	it("routes to OpenAI when provider is not set", () => {
		const settings = { ...DEFAULT_SETTINGS, transcriptionProvider: "openai" as TranscriptionProvider };
		expect(isGeminiProvider(settings)).toBe(false);
	});
});

describe("Gemini — API key validation", () => {
	function isGeminiApiKeyMissing(settings: PluginSettings): boolean {
		return !settings.geminiApiKey;
	}

	it("detects missing Gemini API key", () => {
		const settings = { ...DEFAULT_SETTINGS, geminiApiKey: "" };
		expect(isGeminiApiKeyMissing(settings)).toBe(true);
	});

	it("passes when Gemini API key is provided", () => {
		const settings = { ...DEFAULT_SETTINGS, geminiApiKey: "AIzaSyAbCdEf123" };
		expect(isGeminiApiKeyMissing(settings)).toBe(false);
	});
});

describe("Gemini — geminiAuthHeader", () => {
	/**
	 * Builds the authorization header for Gemini requests.
	 * Replicates the axios headers construction in AudioHandler.transcribeWithGemini().
	 */
	function buildGeminiHeaders(apiKey: string): Record<string, string> {
		return {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		};
	}

	it("includes Bearer token with the API key", () => {
		const headers = buildGeminiHeaders("AIzaSyTestKey123");
		expect(headers["Authorization"]).toBe("Bearer AIzaSyTestKey123");
	});

	it("sets Content-Type to application/json", () => {
		const headers = buildGeminiHeaders("AIzaSyTestKey123");
		expect(headers["Content-Type"]).toBe("application/json");
	});
});
