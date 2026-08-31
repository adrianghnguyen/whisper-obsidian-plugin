import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import {
	DEFAULT_LIVE_HIGHLIGHT_COLOR,
	isValidHighlightColor,
	liveHighlightField,
	normalizeHighlightColor,
	setLiveHighlightEffect,
} from "../src/transcribers/liveHighlight";

describe("liveHighlight color helpers", () => {
	it("accepts 6- and 8-digit hex colors", () => {
		expect(isValidHighlightColor("#CCCCCC")).toBe(true);
		expect(isValidHighlightColor("#CCCCCC66")).toBe(true);
		expect(isValidHighlightColor("#abc123")).toBe(true);
	});

	it("rejects invalid hex colors", () => {
		expect(isValidHighlightColor("CCCCCC")).toBe(false);
		expect(isValidHighlightColor("#CCC")).toBe(false);
		expect(isValidHighlightColor("#GGGGGG")).toBe(false);
		expect(isValidHighlightColor("")).toBe(false);
	});

	it("normalizes invalid colors to the default", () => {
		expect(normalizeHighlightColor("#AABBCC")).toBe("#AABBCC");
		expect(normalizeHighlightColor("bad")).toBe(DEFAULT_LIVE_HIGHLIGHT_COLOR);
		expect(normalizeHighlightColor("bad", "#FF0000")).toBe("#FF0000");
	});
});

describe("liveHighlightField", () => {
	it("applies and clears highlight decorations", () => {
		let state = EditorState.create({
			doc: "hello world",
			extensions: [liveHighlightField],
		});

		state = state.update({
			effects: setLiveHighlightEffect.of({
				from: 0,
				to: 5,
				color: "#FFD70040",
			}),
		}).state;

		expect(state.field(liveHighlightField).size).toBe(1);

		state = state.update({
			effects: setLiveHighlightEffect.of(null),
		}).state;

		expect(state.field(liveHighlightField).size).toBe(0);
	});

	it("maps decorations through document changes", () => {
		let state = EditorState.create({
			doc: "hello world",
			extensions: [liveHighlightField],
		});

		state = state.update({
			effects: setLiveHighlightEffect.of({
				from: 6,
				to: 11,
				color: "#4A90E240",
			}),
		}).state;

		state = state.update({
			changes: { from: 0, to: 0, insert: "x" },
		}).state;

		const iter = state.field(liveHighlightField).iter();
		expect(iter.value).toBeTruthy();
		expect(iter.from).toBe(7);
		expect(iter.to).toBe(12);
	});
});
