/**
 * Model registry: modelId → maxRecommendedDurationSeconds.
 * Used for settings display and chunking hints.
 */
export const MODEL_REGISTRY: Record<string, number> = {
	"Xenova/whisper-tiny.en": 30,
	"Xenova/whisper-small.en": 30,
	"Xenova/whisper-base.en": 30,
	"Xenova/whisper-tiny": 30,
	"Xenova/whisper-small": 30,
	"Xenova/whisper-base": 30,
};

export const DEFAULT_LOCAL_MODEL_ID = "Xenova/whisper-tiny.en";

export function getMaxRecommendedDuration(modelId: string): number {
	return MODEL_REGISTRY[modelId] ?? 30;
}
