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

	/**
	 * Insert or replace interim (partial) text at the cursor.
	 * On first call, records the anchor position. On subsequent calls,
	 * replaces from the anchor to the current end of interim text.
	 * Schedules an auto-commit timer to lock the text if speech pauses.
	 */
	updateInterim(text: string): void {
		if (!text) return;
		this.clearAutoCommitTimer();

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

		// Replace from anchor to current cursor position
		const cursor = editor.getCursor();
		const from = this.interimAnchor;

		// Clear the interim range, then insert new text
		editor.replaceRange("", from, cursor);
		editor.replaceRange(text, from);
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
	commitFinal(text: string): void {
		this.clearAutoCommitTimer();
		const editor = this.getEditor();
		if (!editor) {
			this.reset();
			return;
		}

		if (this.interimAnchor) {
			// Replace the interim span with finalized text
			const cursor = editor.getCursor();
			editor.replaceRange("", this.interimAnchor, cursor);
			editor.replaceRange(text, this.interimAnchor);

			const newPos = {
				line: this.interimAnchor.line,
				ch: this.interimAnchor.ch + text.length,
			};
			editor.setCursor(newPos);
			this.interimAnchor = null;
			this.currentInterimText = "";
			this.lastLockedText = "";
			this.clearInterimHighlight();
			return;
		}

		// If interim text was already locked by auto-commit:
		if (this.lastLockedText) {
			const locked = this.lastLockedText;
			this.lastLockedText = "";

			if (text === locked) {
				// Exact match already locked in document
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
		this.clearInterimHighlight();
	}

	/**
	 * Lock the current interim text as final without modifying it.
	 * The text is already in the editor from the last updateInterim call.
	 * Clears the anchor so subsequent speech starts as a fresh voice pass.
	 */
	lockInterim(): void {
		this.clearAutoCommitTimer();
		if (this.interimAnchor) {
			this.lastLockedText = this.currentInterimText;
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
