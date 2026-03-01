/**
 * Local ASR entry: transcribe(blob, fileName?, modelId) => Promise<{ text }>.
 * Delegates to worker; handles chunking for long audio via pipeline options.
 */
import { Notice } from "obsidian";
import workerScript from "worker:./worker.ts";
import { DEFAULT_LOCAL_MODEL_ID } from "./modelRegistry";

let workerInstance: Worker | null = null;
let loadingState: "idle" | "loading" | "ready" = "idle";

function getWorker(): Worker {
	if (!workerInstance) {
		const url = URL.createObjectURL(
			new Blob([workerScript], { type: "text/javascript" })
		);
		workerInstance = new Worker(url);
		URL.revokeObjectURL(url);
	}
	return workerInstance;
}

/**
 * Detect if the environment can run in-browser ASR (Worker + WASM/ONNX support).
 */
export function canRunLocalAsr(): boolean {
	if (typeof Worker === "undefined") return false;
	try {
		const testBlob = new Blob(["self.close();"], {
			type: "application/javascript",
		});
		const url = URL.createObjectURL(testBlob);
		const w = new Worker(url);
		URL.revokeObjectURL(url);
		w.terminate();
		return true;
	} catch {
		return false;
	}
}

export function transcribeLocal(
	blob: Blob,
	fileName?: string,
	options?: { modelId: string }
): Promise<{ text: string }> {
	const modelId = options?.modelId ?? DEFAULT_LOCAL_MODEL_ID;
	if (loadingState === "idle") {
		loadingState = "loading";
	}
	return new Promise((resolve, reject) => {
		const worker = getWorker();
		const handler = (e: MessageEvent<{ text?: string; error?: string }>) => {
			worker.removeEventListener("message", handler);
			worker.removeEventListener("error", errHandler);
			if (e.data?.error) {
				loadingState = "idle";
				reject(new Error(e.data.error));
			} else {
				loadingState = "ready";
				resolve({ text: e.data?.text ?? "" });
			}
		};
		const errHandler = (err: ErrorEvent) => {
			worker.removeEventListener("message", handler);
			worker.removeEventListener("error", errHandler);
			loadingState = "idle";
			reject(err.message ?? new Error("Worker error"));
		};
		worker.addEventListener("message", handler);
		worker.addEventListener("error", errHandler);
		worker.postMessage({ blob, modelId });
	});
}

/**
 * On failure or cancel: offer retry, reset loading state, log to console.
 */
export function handleTranscribeFailure(err: unknown): void {
	loadingState = "idle";
	const msg = err instanceof Error ? err.message : String(err);
	console.error("[Whisper local ASR]", msg);
	new Notice("Local transcription failed. Check console for details.");
}
