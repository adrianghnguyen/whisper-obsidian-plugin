import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";

export const DEFAULT_LIVE_HIGHLIGHT_COLOR = "#CCCCCC66";

export const LIVE_HIGHLIGHT_PRESETS: Record<string, string> = {
	"Light grey": "#CCCCCC66",
	"Light yellow": "#FFD70040",
	"Light blue": "#4A90E240",
	"Light green": "#4CAF5040",
};

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;

export function isValidHighlightColor(color: string): boolean {
	return HEX_COLOR_RE.test(color.trim());
}

export function normalizeHighlightColor(
	color: string,
	fallback = DEFAULT_LIVE_HIGHLIGHT_COLOR
): string {
	const trimmed = color.trim();
	return isValidHighlightColor(trimmed) ? trimmed : fallback;
}

export interface LiveHighlightRange {
	from: number;
	to: number;
	color: string;
}

export const setLiveHighlightEffect = StateEffect.define<
	LiveHighlightRange | null
>();

export const liveHighlightField = StateField.define<DecorationSet>({
	create() {
		return Decoration.none;
	},
	update(decorations, tr) {
		decorations = decorations.map(tr.changes);
		for (const effect of tr.effects) {
			if (effect.is(setLiveHighlightEffect)) {
				if (!effect.value || effect.value.from >= effect.value.to) {
					decorations = Decoration.none;
				} else {
					const { from, to, color } = effect.value;
					decorations = Decoration.set([
						Decoration.mark({
							attributes: {
								style: `background-color: ${color}`,
							},
						}).range(from, to),
					]);
				}
			}
		}
		return decorations;
	},
	provide: (field) => EditorView.decorations.from(field),
});

export const liveHighlightExtension = liveHighlightField;

export function setLiveHighlight(
	view: EditorView,
	range: LiveHighlightRange
): void {
	view.dispatch({
		effects: setLiveHighlightEffect.of(range),
	});
}

export function clearLiveHighlight(view: EditorView): void {
	view.dispatch({
		effects: setLiveHighlightEffect.of(null),
	});
}
