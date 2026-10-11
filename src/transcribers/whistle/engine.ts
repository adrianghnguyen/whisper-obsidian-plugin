import { requestUrl } from "obsidian";
import type {
	WhistleCallOptions,
	WhistleStreamResult,
	WhistleTranscript,
} from "./options";
import { instantiateNeedleEngine } from "./needleInstantiate";

export const DEFAULT_WHISTLE_WASM_URL =
	"https://huggingface.co/Cactus-Compute/needle3/resolve/main/wasm/needle.wasm";
export const DEFAULT_WHISTLE_WEIGHTS_URL =
	"https://huggingface.co/Cactus-Compute/whistle/resolve/main/whistle.cact";

export const WHISTLE_CACHE_WASM = "needle.wasm";
export const WHISTLE_CACHE_WEIGHTS = "whistle.cact";

export type WhistleEngineProgress = {
	status: "downloading" | "loading" | "ready" | "error";
	progress?: number;
	file?: string;
};

export class WhistleEngineError extends Error {
	code: "download-failed" | "load-failed" | "transcribe-failed" | "stream-failed";

	constructor(
		message: string,
		code: "download-failed" | "load-failed" | "transcribe-failed" | "stream-failed"
	) {
		super(message);
		this.name = "WhistleEngineError";
		this.code = code;
	}
}

export interface WhistleEngine {
	transcribe(
		pcm: Float32Array,
		options?: WhistleCallOptions
	): WhistleTranscript | Promise<WhistleTranscript>;
	streamProcess?(
		pcm: Float32Array,
		options?: WhistleCallOptions
	): WhistleStreamResult | Promise<WhistleStreamResult>;
	streamStop?(): WhistleStreamResult | Promise<WhistleStreamResult>;
}

export interface WhistleByteCache {
	read(name: string): Promise<Uint8Array | null>;
	write(name: string, data: Uint8Array): Promise<void>;
}

export type FetchBytesFn = (
	url: string,
	onProgress?: (loaded: number, total: number | null) => void
) => Promise<Uint8Array>;

export type InstantiateFn = (
	wasm: Uint8Array,
	weights: Uint8Array
) => Promise<WhistleEngine>;

export interface LoadWhistleEngineOptions {
	cache: WhistleByteCache;
	fetchBytes?: FetchBytesFn;
	instantiate?: InstantiateFn;
	onProgress?: (event: WhistleEngineProgress) => void;
}

let singletonEngine: WhistleEngine | null = null;
let singletonPromise: Promise<WhistleEngine> | null = null;

export function resetWhistleEngine(): void {
	singletonEngine = null;
	singletonPromise = null;
}

async function defaultFetchBytes(
	url: string,
	onProgress?: (loaded: number, total: number | null) => void
): Promise<Uint8Array> {
	const response = await requestUrl({ url, method: "GET" });
	const total = response.headers["content-length"]
		? parseInt(response.headers["content-length"], 10)
		: null;
	const body = response.arrayBuffer;
	onProgress?.(body.byteLength, total);
	return new Uint8Array(body);
}

async function defaultInstantiate(
	wasm: Uint8Array,
	weights: Uint8Array
): Promise<WhistleEngine> {
	try {
		return await instantiateNeedleEngine(wasm, weights);
	} catch (err) {
		throw new WhistleEngineError(
			err instanceof Error ? err.message : String(err),
			"load-failed"
		);
	}
}

async function loadInternal(options: LoadWhistleEngineOptions): Promise<WhistleEngine> {
	const fetchBytes = options.fetchBytes ?? defaultFetchBytes;
	const instantiate = options.instantiate ?? defaultInstantiate;
	const { cache, onProgress } = options;

	onProgress?.({ status: "loading" });

	let wasm = await cache.read(WHISTLE_CACHE_WASM);
	let weights = await cache.read(WHISTLE_CACHE_WEIGHTS);

	async function fetchAndCache(
		name: string,
		url: string
	): Promise<Uint8Array> {
		onProgress?.({ status: "downloading", file: name });
		try {
			const bytes = await fetchBytes(url, (loaded, total) => {
				onProgress?.({
					status: "downloading",
					file: name,
					progress: total ? loaded / total : undefined,
				});
			});
			await cache.write(name, bytes);
			return bytes;
		} catch (err) {
			onProgress?.({ status: "error" });
			throw new WhistleEngineError(
				err instanceof Error ? err.message : String(err),
				"download-failed"
			);
		}
	}

	if (!wasm) {
		wasm = await fetchAndCache(WHISTLE_CACHE_WASM, DEFAULT_WHISTLE_WASM_URL);
	}
	if (!weights) {
		weights = await fetchAndCache(
			WHISTLE_CACHE_WEIGHTS,
			DEFAULT_WHISTLE_WEIGHTS_URL
		);
	}

	try {
		const engine = await instantiate(wasm, weights);
		onProgress?.({ status: "ready" });
		return engine;
	} catch (err) {
		onProgress?.({ status: "error" });
		if (err instanceof WhistleEngineError) {
			throw err;
		}
		throw new WhistleEngineError(
			err instanceof Error ? err.message : String(err),
			"load-failed"
		);
	}
}

export async function loadWhistleEngine(
	options: LoadWhistleEngineOptions
): Promise<WhistleEngine> {
	if (singletonEngine) {
		return singletonEngine;
	}
	if (!singletonPromise) {
		singletonPromise = loadInternal(options)
			.then((engine) => {
				singletonEngine = engine;
				return engine;
			})
			.catch((err) => {
				singletonPromise = null;
				throw err;
			});
	}
	return singletonPromise;
}
