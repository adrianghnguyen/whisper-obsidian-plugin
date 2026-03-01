/**
 * Web Worker: loads Transformers.js ASR pipeline, accepts blob, returns { text }.
 * Runs off main thread to keep UI responsive.
 * Caches pipeline by modelId for faster subsequent runs.
 */
import { pipeline } from "@huggingface/transformers";

export interface TranscribeRequest {
	blob: Blob;
	modelId: string;
}

export interface TranscribeResult {
	text: string;
}

export interface TranscribeError {
	error: string;
}

const transcriberCache = new Map<
	string,
	Awaited<ReturnType<typeof pipeline>>
>();

self.onmessage = async (e: MessageEvent<TranscribeRequest>) => {
	const { blob, modelId } = e.data;
	try {
		let transcriber = transcriberCache.get(modelId);
		if (!transcriber) {
			transcriber = await pipeline(
				"automatic-speech-recognition",
				modelId
			);
			transcriberCache.set(modelId, transcriber);
		}
		const objectUrl = URL.createObjectURL(blob);
		try {
			const result = await transcriber(objectUrl, {
				chunk_length_s: 30,
			});
			const res = Array.isArray(result) ? result[0] : result;
			const text =
				res && typeof res === "object" && "text" in res
					? String((res as { text: string }).text)
					: String(result ?? "");
			(self as unknown as Worker).postMessage({ text } as TranscribeResult);
		} finally {
			URL.revokeObjectURL(objectUrl);
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		(self as unknown as Worker).postMessage({
			error: message,
		} as TranscribeError);
	}
};
