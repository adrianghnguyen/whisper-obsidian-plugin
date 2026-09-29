import { describe, it, expect } from "vitest";
import { RecordingStatus } from "../src/StatusBar";

describe("RecordingStatus enum", () => {
	it("has expected values", () => {
		expect(RecordingStatus.Idle).toBe("idle");
		expect(RecordingStatus.Recording).toBe("recording");
		expect(RecordingStatus.Paused).toBe("paused");
		expect(RecordingStatus.Processing).toBe("processing");
	});

	it("truncates long microphone labels", async () => {
		const { StatusBar } = await import("../src/StatusBar");
		const bar = Object.create(StatusBar.prototype) as InstanceType<
			typeof StatusBar
		>;
		expect(bar.shortLabel("Default")).toBe("Default");
		expect(bar.shortLabel("abcdefghijklmnopqr")).toBe("abcdefghijklmnopqr");
		expect(bar.shortLabel("abcdefghijklmnopqrs")).toBe(
			"abcdefghijklmnopq..."
		);
	});

	it("formats combined provider and microphone labels", async () => {
		const { StatusBar } = await import("../src/StatusBar");
		const bar = Object.create(StatusBar.prototype) as InstanceType<
			typeof StatusBar
		>;
		expect(bar.combinedStatusLabel("Whisper", "Default")).toBe(
			"Whisper · Default"
		);
		expect(bar.combinedStatusLabel("Gemini Live", "Default")).toBe(
			"Gemini Live · Default"
		);
		expect(
			bar.combinedStatusLabel(
				"Whisper",
				"My Very Long Microphone Name Here"
			)
		).toBe("Whisper · My Very Long Mi...");
	});

	it("inserts the tolerance segment between provider and microphone", async () => {
		const { StatusBar } = await import("../src/StatusBar");
		const bar = Object.create(StatusBar.prototype) as InstanceType<
			typeof StatusBar
		>;
		expect(
			bar.combinedStatusLabel("Gemini Live", "Default", 34, "Standard")
		).toBe("Gemini Live · Standard · Default");
	});

	it("truncates the microphone before dropping the tolerance segment", async () => {
		const { StatusBar } = await import("../src/StatusBar");
		const bar = Object.create(StatusBar.prototype) as InstanceType<
			typeof StatusBar
		>;
		const label = bar.combinedStatusLabel(
			"Gemini Live",
			"My Very Long Microphone Name Here",
			34,
			"Standard"
		);
		expect(label).toContain("Gemini Live");
		expect(label).toContain("Standard");
		expect(label.endsWith("...")).toBe(true);
	});
});
