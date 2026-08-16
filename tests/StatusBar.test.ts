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
});
