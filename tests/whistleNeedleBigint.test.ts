import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Whisper from "main";
import { DEFAULT_SETTINGS } from "../src/SettingsManager";
import {
	LiveAudioSource,
	LiveTranscriptSink,
} from "../src/transcribers/GeminiLiveTranscriber";
import { WhistleLiveTranscriber } from "../src/transcribers/WhistleLiveTranscriber";
import {
	defaultInstantiate,
	loadWhistleEngine,
	resetWhistleEngine,
} from "../src/transcribers/whistle/engine";
import {
	instantiateNeedleEngine,
	type CreateNeedleFn,
} from "../src/transcribers/whistle/needleInstantiate";

/** Observed whistle.cact size from Adrian's console (Needle i64 load length). */
const WHISTLE_CACT_BYTES = 16919407;

/**
 * Emscripten i64 ABI: writing a Number into HEAP64 throws
 * `TypeError: Cannot convert 16919407 to a BigInt`.
 */
function writeHeap64(value: unknown): void {
	const heap64 = new BigInt64Array(1);
	heap64[0] = value as bigint;
}

function fakeEmscriptenCreateNeedle(onLoadSize: (size: unknown) => void): CreateNeedleFn {
	return async () => ({
		HEAPU8: { set: () => undefined } as unknown as Uint8Array,
		_malloc: () => 8,
		_free: () => undefined,
		UTF8ToString: () => "",
		ccall(
			name: string,
			_returnType: string | null,
			_argTypes: string[],
			args: unknown[]
		) {
			if (name === "needle_load") {
				onLoadSize(args[1]);
				writeHeap64(args[1]);
				return 0;
			}
			return 0;
		},
	});
}

function cactSizedWeights(): Uint8Array {
	const bytes = new Uint8Array(1);
	Object.defineProperty(bytes, "length", { value: WHISTLE_CACT_BYTES });
	Object.defineProperty(bytes, "byteLength", { value: WHISTLE_CACT_BYTES });
	return bytes;
}

function memoryCache(wasm: Uint8Array, weights: Uint8Array) {
	return {
		read: async (name: string) => (name.includes("wasm") ? wasm : weights),
		write: async () => undefined,
	};
}

class FakeRecorder implements LiveAudioSource {
	started = false;
	setDeviceId(): void {}
	async start(): Promise<void> {
		this.started = true;
	}
	stop(): void {
		this.started = false;
	}
}

class FakeEditor implements LiveTranscriptSink {
	updateInterim(): void {}
	commitFinal(): void {}
	lockInterim(): void {}
	reset(): void {}
}

function makePlugin(): Whisper {
	return {
		settings: { ...DEFAULT_SETTINGS },
		app: {},
	} as unknown as Whisper;
}

describe("Whistle needle_load i64 size (16919407)", () => {
	beforeEach(() => {
		resetWhistleEngine();
	});

	afterEach(() => {
		resetWhistleEngine();
		vi.restoreAllMocks();
	});

	it("passes 16919407 to needle_load as BigInt so HEAP64 does not throw", async () => {
		let loadSize: unknown;
		await instantiateNeedleEngine(
			new Uint8Array([1]),
			cactSizedWeights(),
			fakeEmscriptenCreateNeedle((size) => {
				loadSize = size;
			})
		);
		expect(typeof loadSize).toBe("bigint");
		expect(loadSize).toBe(BigInt(WHISTLE_CACT_BYTES));
	});

	it("loadInternal / defaultInstantiate load a 16919407-byte cact without TypeError", async () => {
		const engine = await loadWhistleEngine({
			cache: memoryCache(new Uint8Array([1]), cactSizedWeights()),
			instantiate: (wasm, weights) =>
				defaultInstantiate(
					wasm,
					weights,
					fakeEmscriptenCreateNeedle(() => undefined)
				),
		});
		expect(engine.streamProcess).toBeTypeOf("function");
	});

	it("lets WhistleLiveTranscriber.startStream finish after defaultInstantiate", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const recorder = new FakeRecorder();
		const transcriber = new WhistleLiveTranscriber(makePlugin(), {
			recorder,
			editor: new FakeEditor(),
			loadEngine: () =>
				loadWhistleEngine({
					cache: memoryCache(new Uint8Array([1]), cactSizedWeights()),
					instantiate: (wasm, weights) =>
						defaultInstantiate(
							wasm,
							weights,
							fakeEmscriptenCreateNeedle(() => undefined)
						),
				}),
		});

		await transcriber.startStream();

		expect(errorSpy).not.toHaveBeenCalled();
		expect(transcriber.isActive).toBe(true);
		expect(recorder.started).toBe(true);
	});
});
