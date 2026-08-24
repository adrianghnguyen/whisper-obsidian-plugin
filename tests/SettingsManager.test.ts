import { describe, it, expect } from "vitest";
import {
	DEFAULT_SETTINGS,
	resolveDesktopHostname,
	resolveHostAudioDeviceId,
	resolveMobileAudioDeviceId,
} from "../src/SettingsManager";

describe("DEFAULT_SETTINGS", () => {
	it("has correct API defaults", () => {
		expect(DEFAULT_SETTINGS.apiUrl).toBe(
			"https://api.openai.com/v1/audio/transcriptions"
		);
		expect(DEFAULT_SETTINGS.model).toBe("whisper-1");
		expect(DEFAULT_SETTINGS.apiKey).toBe("");
	});

	it("defaults language to empty (auto-detect)", () => {
		expect(DEFAULT_SETTINGS.language).toBe("");
	});

	it("saves audio and creates note file by default", () => {
		expect(DEFAULT_SETTINGS.saveAudioFile).toBe(true);
		expect(DEFAULT_SETTINGS.createNoteFile).toBe(true);
	});

	it("disables optional features by default", () => {
		expect(DEFAULT_SETTINGS.cursorContext).toBe(false);
		expect(DEFAULT_SETTINGS.debugMode).toBe(false);
	});

	it("has safe Whisper API param defaults", () => {
		expect(DEFAULT_SETTINGS.temperature).toBe(0);
		expect(DEFAULT_SETTINGS.responseFormat).toBe("json");
	});

	it("defaults to system audio device", () => {
		expect(DEFAULT_SETTINGS.audioDeviceId).toBe("default");
		expect(DEFAULT_SETTINGS.audioDeviceIds).toEqual({});
	});
});

describe("resolveHostAudioDeviceId", () => {
	it("prefers this host's map entry", () => {
		const result = resolveHostAudioDeviceId(
			{
				...DEFAULT_SETTINGS,
				audioDeviceId: "stale",
				audioDeviceIds: { "DESKTOP-A": "hash-a", LAPTOP: "hash-b" },
			},
			"DESKTOP-A",
			"local-old"
		);
		expect(result.audioDeviceId).toBe("hash-a");
		expect(result.persist).toBe(false);
	});

	it("migrates localStorage when this host is missing", () => {
		const result = resolveHostAudioDeviceId(
			{ ...DEFAULT_SETTINGS, audioDeviceIds: { LAPTOP: "hash-b" } },
			"DESKTOP-A",
			"local-mic"
		);
		expect(result.audioDeviceId).toBe("local-mic");
		expect(result.audioDeviceIds["DESKTOP-A"]).toBe("local-mic");
		expect(result.audioDeviceIds.LAPTOP).toBe("hash-b");
		expect(result.persist).toBe(true);
	});

	it("migrates a flat audioDeviceId when map and localStorage are empty", () => {
		const result = resolveHostAudioDeviceId(
			{ ...DEFAULT_SETTINGS, audioDeviceId: "flat-hash" },
			"DESKTOP-A",
			null
		);
		expect(result.audioDeviceId).toBe("flat-hash");
		expect(result.audioDeviceIds["DESKTOP-A"]).toBe("flat-hash");
		expect(result.persist).toBe(true);
	});
});

describe("resolveDesktopHostname", () => {
	it("prefers os.hostname on Mac and Windows", () => {
		expect(
			resolveDesktopHostname("Adrians-MacBook-Pro.local", {
				COMPUTERNAME: "DESKTOP-WIN",
			})
		).toBe("Adrians-MacBook-Pro.local");
		expect(resolveDesktopHostname("DESKTOP-C42C606C", {})).toBe(
			"DESKTOP-C42C606C"
		);
	});

	it("falls back to COMPUTERNAME then HOSTNAME", () => {
		expect(
			resolveDesktopHostname("", {
				COMPUTERNAME: "DESKTOP-WIN",
				HOSTNAME: "linux-box",
			})
		).toBe("DESKTOP-WIN");
		expect(resolveDesktopHostname(undefined, { HOSTNAME: "linux-box" })).toBe(
			"linux-box"
		);
	});

	it("returns unknown when nothing is available", () => {
		expect(resolveDesktopHostname(undefined, {})).toBe("unknown");
	});
});

describe("resolveMobileAudioDeviceId", () => {
	it("uses localStorage and ignores synced map leftovers", () => {
		expect(resolveMobileAudioDeviceId("pixel-mic")).toBe("pixel-mic");
	});

	it("defaults when this phone has no local choice", () => {
		expect(resolveMobileAudioDeviceId(null)).toBe("default");
		expect(resolveMobileAudioDeviceId("")).toBe("default");
	});
});
