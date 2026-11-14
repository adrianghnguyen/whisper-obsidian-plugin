import { App, Editor, MarkdownView } from "obsidian";
import type { EditorView } from "@codemirror/view";
import {
	clearLiveHighlight,
	isValidHighlightColor,
	setLiveHighlight,
} from "./liveHighlight";

export interface LiveHighlightConfig {
	enabled: boolean;
	color: string;
}

/**
 * Manages streaming text insertion into the active editor.
 *
 * Tracks the character range of the current interim (partial) transcription
 * segment so it can be cleanly replaced when a finalized segment arrives.
 */
export class StreamingEditor {
	private interimAnchor: { line: number; ch: number } | null = null;
	private app: App;
	private getHighlightConfig: () => LiveHighlightConfig;
	private getPauseDelay: () => number;
	private autoCommitTimer: ReturnType<typeof setTimeout> | null = null;
	private currentInterimText = "";
	private lastLockedText = "";
	private lastLockedTextLength = 0;
	private lastLockedRange: {
		line: number;
		chFrom: number;
		chTo: number;
	} | null = null;
	/*
	 * Dictation start (command) through the latest pause-lock. A later
	 * full-turn rewrite is compared against this whole span, not only
	 * lastLockedText from the most recent chunk.
	 */
	private dictationOrigin: { line: number; ch: number } | null = null;
	private firstLockFrom: { line: number; ch: number } | null = null;
	private lastLockTo: { line: number; ch: number } | null = null;
	private sessionLockedText = "";
	private committedSegments: string[] = [];

	constructor(
		app: App,
		getHighlightConfig: () => LiveHighlightConfig = () => ({
			enabled: false,
			color: "",
		}),
		getPauseDelay: () => number = () => 750
	) {
		this.app = app;
		this.getHighlightConfig = getHighlightConfig;
		this.getPauseDelay = getPauseDelay;
	}

	/**
	 * Separator to insert before a new segment when the previous content
	 * does not already end with whitespace. Gemini Live transcription
	 * segments are committed independently and often lack leading spaces.
	 */
	private static joinSeparator(existing: string, incoming: string): string {
		if (!incoming || !existing) return "";
		if (/\s$/.test(existing)) return "";
		if (/^[,.!?;:)\]]/.test(incoming)) return "";
		if (/^[\s]/.test(incoming)) return "";
		return " ";
	}

	private separatorBeforeInsert(
		editor: Editor,
		pos: { line: number; ch: number },
		text: string
	): string {
		if (!text || !pos) return "";
		const lineText = editor.getLine(pos.line) ?? "";
		return StreamingEditor.joinSeparator(
			lineText.slice(0, pos.ch),
			text
		);
	}

	private clearAutoCommitTimer(): void {
		if (this.autoCommitTimer !== null) {
			clearTimeout(this.autoCommitTimer);
			this.autoCommitTimer = null;
		}
	}

	private stripCommittedPrefix(text: string): string {
		let current = text;
		for (const seg of this.committedSegments) {
			current = StreamingEditor.stripLeadingSegment(current, seg);
		}
		/*
		 * A new Live session (failover / overlapping PCM) often repeats the
		 * last committed utterance at the start of a concatenated stream.
		 * Keep stripping that last segment while it is a full prefix so we
		 * do not append "hello hello world".
		 */
		const last = this.lastNonEmptyCommitted();
		if (last) {
			while (current) {
				const next = StreamingEditor.stripLeadingSegment(current, last);
				if (next === current) break;
				current = next;
			}
			current = StreamingEditor.stripOverlappingHead(last, current);
		}
		return current;
	}

	private lastNonEmptyCommitted(): string {
		for (let i = this.committedSegments.length - 1; i >= 0; i--) {
			const seg = this.committedSegments[i]?.trim();
			if (seg) return this.committedSegments[i];
		}
		return "";
	}

	/*
	 * Pause-delay lock commits a first-pass interim. Gemini Live later
	 * often sends the same turn again as a cleaned full final ("going up
	 * at work" → "going at work"). Exact prefix strip misses that, so
	 * the second copy would append. Treat a long, same-start rewrite as
	 * one utterance.
	 */
	private static utteranceTokens(text: string): string[] {
		return StreamingEditor.tokenSpans(text).map((span) => span.norm);
	}

	private static tokenSpans(
		text: string
	): { norm: string; start: number; end: number }[] {
		const spans: { norm: string; start: number; end: number }[] = [];
		const re = /[a-z0-9]+/gi;
		let match: RegExpExecArray | null;
		while ((match = re.exec(text)) !== null) {
			spans.push({
				norm: match[0].toLowerCase(),
				start: match.index,
				end: match.index + match[0].length,
			});
		}
		return spans;
	}

	private static tokenLcsLength(a: string[], b: string[]): number {
		const rows = a.length + 1;
		const cols = b.length + 1;
		const prev = new Uint16Array(cols);
		const cur = new Uint16Array(cols);
		for (let i = 1; i < rows; i++) {
			cur[0] = 0;
			const token = a[i - 1];
			for (let j = 1; j < cols; j++) {
				cur[j] =
					token === b[j - 1]
						? prev[j - 1] + 1
						: Math.max(prev[j], cur[j - 1]);
			}
			prev.set(cur);
		}
		return prev[b.length];
	}

	private static isUtteranceRevision(
		previous: string,
		incoming: string
	): boolean {
		const a = StreamingEditor.utteranceTokens(previous);
		const b = StreamingEditor.utteranceTokens(incoming);
		if (a.length < 12 || b.length < 12) return false;
		if (b.length < a.length * 0.7) return false;
		const head = Math.min(6, a.length, b.length);
		let headMatch = 0;
		for (let i = 0; i < head; i++) {
			if (a[i] === b[i]) headMatch++;
		}
		if (headMatch < head - 1) return false;
		return StreamingEditor.tokenLcsLength(a, b) / a.length >= 0.82;
	}

	/*
	 * A late final that only restates an earlier prefix of the locked
	 * utterance (chunk 1 after chunk 2 already locked) must not replace
	 * the whole span.
	 */
	private static isPrefixConfirm(
		previous: string,
		incoming: string
	): boolean {
		const a = StreamingEditor.utteranceTokens(previous);
		const b = StreamingEditor.utteranceTokens(incoming);
		if (b.length === 0 || b.length >= a.length) return false;
		for (let i = 0; i < b.length; i++) {
			if (a[i] !== b[i]) return false;
		}
		return true;
	}

	/*
	 * Needle commits a word once two consecutive passes agree. The next
	 * 1 s window can re-emit that boundary word as the start of `text`,
	 * so "brown" + "brown fox" would otherwise lock twice.
	 */
	private static stripOverlappingHead(
		previous: string,
		incoming: string
	): string {
		const prevToks = StreamingEditor.utteranceTokens(previous);
		const incSpans = StreamingEditor.tokenSpans(incoming);
		if (!prevToks.length || !incSpans.length) return incoming;
		let currentSpans = incSpans;
		let current = incoming;
		const maxLoops = prevToks.length;
		for (let n = 0; n < maxLoops; n++) {
			const max = Math.min(prevToks.length, currentSpans.length);
			let k = 0;
			for (let len = max; len >= 1; len--) {
				let ok = true;
				for (let i = 0; i < len; i++) {
					if (
						prevToks[prevToks.length - len + i] !==
						currentSpans[i].norm
					) {
						ok = false;
						break;
					}
				}
				if (ok) {
					k = len;
					break;
				}
			}
			if (k === 0) break;
			if (k === currentSpans.length) {
				/*
				 * Incoming is only the overlapping suffix (same words,
				 * maybe new casing/punctuation). Leave it for confirm
				 * or refine instead of stripping to empty.
				 */
				break;
			}
			current = current.slice(currentSpans[k - 1].end).trimStart();
			currentSpans = StreamingEditor.tokenSpans(current);
			if (!current) break;
		}
		return current;
	}

	private recordLock(
		from: { line: number; ch: number },
		text: string
	): void {
		const chTo = from.ch + text.length;
		const editor = this.getEditor();
		const line = editor?.getLine(from.line) ?? "";
		if (
			!this.firstLockFrom ||
			this.firstLockFrom.line !== from.line
		) {
			let start = { line: from.line, ch: from.ch };
			const origin = this.dictationOrigin;
			if (
				origin &&
				origin.line === from.line &&
				origin.ch <= from.ch
			) {
				const between = line.slice(origin.ch, from.ch);
				if (/^\s*$/.test(between)) {
					start = { line: origin.line, ch: origin.ch };
				}
			}
			this.firstLockFrom = start;
		}
		this.lastLockTo = { line: from.line, ch: chTo };
		this.sessionLockedText = line.slice(this.firstLockFrom.ch, chTo);
		this.lastLockedText = this.sessionLockedText;
		this.lastLockedTextLength = this.sessionLockedText.length;
		this.lastLockedRange = {
			line: from.line,
			chFrom: this.firstLockFrom.ch,
			chTo,
		};
		this.committedSegments.push(text);
	}

	private rememberCommittedRange(
		from: { line: number; ch: number },
		text: string
	): void {
		this.lastLockedTextLength = text.length;
		this.lastLockedRange = {
			line: from.line,
			chFrom: from.ch,
			chTo: from.ch + text.length,
		};
	}

	private replaceLastCommittedSegment(text: string): void {
		const last = this.lastNonEmptyCommitted();
		const idx = last ? this.committedSegments.lastIndexOf(last) : -1;
		if (idx >= 0) {
			this.committedSegments[idx] = text;
		} else {
			this.committedSegments.push(text);
		}
	}

	private revisionSource(): string {
		const locked =
			this.sessionLockedText ||
			this.lastLockedText ||
			this.lastNonEmptyCommitted();
		if (locked && this.currentInterimText) {
			return `${locked} ${this.currentInterimText}`.trim();
		}
		return locked;
	}

	private shouldReplaceLastCommitted(incoming: string): boolean {
		const last = this.revisionSource();
		if (!last) return false;
		const stripped = this.stripCommittedPrefix(incoming);
		if (!stripped) return false;
		if (stripped.length < incoming.trimStart().length * 0.5) {
			return false;
		}
		return StreamingEditor.isUtteranceRevision(last, incoming);
	}

	private reopenLastCommittedAsInterim(): void {
		if (this.interimAnchor || !this.lastLockedRange) return;
		const last =
			this.sessionLockedText ||
			this.lastLockedText ||
			this.lastNonEmptyCommitted();
		if (!last) return;
		this.committedSegments = [];
		const from = this.firstLockFrom ?? {
			line: this.lastLockedRange.line,
			ch: this.lastLockedRange.chFrom,
		};
		this.interimAnchor = { line: from.line, ch: from.ch };
		this.currentInterimText = last;
		this.lastLockedText = "";
	}

	private tryReplaceLastCommittedSpan(
		editor: Editor,
		text: string
	): boolean {
		const range = this.lastLockedRange;
		if (!range) return false;
		const from = {
			line: range.line,
			ch: this.firstLockFrom?.ch ?? range.chFrom,
		};
		const to = {
			line: range.line,
			ch: this.lastLockTo?.ch ?? range.chTo,
		};
		editor.replaceRange(text, from, to);
		editor.setCursor({
			line: from.line,
			ch: from.ch + text.length,
		});
		this.committedSegments = [text];
		this.sessionLockedText = text;
		this.firstLockFrom = { ...from };
		this.lastLockTo = {
			line: from.line,
			ch: from.ch + text.length,
		};
		this.rememberCommittedRange(from, text);
		this.lastLockedText = "";
		this.interimAnchor = null;
		this.currentInterimText = "";
		return true;
	}

	private static stripLeadingSegment(text: string, segment: string): string {
		const trimmedSeg = segment.trim();
		if (!trimmedSeg) return text;
		const trimmedCur = text.trimStart();
		if (!trimmedCur.startsWith(trimmedSeg)) return text;
		const idx = text.indexOf(trimmedSeg);
		if (idx < 0) return text;
		return text.slice(idx + trimmedSeg.length).trimStart();
	}

	/** Skip a paste when the note already ends with this committed span. */
	private alreadyHasSuffix(
		editor: Editor,
		pos: { line: number; ch: number },
		text: string
	): boolean {
		if (!text) return false;
		const lineText = editor.getLine(pos.line) ?? "";
		const before = lineText.slice(0, pos.ch);
		return (
			before.endsWith(text) ||
			before.endsWith(" " + text) ||
			before.trimEnd() === text.trim()
		);
	}

	/**
	 * Insert or replace interim (partial) text at the cursor.
	 * On first call, records the anchor position. On subsequent calls,
	 * atomically replaces the exact interim range with new text.
	 * Schedules an auto-commit timer to lock the text if speech pauses.
	 */
	updateInterim(incomingText: string): void {
		if (!incomingText) return;
		this.clearAutoCommitTimer();

		if (
			!this.interimAnchor &&
			this.shouldReplaceLastCommitted(incomingText)
		) {
			this.reopenLastCommittedAsInterim();
		}

		const text = this.stripCommittedPrefix(incomingText);
		if (!text) return;

		const editor = this.getEditor();
		if (!editor) return;
		if (
			!this.interimAnchor &&
			this.alreadyHasSuffix(editor, editor.getCursor(), text)
		) {
			return;
		}

		if (!this.interimAnchor) {
			const cursor = editor.getCursor();
			const separator = this.separatorBeforeInsert(editor, cursor, text);
			this.interimAnchor = {
				line: cursor.line,
				ch: cursor.ch + separator.length,
			};
			if (separator) {
				editor.replaceRange(separator, cursor);
			}
		}

		const from = this.interimAnchor;
		const to = {
			line: from.line,
			ch: from.ch + this.currentInterimText.length,
		};

		// Atomically replace the interim span
		editor.replaceRange(text, from, to);
		this.currentInterimText = text;

		// Move cursor to end of inserted text
		const newPos = {
			line: from.line,
			ch: from.ch + text.length,
		};
		editor.setCursor(newPos);
		this.syncInterimHighlight(editor, from, newPos);

		const delay = Math.max(100, this.getPauseDelay());
		this.autoCommitTimer = setTimeout(() => {
			this.lockInterim();
		}, delay);
	}

	/**
	 * Commit finalized text and reset the interim anchor.
	 */
	commitFinal(incomingText: string): void {
		this.clearAutoCommitTimer();
		const editor = this.getEditor();
		if (!editor) {
			this.reset();
			return;
		}

		const text = this.stripCommittedPrefix(incomingText);
		if (!text) {
			this.lastLockedText = "";
			this.clearInterimHighlight();
			return;
		}

		// Check if this final event is simply confirming our previously locked segment
		if (this.lastLockedText && text === this.lastLockedText) {
			this.lastLockedText = "";
			this.clearInterimHighlight();
			return;
		}

		const revisionBase =
			this.sessionLockedText ||
			this.lastLockedText ||
			this.lastNonEmptyCommitted();
		if (
			!this.interimAnchor &&
			revisionBase &&
			StreamingEditor.isPrefixConfirm(revisionBase, text)
		) {
			this.clearInterimHighlight();
			return;
		}

		if (
			!this.interimAnchor &&
			this.shouldReplaceLastCommitted(incomingText) &&
			this.tryReplaceLastCommittedSpan(editor, incomingText.trimStart())
		) {
			this.clearInterimHighlight();
			return;
		}

		if (this.interimAnchor) {
			// A final that only re-confirms the locked prefix while a fresh
			// interim is active (mid-pause split finals) must not overwrite
			// the pending interim text with the stale prefix.
			if (
				this.lastLockedText &&
				text === this.lastLockedText &&
				this.currentInterimText
			) {
				return;
			}

			/*
			 * Full-turn rewrite while a later chunk is still interim: replace
			 * from the start of the locked utterance through the interim, not
			 * only the live span (that would leave the first lock in place).
			 */
			if (
				this.lastLockedRange &&
				this.lastLockedRange.line === this.interimAnchor.line &&
				this.shouldReplaceLastCommitted(incomingText)
			) {
				const from = {
					line: this.lastLockedRange.line,
					ch:
						this.firstLockFrom?.ch ??
						this.lastLockedRange.chFrom,
				};
				const to = {
					line: this.interimAnchor.line,
					ch:
						this.interimAnchor.ch +
						this.currentInterimText.length,
				};
				const replacement = incomingText.trimStart();
				editor.replaceRange(replacement, from, to);
				editor.setCursor({
					line: from.line,
					ch: from.ch + replacement.length,
				});
				this.committedSegments = [replacement];
				this.sessionLockedText = replacement;
				this.firstLockFrom = { ...from };
				this.lastLockTo = {
					line: from.line,
					ch: from.ch + replacement.length,
				};
				this.rememberCommittedRange(from, replacement);
				this.lastLockedText = "";
				this.interimAnchor = null;
				this.currentInterimText = "";
				this.clearInterimHighlight();
				return;
			}
			const from = this.interimAnchor;
			const to = {
				line: from.line,
				ch: from.ch + this.currentInterimText.length,
			};
			editor.replaceRange(text, from, to);

			const newPos = {
				line: from.line,
				ch: from.ch + text.length,
			};
			editor.setCursor(newPos);
			this.committedSegments.push(text);
			this.rememberCommittedRange(from, text);
			this.interimAnchor = null;
			this.currentInterimText = "";
			this.lastLockedText = "";
			this.clearInterimHighlight();
			return;
		}

		// If interim text was already locked by auto-commit (no active interim anchor):
		if (this.lastLockedText) {
			const locked = this.lastLockedText;

			if (text === locked) {
				this.lastLockedText = "";
				this.clearInterimHighlight();
				return;
			}

			if (StreamingEditor.isPrefixConfirm(locked, text)) {
				this.clearInterimHighlight();
				return;
			}

			const lockedTokens = StreamingEditor.utteranceTokens(locked);
			const incomingTokens = StreamingEditor.utteranceTokens(text);
			const canRefineSpan =
				lockedTokens.length === 0 ||
				incomingTokens.length >= lockedTokens.length * 0.7;

			// Check if we can refine the locked span right before cursor
			const cursor = editor.getCursor();
			const line = editor.getLine(cursor.line) ?? "";
			if (canRefineSpan && cursor.ch >= locked.length) {
				const before = line.slice(cursor.ch - locked.length, cursor.ch);
				if (before === locked) {
					const from = {
						line: cursor.line,
						ch: cursor.ch - locked.length,
					};
					editor.replaceRange(text, from, cursor);
					editor.setCursor({
						line: from.line,
						ch: from.ch + text.length,
					});
					this.replaceLastCommittedSegment(text);
					this.rememberCommittedRange(from, text);
					this.lastLockedText = "";
					this.clearInterimHighlight();
					return;
				}
			}
			this.lastLockedText = "";
		}

		// No interim anchor and no matching locked text — append at cursor with separator
		const cursor = editor.getCursor();
		if (this.alreadyHasSuffix(editor, cursor, text)) {
			this.committedSegments.push(text);
			this.clearInterimHighlight();
			return;
		}
		const separator = this.separatorBeforeInsert(editor, cursor, text);
		editor.replaceRange(separator + text, cursor);
		const newPos = {
			line: cursor.line,
			ch: cursor.ch + separator.length + text.length,
		};
		editor.setCursor(newPos);
		this.committedSegments.push(text);
		this.rememberCommittedRange(
			{ line: cursor.line, ch: cursor.ch + separator.length },
			text
		);
		this.clearInterimHighlight();
	}

	/**
	 * Lock the current interim text as final without modifying it.
	 * The text is already in the editor from the last updateInterim call.
	 * Clears the anchor so subsequent speech starts as a fresh voice pass.
	 */
	lockInterim(): void {
		this.clearAutoCommitTimer();
		if (this.interimAnchor && this.currentInterimText) {
			this.recordLock(this.interimAnchor, this.currentInterimText);
			this.currentInterimText = "";
			this.interimAnchor = null;
		}
		this.clearInterimHighlight();
	}

	/**
	 * Dictation start command: origin for the first-lock → last-lock span.
	 * A later rewritten final is compared against that whole utterance.
	 */
	beginDictation(): void {
		this.reset();
		const editor = this.getEditor();
		const cursor = editor?.getCursor();
		this.dictationOrigin = cursor
			? { line: cursor.line, ch: cursor.ch }
			: null;
	}

	/**
	 * Called by the transcriber after an audio interruption (dropped chunk
	 * or reconnect). The auto-commit already locked what was on screen; the
	 * locked text becomes the active transcript prefix again so the next
	 * interim/final — which typically repeats the whole utterance — is
	 * treated as a continuation of the same voice pass instead of a split.
	 */
	recoverInterim(): void {
		this.clearAutoCommitTimer();
		const locked =
			this.sessionLockedText || this.lastLockedText;
		if (locked && !this.interimAnchor) {
			this.interimAnchor = this.lastRecoveryAnchor;
			this.currentInterimText = locked;
			this.committedSegments = [];
			this.lastLockedText = "";
			this.lastLockedTextLength = 0;
			this.lastLockedRange = null;
			this.firstLockFrom = null;
			this.lastLockTo = null;
			this.sessionLockedText = "";
		}
		this.clearInterimHighlight();
	}

	private get lastRecoveryAnchor(): {
		line: number;
		ch: number;
	} | null {
		if (!this.lastLockedRange) return null;
		const { line, chFrom, chTo } = this.lastLockedRange;
		return {
			line,
			ch: chTo - this.lastLockedTextLength,
		};
	}

	/**
	 * Clean up any pending interim state.
	 */
	reset(): void {
		this.clearAutoCommitTimer();
		this.interimAnchor = null;
		this.currentInterimText = "";
		this.lastLockedText = "";
		this.lastLockedTextLength = 0;
		this.lastLockedRange = null;
		this.dictationOrigin = null;
		this.firstLockFrom = null;
		this.lastLockTo = null;
		this.sessionLockedText = "";
		this.committedSegments = [];
		this.clearInterimHighlight();
	}

	private syncInterimHighlight(
		editor: Editor,
		from: { line: number; ch: number },
		to: { line: number; ch: number }
	): void {
		const config = this.getHighlightConfig();
		if (!config.enabled || !isValidHighlightColor(config.color)) {
			this.clearInterimHighlight();
			return;
		}

		const view = this.getEditorView();
		if (!view) return;

		const fromOffset = editor.posToOffset(from);
		const toOffset = editor.posToOffset(to);
		if (fromOffset >= toOffset) {
			clearLiveHighlight(view);
			return;
		}

		setLiveHighlight(view, {
			from: fromOffset,
			to: toOffset,
			color: config.color,
		});
	}

	private clearInterimHighlight(): void {
		const view = this.getEditorView();
		if (view) {
			clearLiveHighlight(view);
		}
	}

	private getEditor(): Editor | null {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		return view?.editor || null;
	}

	private getEditorView(): EditorView | null {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return null;
		const cm = (view.editor as { cm?: EditorView }).cm;
		return cm ?? null;
	}
}
