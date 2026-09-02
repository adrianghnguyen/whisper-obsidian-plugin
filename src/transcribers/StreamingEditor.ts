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
			const trimmedSeg = seg.trim();
			if (!trimmedSeg) continue;
			const trimmedCur = current.trimStart();
			if (trimmedCur.startsWith(trimmedSeg)) {
				const idx = current.indexOf(trimmedSeg);
				current = current.slice(idx + trimmedSeg.length).trimStart();
			}
		}
		return current;
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

		const text = this.stripCommittedPrefix(incomingText);
		if (!text) return;

		const editor = this.getEditor();
		if (!editor) return;

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

		if (this.interimAnchor) {
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
			this.interimAnchor = null;
			this.currentInterimText = "";
			this.lastLockedText = "";
			this.clearInterimHighlight();
			return;
		}

		// If interim text was already locked by auto-commit (no active interim anchor):
		if (this.lastLockedText) {
			const locked = this.lastLockedText;
			this.lastLockedText = "";

			if (text === locked) {
				this.clearInterimHighlight();
				return;
			}

			// Check if we can refine the locked span right before cursor
			const cursor = editor.getCursor();
			const line = editor.getLine(cursor.line) ?? "";
			if (cursor.ch >= locked.length) {
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
					this.committedSegments.push(text);
					this.clearInterimHighlight();
					return;
				}
			}
		}

		// No interim anchor and no matching locked text — append at cursor with separator
		const cursor = editor.getCursor();
		const separator = this.separatorBeforeInsert(editor, cursor, text);
		editor.replaceRange(separator + text, cursor);
		const newPos = {
			line: cursor.line,
			ch: cursor.ch + separator.length + text.length,
		};
		editor.setCursor(newPos);
		this.committedSegments.push(text);
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
			this.lastLockedText = this.currentInterimText;
			this.committedSegments.push(this.currentInterimText);
			this.currentInterimText = "";
			this.interimAnchor = null;
		}
		this.clearInterimHighlight();
	}

	/**
	 * Clean up any pending interim state.
	 */
	reset(): void {
		this.clearAutoCommitTimer();
		this.interimAnchor = null;
		this.currentInterimText = "";
		this.lastLockedText = "";
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
