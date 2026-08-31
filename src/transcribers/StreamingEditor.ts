import { App, Editor, MarkdownView } from "obsidian";

/**
 * Manages streaming text insertion into the active editor.
 *
 * Tracks the character range of the current interim (partial) transcription
 * segment so it can be cleanly replaced when a finalized segment arrives.
 */
export class StreamingEditor {
	private interimAnchor: { line: number; ch: number } | null = null;
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Insert or replace interim (partial) text at the cursor.
	 * On first call, records the anchor position. On subsequent calls,
	 * replaces from the anchor to the current end of interim text.
	 */
	updateInterim(text: string): void {
		const editor = this.getEditor();
		if (!editor) return;

		if (!this.interimAnchor) {
			this.interimAnchor = editor.getCursor();
		}

		// Replace from anchor to current cursor position
		const cursor = editor.getCursor();
		const from = this.interimAnchor;

		// Clear the interim range, then insert new text
		editor.replaceRange("", from, cursor);
		editor.replaceRange(text, from);

		// Move cursor to end of inserted text
		const newPos = {
			line: from.line,
			ch: from.ch + text.length,
		};
		editor.setCursor(newPos);
	}

	/**
	 * Commit finalized text and reset the interim anchor.
	 */
	commitFinal(text: string): void {
		const editor = this.getEditor();
		if (!editor) return;

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
		} else {
			// No interim anchor — just append at cursor
			const cursor = editor.getCursor();
			editor.replaceRange(text, cursor);
			const newPos = {
				line: cursor.line,
				ch: cursor.ch + text.length,
			};
			editor.setCursor(newPos);
		}

		this.interimAnchor = null;
	}

	/**
	 * Lock the current interim text as final without modifying it.
	 * The text is already in the editor from the last updateInterim call.
	 * This just clears the anchor so the next streaming session starts fresh.
	 */
	lockInterim(): void {
		this.interimAnchor = null;
	}

	/**
	 * Clean up any pending interim state.
	 */
	reset(): void {
		this.interimAnchor = null;
	}

	private getEditor(): Editor | null {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		return view?.editor || null;
	}
}