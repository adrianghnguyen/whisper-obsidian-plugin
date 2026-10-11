import {
	parseWhistleStreamJson,
	parseWhistleTranscriptJson,
	type WhistleCallOptions,
	type WhistleStreamResult,
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

function copyBytesToHeap(
	Module: NeedleModule,
	bytes: Uint8Array
): number {
	const ptr = Module._malloc(bytes.byteLength);
	if (!ptr) {
		throw new Error("Whistle heap allocation failed");
	}
	Module.HEAPU8.set(bytes, ptr);
	return ptr;
}

function copyFloat32ToHeap(Module: NeedleModule, pcm: Float32Array): number {
	const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
	return copyBytesToHeap(Module, bytes);
}

const EMPTY_CALL_OPTIONS: WhistleCallOptions = {
	language: null,
	keywords: null,
	wordTimestamps: false,
};

function callNeedleJson(
	Module: NeedleModule,
	name: string,
	argTypes: string[],
	args: unknown[]
): string {
	const outPtr = Module._malloc(OUTPUT_CAPACITY);
	if (!outPtr) {
		throw new Error("Whistle output buffer allocation failed");
	}
	try {
		const rc = Module.ccall(name, "number", argTypes, [
			...args,
			outPtr,
			OUTPUT_CAPACITY,
		]) as number;
		if (rc < 0) {
			throw new Error(
				`Whistle ${name} failed: ${lastNeedleError(Module)}`
			);
		}
		return Module.UTF8ToString(outPtr);
	} finally {
		Module._free(outPtr);
	}
}

export async function instantiateNeedleEngine(
	wasmBytes: Uint8Array,
	weightsBytes: Uint8Array
): Promise<{
	transcribe(
		pcm: Float32Array,
		options?: WhistleCallOptions
	): WhistleTranscript;
	streamProcess(
		pcm: Float32Array,
		options?: WhistleCallOptions
	): WhistleStreamResult;
	streamStop(): WhistleStreamResult;
}> {
	const Module = await createNeedle({ wasmBinary: wasmBytes });

	/*
	 * needle_load reads the .cact in place, so the heap copy must live as
	 * long as the engine. Do not free cactPtr. Do not pass 17 MB through
	 * ccall's stackAlloc "array" converter.
	 */
	const cactPtr = copyBytesToHeap(Module, weightsBytes);
	const loadResult = Module.ccall(
		"needle_load",
		"number",
		["number", "number"],
		[cactPtr, weightsBytes.length]
	) as number;
	if (loadResult < 0) {
		Module._free(cactPtr);
		throw new Error(`Whistle model load failed: ${lastNeedleError(Module)}`);
	}

	return {
		transcribe(
			pcm: Float32Array,
			options?: WhistleCallOptions
		): WhistleTranscript {
			const opts = options ?? EMPTY_CALL_OPTIONS;
			const pcmPtr = copyFloat32ToHeap(Module, pcm);
			try {
				return parseWhistleTranscriptJson(
					callNeedleJson(
						Module,
						"needle_transcribe",
						[
							"number",
							"number",
							"string",
							"string",
							"number",
							"number",
							"number",
						],
						[
							pcmPtr,
							pcm.length,
							opts.language,
							opts.keywords,
							opts.wordTimestamps ? 1 : 0,
						]
					)
				);
			} finally {
				Module._free(pcmPtr);
			}
		},
		streamProcess(
			pcm: Float32Array,
			options?: WhistleCallOptions
		): WhistleStreamResult {
			const opts = options ?? EMPTY_CALL_OPTIONS;
			const pcmPtr = copyFloat32ToHeap(Module, pcm);
			try {
				return parseWhistleStreamJson(
					callNeedleJson(
						Module,
						"needle_stream_transcribe_process",
						[
							"number",
							"number",
							"string",
							"string",
							"number",
							"number",
						],
						[pcmPtr, pcm.length, opts.language, opts.keywords]
					)
				);
			} finally {
				Module._free(pcmPtr);
			}
		},
		streamStop(): WhistleStreamResult {
			return parseWhistleStreamJson(
				callNeedleJson(
					Module,
					"needle_stream_transcribe_stop",
					["number", "number"],
					[]
				)
			);
		},
	};
}
