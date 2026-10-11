import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	DEFAULT_WHISTLE_WASM_URL,
	DEFAULT_WHISTLE_WEIGHTS_URL,
	loadWhistleEngine,
	resetWhistleEngine,
	WHISTLE_CACHE_WASM,
	WHISTLE_CACHE_WEIGHTS,
	WhistleEngineError,
} from "../src/transcribers/whistle/engine";
import type { WhistleEngine } from "../src/transcribers/whistle/engine";

function memoryCache() {
	const files = new Map<string, Uint8Array>();
	return {
		files,
		read: vi.fn(async (name: string) => files.get(name) ?? null),
		write: vi.fn(async (name: string, data: Uint8Array) => {
			files.set(name, data);
		}),
	};
}

function fakeEngine(): WhistleEngine {
	return {
		transcribe: () => ({
			text: "ok",
			language: "en",
			ttft_ms: 1,
			decode_tps: 1,
		}),
	};
}

describe("loadWhistleEngine", () => {
	beforeEach(() => {
		resetWhistleEngine();
	});

	afterEach(() => {
		resetWhistleEngine();
	});

	it("downloads wasm and weights on a cache miss, then instantiates", async () => {
		const cache = memoryCache();
		const wasm = new Uint8Array([1, 2, 3]);
		const weights = new Uint8Array([9, 9, 9]);
		const fetchBytes = vi.fn(async (url: string) => {
			if (url === DEFAULT_WHISTLE_WASM_URL) return wasm;
			if (url === DEFAULT_WHISTLE_WEIGHTS_URL) return weights;
			throw new Error(`unexpected url ${url}`);
		});
		const instantiate = vi.fn(async () => fakeEngine());
		const onProgress = vi.fn();

		const engine = await loadWhistleEngine({
			cache,
			fetchBytes,
			instantiate,
			onProgress,
		});

		expect(
			(await Promise.resolve(
				engine.transcribe(new Float32Array([0]))
			)).text
		).toBe("ok");
		expect(fetchBytes).toHaveBeenCalledWith(
			DEFAULT_WHISTLE_WASM_URL,
			expect.any(Function)
		);
		expect(fetchBytes).toHaveBeenCalledWith(
			DEFAULT_WHISTLE_WEIGHTS_URL,
			expect.any(Function)
		);
		expect(cache.write).toHaveBeenCalledWith(WHISTLE_CACHE_WASM, wasm);
		expect(cache.write).toHaveBeenCalledWith(WHISTLE_CACHE_WEIGHTS, weights);
		expect(instantiate).toHaveBeenCalledWith(wasm, weights);
		expect(onProgress).toHaveBeenCalledWith(
			expect.objectContaining({ status: "downloading" })
		);
		expect(onProgress).toHaveBeenCalledWith(
			expect.objectContaining({ status: "ready" })
		);
	});

	it("skips the network when both files are already cached", async () => {
		const cache = memoryCache();
		const wasm = new Uint8Array([1]);
		const weights = new Uint8Array([2]);
		cache.files.set(WHISTLE_CACHE_WASM, wasm);
		cache.files.set(WHISTLE_CACHE_WEIGHTS, weights);
		const fetchBytes = vi.fn(async () => {
			throw new Error("network should not run");
		});
		const instantiate = vi.fn(async () => fakeEngine());

		await loadWhistleEngine({ cache, fetchBytes, instantiate });

		expect(fetchBytes).not.toHaveBeenCalled();
		expect(cache.write).not.toHaveBeenCalled();
		expect(instantiate).toHaveBeenCalledWith(wasm, weights);
	});

	it("reuses the in-memory singleton on a second call", async () => {
		const cache = memoryCache();
		const instantiate = vi.fn(async () => fakeEngine());
		const fetchBytes = vi.fn(async (url: string) =>
			url.includes("wasm") ? new Uint8Array([1]) : new Uint8Array([2])
		);

		const first = await loadWhistleEngine({
			cache,
			fetchBytes,
			instantiate,
		});
		const second = await loadWhistleEngine({
			cache,
			fetchBytes,
			instantiate,
		});

		expect(second).toBe(first);
		expect(instantiate).toHaveBeenCalledTimes(1);
		expect(fetchBytes).toHaveBeenCalledTimes(2);
	});

	it("evicts a failed load so the next call can retry", async () => {
		const cache = memoryCache();
		const fetchBytes = vi
			.fn()
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValueOnce(new Uint8Array([1]))
			.mockResolvedValueOnce(new Uint8Array([2]));
		const instantiate = vi.fn(async () => fakeEngine());

		await expect(
			loadWhistleEngine({ cache, fetchBytes, instantiate })
		).rejects.toBeInstanceOf(WhistleEngineError);

		const engine = await loadWhistleEngine({
			cache,
			fetchBytes,
			instantiate,
		});
		expect(
			(await Promise.resolve(engine.transcribe(new Float32Array()))).text
		).toBe("ok");
	});

	it("marks a download failure as download-failed", async () => {
		const cache = memoryCache();
		try {
			await loadWhistleEngine({
				cache,
				fetchBytes: async () => {
					throw new Error("404");
				},
				instantiate: async () => fakeEngine(),
			});
			expect.unreachable();
		} catch (err) {
			expect(err).toBeInstanceOf(WhistleEngineError);
			expect((err as WhistleEngineError).code).toBe("download-failed");
		}
	});

	it("marks an instantiate failure as load-failed", async () => {
		const cache = memoryCache();
		cache.files.set(WHISTLE_CACHE_WASM, new Uint8Array([1]));
		cache.files.set(WHISTLE_CACHE_WEIGHTS, new Uint8Array([2]));
		try {
			await loadWhistleEngine({
				cache,
				fetchBytes: async () => new Uint8Array([0]),
				instantiate: async () => {
					throw new Error("wasm explode");
				},
			});
			expect.unreachable();
		} catch (err) {
			expect(err).toBeInstanceOf(WhistleEngineError);
			expect((err as WhistleEngineError).code).toBe("load-failed");
		}
	});
});
