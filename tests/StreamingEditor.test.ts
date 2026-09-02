import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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

function makeEditor(
	highlight: () => LiveHighlightConfig = HIGHLIGHT_OFF,
	pauseDelay: () => number = () => 750
) {
	const fake = new FakeEditor();
	const streaming = new StreamingEditor(
		{
			workspace: {
				getActiveViewOfType: () => ({ editor: fake }),
			},
		} as any,
		highlight,
		pauseDelay
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

describe("StreamingEditor auto-commit voice buffer & multi-pass", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("auto-commits interim text after pause delay and clears anchor", () => {
		const { fake, streaming } = makeEditor(HIGHLIGHT_OFF, () => 500);
		streaming.updateInterim("First thought");
		expect(fake.content()).toBe("First thought");

		// Advance timer past pause delay
		vi.advanceTimersByTime(500);

		// Subsequent interim update should be treated as a fresh voice pass at the new anchor
		streaming.updateInterim("second thought");
		expect(fake.content()).toBe("First thought second thought");
	});

	it("resets auto-commit timer on continuous interim updates", () => {
		const { fake, streaming } = makeEditor(HIGHLIGHT_OFF, () => 500);
		streaming.updateInterim("Hello");
		vi.advanceTimersByTime(300);

		// User still talking before pause delay expires
		streaming.updateInterim("Hello world");
		vi.advanceTimersByTime(300);

		expect(fake.content()).toBe("Hello world");

		// Wait remaining time for timer to fire
		vi.advanceTimersByTime(200);

		// Now it should be locked; next pass should append
		streaming.updateInterim("next part");
		expect(fake.content()).toBe("Hello world next part");
	});

	it("reconciles matching server commitFinal after auto-commit without duplicating", () => {
		const { fake, streaming } = makeEditor(HIGHLIGHT_OFF, () => 500);
		streaming.updateInterim("Testing this");
		vi.advanceTimersByTime(500); // auto-committed

		// Server belatedly sends final transcription with exact text
		streaming.commitFinal("Testing this");
		expect(fake.content()).toBe("Testing this");
	});

	it("refines locked text if server commitFinal provides punctuation/casing update", () => {
		const { fake, streaming } = makeEditor(HIGHLIGHT_OFF, () => 500);
		streaming.updateInterim("testing this");
		vi.advanceTimersByTime(500); // auto-committed

		// Server sends capitalized and punctuated final
		streaming.commitFinal("Testing this.");
		expect(fake.content()).toBe("Testing this.");
	});

	it("handles standard commitFinal before auto-commit timer expires", () => {
		const { fake, streaming } = makeEditor(HIGHLIGHT_OFF, () => 500);
		streaming.updateInterim("Quick word");
		streaming.commitFinal("Quick word.");
		expect(fake.content()).toBe("Quick word.");

		// Timer should be cancelled so nothing breaks after 500ms
		vi.advanceTimersByTime(500);
		expect(fake.content()).toBe("Quick word.");
	});

	it("preserves active second voice pass when late commitFinal for first pass arrives", () => {
		const { fake, streaming } = makeEditor(HIGHLIGHT_OFF, () => 500);
		// Sentence 1 spoken
		streaming.updateInterim("First sentence.");
		vi.advanceTimersByTime(500); // Sentence 1 auto-committed
		expect(fake.content()).toBe("First sentence.");

		// Sentence 2 starts streaming
		streaming.updateInterim("Second sentence.");
		expect(fake.content()).toBe("First sentence. Second sentence.");

		// Server late finalization for Sentence 1 arrives while Sentence 2 is in interim
		streaming.commitFinal("First sentence.");
		// Sentence 2 MUST NOT be overwritten or destroyed!
		expect(fake.content()).toBe("First sentence. Second sentence.");

		// Sentence 2 gets finalized
		streaming.commitFinal("Second sentence.");
		expect(fake.content()).toBe("First sentence. Second sentence.");
	});

	it("handles cumulative server transcripts across multiple passes without duplicating", () => {
		const { fake, streaming } = makeEditor(HIGHLIGHT_OFF, () => 500);
		// Sentence 1
		streaming.updateInterim("First sentence.");
		vi.advanceTimersByTime(500); // auto-commit
		expect(fake.content()).toBe("First sentence.");

		// Server sends cumulative interim containing sentence 1 + sentence 2
		streaming.updateInterim("First sentence. Second sentence.");
		expect(fake.content()).toBe("First sentence. Second sentence.");

		// Server sends cumulative final
		streaming.commitFinal("First sentence. Second sentence.");
		expect(fake.content()).toBe("First sentence. Second sentence.");
	});

	it("handles 3+ consecutive speech passes seamlessly", () => {
		const { fake, streaming } = makeEditor(HIGHLIGHT_OFF, () => 500);
		// Pass 1
		streaming.updateInterim("One.");
		vi.advanceTimersByTime(500);
		expect(fake.content()).toBe("One.");

		// Pass 2
		streaming.updateInterim("Two.");
		vi.advanceTimersByTime(500);
		expect(fake.content()).toBe("One. Two.");

		// Pass 3
		streaming.updateInterim("Three.");
		vi.advanceTimersByTime(500);
		expect(fake.content()).toBe("One. Two. Three.");
	});

	it("continues the same voice pass after a long pause instead of splitting it", () => {
		const { fake, streaming } = makeEditor(HIGHLIGHT_OFF, () => 500);
		// Sentence 1 spoken, pause longer than the pause delay
		streaming.updateInterim("The quick brown fox");
		vi.advanceTimersByTime(5000);

		// Voice chunk 2 after the long pause: server keeps refining the SAME
		// utterance, so its next interim already contains the locked prefix.
		streaming.updateInterim("The quick brown fox jumps over the lazy dog");
		expect(fake.content()).toBe(
			"The quick brown fox jumps over the lazy dog"
		);

		// The utterance finalizes as one segment
		streaming.commitFinal("The quick brown fox jumps over the lazy dog");
		expect(fake.content()).toBe(
			"The quick brown fox jumps over the lazy dog"
		);
		expect(fake.content().split("The quick").length - 1).toBe(1);
	});

	it("keeps refining after auto-commit when server final only confirms the prefix", () => {
		const { fake, streaming } = makeEditor(HIGHLIGHT_OFF, () => 500);
		streaming.updateInterim("alpha beta");
		vi.advanceTimersByTime(5000);

		streaming.updateInterim("alpha beta gamma");
		expect(fake.content()).toBe("alpha beta gamma");

		// Server commits only the locked prefix (chunk 1 final, chunk 2 pending)
		streaming.commitFinal("alpha beta");
		expect(fake.content()).toBe("alpha beta gamma");

		// Chunk 2 finalizes without repeating the prefix
		streaming.commitFinal("gamma");
		expect(fake.content()).toBe("alpha beta gamma");
	});

	it("does not corrupt a fresh cumulative transcript that merely starts similarly", () => {
		const { fake, streaming } = makeEditor(HIGHLIGHT_OFF, () => 500);
		streaming.updateInterim("first thought");
		vi.advanceTimersByTime(5000);

		// Server restarts its transcript from scratch with similar wording:
		// the newest full text must survive verbatim, never truncated into
		// a hybrid of committed prefix + new text.
		streaming.updateInterim("first impressions matter");
		const content = fake.content();
		expect(content).toContain("first impressions matter");
		expect(content.includes("first impressions")).toBe(true);
		expect(/first impressions matter$/.test(content.trim())).toBe(true);
	});
});
