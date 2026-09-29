import { describe, it, expect } from "vitest";
import {
	DEFAULT_PAUSE_TOLERANCE_MS,
	PAUSE_TOLERANCE_OPTIONS,
	getNextToleranceMs,
	getToleranceFullLabel,
	getToleranceOptionFor,
	getToleranceShortLabel,
} from "../src/transcribers/toleranceOptions";

describe("pause tolerance options", () => {
	it("exposes the known choices in ascending order", () => {
		expect(PAUSE_TOLERANCE_OPTIONS.map((option) => option.ms)).toEqual([
			500, 750, 1200, 2000,
		]);
	});

	it("uses Standard as the default", () => {
		expect(DEFAULT_PAUSE_TOLERANCE_MS).toBe(750);
		expect(getToleranceShortLabel(DEFAULT_PAUSE_TOLERANCE_MS)).toBe(
			"Standard"
		);
	});

	it("resolves an exact stored value", () => {
		expect(getToleranceOptionFor(1200).shortLabel).toBe("Relaxed");
	});

	it("falls back to the nearest option for unknown values", () => {
		expect(getToleranceOptionFor(900).ms).toBe(750);
		expect(getToleranceOptionFor(1900).ms).toBe(2000);
	});

	it("falls back to Standard for missing or invalid values", () => {
		expect(getToleranceOptionFor(undefined as unknown as number).ms).toBe(
			750
		);
		expect(getToleranceOptionFor(Number.NaN).ms).toBe(750);
	});

	it("cycles through the list and wraps", () => {
		expect(getNextToleranceMs(500)).toBe(750);
		expect(getNextToleranceMs(750)).toBe(1200);
		expect(getNextToleranceMs(1200)).toBe(2000);
		expect(getNextToleranceMs(2000)).toBe(500);
	});

	it("cycles from the nearest option when the stored value is off-list", () => {
		expect(getNextToleranceMs(900)).toBe(1200);
	});

	it("formats a full label with the value for tooltips", () => {
		expect(getToleranceFullLabel(750)).toBe("Standard (750 ms)");
		expect(getToleranceFullLabel(2000)).toBe("Long (2.0 s)");
	});
});