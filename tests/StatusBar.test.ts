import { describe, it, expect, vi } from "vitest";
import { RecordingStatus, StatusBar } from "../src/StatusBar";
import { DEFAULT_SETTINGS } from "../src/SettingsManager";

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

describe("StatusBar click routing", () => {
	function barWithCycle(cycle: string): InstanceType<typeof StatusBar> & {
		cycleProvider: ReturnType<typeof vi.fn>;
		cyclePauseTolerance: ReturnType<typeof vi.fn>;
	} {
		const bar = Object.create(StatusBar.prototype) as InstanceType<
			typeof StatusBar
		> & {
			cycleProvider: ReturnType<typeof vi.fn>;
			cyclePauseTolerance: ReturnType<typeof vi.fn>;
		};
		bar.plugin = {
			settings: {
				...DEFAULT_SETTINGS,
				statusBarClickCycle:
					cycle as typeof DEFAULT_SETTINGS.statusBarClickCycle,
			},
		} as InstanceType<typeof StatusBar>["plugin"];
		bar.cycleProvider = vi.fn();
		bar.cyclePauseTolerance = vi.fn();
		return bar;
	}

	it("cycles pause delay by default", () => {
		const bar = barWithCycle("pause-delay");
		bar.handleStatusBarClick();
		expect(bar.cyclePauseTolerance).toHaveBeenCalledOnce();
		expect(bar.cycleProvider).not.toHaveBeenCalled();
	});

	it("cycles transcription provider when that mode is selected", () => {
		const bar = barWithCycle("transcription-provider");
		bar.handleStatusBarClick();
		expect(bar.cycleProvider).toHaveBeenCalledOnce();
		expect(bar.cyclePauseTolerance).not.toHaveBeenCalled();
	});

	it("falls back to pause delay for unknown saved values", () => {
		const bar = barWithCycle("mystery");
		bar.handleStatusBarClick();
		expect(bar.cyclePauseTolerance).toHaveBeenCalledOnce();
		expect(bar.cycleProvider).not.toHaveBeenCalled();
	});
});
