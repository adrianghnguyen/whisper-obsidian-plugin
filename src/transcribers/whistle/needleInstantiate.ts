import {
	parseWhistleTranscriptJson,
	type WhistleCallOptions,
	type WhistleTranscript,
} from "./options";

/* eslint-disable @typescript-eslint/no-var-requires */
const createNeedle = require("./vendor/needle.js") as (
	moduleArg?: Record<string, unknown>
) => Promise<NeedleModule>;

interface NeedleModule {
	_malloc(size: number): number;
	_free(ptr: number): void;
	HEAPU8: Uint8Array;
	HEAPF32: Float32Array;
	ccall(
		name: string,
		returnType: string | null,
		argTypes: string[],
		args: unknown[]
	): number | string;
	UTF8ToString(ptr: number): string;
}

const OUTPUT_CAPACITY = 65536;

function lastNeedleError(Module: NeedleModule): string {
	const ptr = Module.ccall("needle_last_error", "number", [], []) as number;
	return Module.UTF8ToString(ptr);
}

export async function instantiateNeedleEngine(
	wasmBytes: Uint8Array,
	weightsBytes: Uint8Array
): Promise<{
	transcribe(
		pcm: Float32Array,
		options?: WhistleCallOptions
	): WhistleTranscript;
}> {
	const Module = await createNeedle({ wasmBinary: wasmBytes });

	const loadResult = Module.ccall(
		"needle_load",
		"number",
		["array", "number"],
		[weightsBytes, weightsBytes.length]
	) as number;
	if (loadResult < 0) {
		throw new Error(`Whistle model load failed: ${lastNeedleError(Module)}`);
	}

	return {
		transcribe(
			pcm: Float32Array,
			options?: WhistleCallOptions
		): WhistleTranscript {
			const opts = options ?? {
				language: null,
				keywords: null,
				wordTimestamps: false,
			};
			const outPtr = Module._malloc(OUTPUT_CAPACITY);
			try {
				const rc = Module.ccall(
					"needle_transcribe",
					"number",
					[
						"array",
						"number",
						"string",
						"string",
						"boolean",
						"number",
						"number",
					],
					[
						pcm,
						pcm.length,
						opts.language,
						opts.keywords,
						opts.wordTimestamps,
						outPtr,
						OUTPUT_CAPACITY,
					]
				) as number;
				if (rc < 0) {
					throw new Error(
						`Whistle transcribe failed: ${lastNeedleError(Module)}`
					);
				}
				const json = Module.UTF8ToString(outPtr);
				return parseWhistleTranscriptJson(json);
			} finally {
				Module._free(outPtr);
			}
		},
	};
}
