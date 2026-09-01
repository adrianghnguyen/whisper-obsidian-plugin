import { describe, it, expect, beforeEach } from "vitest";
import { StreamingEditor } from "../src/transcribers/StreamingEditor";
import type { LiveHighlightConfig } from "../src/transcribers/StreamingEditor";

interface DocLine {
	text: string;
}

class FakeEditor {
	lines: DocLine[] = [{ text: "" }];
	cursor = { line: 0, ch: 0 };

	getCursor() {
		return { ...this.cursor };
	}

	setCursor(pos: { line: number; ch: number }) {
		this.cursor = { ...pos };
	}

	getLine(n: number): string {
		return this.lines[n]?.text ?? "";
	}

	replaceRange(
		text: string,
		from: { line: number; ch: number },
		to?: { line: number; ch: number }
	) {
		const end = to ?? from;
		const line = this.lines[from.line];
		if (!line) return;
		line.text =
			line.text.slice(0, from.ch) +
			text +
			line.text.slice(end.ch);
		this.cursor = {
			line: from.line,
			ch: from.ch + text.length,
		};
	}

	content(): string {
		return this.lines.map((l) => l.text).join("\n");
	}
}

const HIGHLIGHT_OFF: () => LiveHighlightConfig = () => ({
	enabled: false,
	color: "",
});

function makeEditor(highlight: () => LiveHighlightConfig = HIGHLIGHT_OFF) {
	const fake = new FakeEditor();
	const streaming = new StreamingEditor(
		{
			workspace: {
				getActiveViewOfType: () => ({ editor: fake }),
			},
		} as any,
		highlight
	);
	return { fake, streaming };
}

describe("StreamingEditor segment spacing", () => {
	let fake: FakeEditor;
	let streaming: StreamingEditor;

	beforeEach(() => {
		({ fake, streaming } = makeEditor());
	});

	it("inserts a space between two committed final segments", () => {
		streaming.commitFinal("Hello world");
		streaming.commitFinal("how are you");
		expect(fake.content()).toBe("Hello world how are you");
	});

	it("inserts a space before an interim segment following a commit", () => {
		streaming.commitFinal("Hello world");
		streaming.updateInterim("how are");
		expect(fake.content()).toBe("Hello world how are");
	});

	it("does not double-space when existing text ends with whitespace", () => {
		streaming.commitFinal("Hello world ");
		streaming.commitFinal("how are you");
		expect(fake.content()).toBe("Hello world how are you");
	});

	it("does not add a space before punctuation-only segments", () => {
		streaming.commitFinal("Hello world");
		streaming.commitFinal(". Next");
		expect(fake.content()).toBe("Hello world. Next");
	});

	it("keeps anchor semantics: interim is replaced by its final", () => {
		streaming.updateInterim("Hel");
		streaming.updateInterim("Hello wor");
		streaming.commitFinal("Hello world");
		expect(fake.content()).toBe("Hello world");

		streaming.commitFinal("next segment");
		expect(fake.content()).toBe("Hello world next segment");
	});

	it("does not insert a separator for the very first segment", () => {
		streaming.commitFinal("First");
		expect(fake.content()).toBe("First");
	});
});
