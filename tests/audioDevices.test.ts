import { describe, it, expect } from "vitest";
import {
	formatMicrophoneSettingDesc,
	resolveDeviceLabel,
	type InputDeviceOption,
} from "../src/audioDevices";

const devices: InputDeviceOption[] = [
	{ id: "default", label: "Default" },
	{ id: "hash-yeti", label: "Blue Yeti" },
	{ id: "hash-laptop", label: "Laptop Microphone" },
];

describe("resolveDeviceLabel", () => {
	it("returns the matching device label", () => {
		expect(resolveDeviceLabel("hash-yeti", devices)).toBe("Blue Yeti");
	});

	it("returns Default for the default id", () => {
		expect(resolveDeviceLabel("default", devices)).toBe("Default");
	});

	it("returns an unknown-device fallback for missing ids", () => {
		expect(resolveDeviceLabel("abcdef12xxxx", devices)).toBe(
			"Unknown device (abcdef12)"
		);
	});
});

describe("formatMicrophoneSettingDesc", () => {
	const syncNote =
		"Each computer stores its own choice in the synced settings file.";

	it("shows hostname and selected device label", () => {
		expect(
			formatMicrophoneSettingDesc("DESKTOP-A", "hash-yeti", devices)
		).toBe(`On DESKTOP-A: Blue Yeti. ${syncNote}`);
	});

	it("shows resolved OS default when selection is default", () => {
		expect(
			formatMicrophoneSettingDesc(
				"DESKTOP-A",
				"default",
				devices,
				"hash-yeti"
			)
		).toBe(`On DESKTOP-A: System default (Blue Yeti). ${syncNote}`);
	});

	it("falls back to Default when OS default cannot be resolved", () => {
		expect(
			formatMicrophoneSettingDesc("DESKTOP-A", "default", devices, null)
		).toBe(`On DESKTOP-A: Default. ${syncNote}`);
	});

	it("falls back to Default when OS default id is unknown", () => {
		expect(
			formatMicrophoneSettingDesc(
				"DESKTOP-A",
				"default",
				devices,
				"missing-id"
			)
		).toBe(`On DESKTOP-A: Default. ${syncNote}`);
	});

	it("shows unknown-device label for a missing specific selection", () => {
		expect(
			formatMicrophoneSettingDesc("LAPTOP", "deadbeefxxxx", devices)
		).toBe(`On LAPTOP: Unknown device (deadbeef). ${syncNote}`);
	});
});
