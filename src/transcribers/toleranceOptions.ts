/*
 * Single source of truth for the Gemini Live pause-tolerance choices.
 *
 * The value is stored in `settings.geminiLivePauseDelay` and drives the client
 * editor lock delay (when interim text is committed into the note). The
 * Settings dropdown and the status-bar click cycle both read from here so the
 * two surfaces can never drift apart.
 */

export interface PauseToleranceOption {
	ms: number;
	shortLabel: string;
	fullLabel: string;
}

export const PAUSE_TOLERANCE_OPTIONS: readonly PauseToleranceOption[] = [
	{ ms: 500, shortLabel: "Fast", fullLabel: "Fast (500 ms)" },
	{ ms: 750, shortLabel: "Standard", fullLabel: "Standard (750 ms)" },
	{ ms: 1200, shortLabel: "Relaxed", fullLabel: "Relaxed (1.2 s)" },
	{ ms: 2000, shortLabel: "Long", fullLabel: "Long (2.0 s)" },
];

export const DEFAULT_PAUSE_TOLERANCE_MS = 750;

/** Resolve a stored value to the closest known option (falls back to Standard). */
export function getToleranceOptionFor(ms: number): PauseToleranceOption {
	if (typeof ms !== "number" || !Number.isFinite(ms)) {
		return (
			PAUSE_TOLERANCE_OPTIONS.find(
				(option) => option.ms === DEFAULT_PAUSE_TOLERANCE_MS
			) ?? PAUSE_TOLERANCE_OPTIONS[0]
		);
	}
	let closest = PAUSE_TOLERANCE_OPTIONS[0];
	let closestDelta = Math.abs(closest.ms - ms);
	for (const option of PAUSE_TOLERANCE_OPTIONS) {
		const delta = Math.abs(option.ms - ms);
		if (delta < closestDelta) {
			closest = option;
			closestDelta = delta;
		}
	}
	return closest;
}

/** Next tolerance value in the cycle, wrapping at the end of the list. */
export function getNextToleranceMs(current: number): number {
	const options = PAUSE_TOLERANCE_OPTIONS;
	const resolved = getToleranceOptionFor(current);
	const index = options.findIndex((option) => option.ms === resolved.ms);
	return options[(index + 1) % options.length].ms;
}

/** Compact label for the status-bar text (e.g. "Standard"). */
export function getToleranceShortLabel(ms: number): string {
	return getToleranceOptionFor(ms).shortLabel;
}

/** Full label with the value, for hover tooltips (e.g. "Standard (750 ms)"). */
export function getToleranceFullLabel(ms: number): string {
	return getToleranceOptionFor(ms).fullLabel;
}