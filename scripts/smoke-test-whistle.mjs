/**
 * Offline smoke test for the Whistle (Needle WASM) batch transcriber.
 *
 * Downloads wasm + weights from Hugging Face (cached on disk), decodes an
 * audio file with ffmpeg to 16 kHz mono float32 PCM, and runs needle_transcribe.
 *
 * Not part of `npm test` (network + ~17 MB model download on first run).
 *
 * Usage:
 *   node scripts/smoke-test-whistle.mjs [path-to-audio]
 *
 * Default audio: argv, then CLOUD_E2E_VOICE_CLIP / VOICE_CLIP, then tests/fixtures/voice-smoke-hello.wav
 *
 * Requires: Node 18+ (global fetch), ffmpeg on PATH.
 * Optional: WHISTLE_CACHE_DIR — directory for needle.wasm and whistle.cact
 */
import { spawn } from "child_process";
import { createRequire } from "module";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const createNeedle = require("../src/transcribers/whistle/vendor/needle.js");

const DEFAULT_WASM_URL =
	"https://huggingface.co/Cactus-Compute/needle3/resolve/main/wasm/needle.wasm";
const DEFAULT_WEIGHTS_URL =
	"https://huggingface.co/Cactus-Compute/whistle/resolve/main/whistle.cact";
const CACHE_WASM = "needle.wasm";
const CACHE_WEIGHTS = "whistle.cact";
const OUTPUT_CAPACITY = 65536;

const localFixture = path.join(
	repoRoot,
	"tests/fixtures/voice-smoke-hello.wav"
);

function resolveDefaultAudioPath() {
	const fromEnv =
		process.env.CLOUD_E2E_VOICE_CLIP?.trim() ||
		process.env.VOICE_CLIP?.trim();
	if (fromEnv) {
		return path.resolve(fromEnv);
	}
	const siblingClip = path.resolve(
		repoRoot,
		"../obsidian-plugin-development/scripts/cloud-e2e/fixtures/voice/smoke-hello.wav"
	);
	return localFixture;
}

function convertToFloat32Pcm(inputPath) {
	return new Promise((resolve, reject) => {
		const ffmpeg = spawn("ffmpeg", [
			"-y",
			"-i",
			inputPath,
			"-f",
			"f32le",
			"-acodec",
			"pcm_f32le",
			"-ar",
			"16000",
			"-ac",
			"1",
			"pipe:1",
		]);

		const chunks = [];
		ffmpeg.stdout.on("data", (chunk) => chunks.push(chunk));
		ffmpeg.stderr.on("data", () => {});
		ffmpeg.on("close", (code) => {
			if (code === 0) {
				resolve(Buffer.concat(chunks));
			} else {
				reject(new Error(`ffmpeg exited with code ${code}`));
			}
		});
		ffmpeg.on("error", reject);
	});
}

async function fetchBytes(url) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`);
	}
	const buf = Buffer.from(await response.arrayBuffer());
	return new Uint8Array(buf);
}

async function readCache(cacheDir, name) {
	try {
		const data = await fs.readFile(path.join(cacheDir, name));
		return new Uint8Array(data);
	} catch {
		return null;
	}
}

async function writeCache(cacheDir, name, bytes) {
	await fs.mkdir(cacheDir, { recursive: true });
	await fs.writeFile(path.join(cacheDir, name), bytes);
}

function lastNeedleError(Module) {
	const ptr = Module.ccall("needle_last_error", "number", [], []);
	return Module.UTF8ToString(ptr);
}

function copyBytesToHeap(Module, bytes) {
	const ptr = Module._malloc(bytes.byteLength);
	if (!ptr) {
		throw new Error("Whistle heap allocation failed");
	}
	Module.HEAPU8.set(bytes, ptr);
	return ptr;
}

async function loadEngine(wasmBytes, weightsBytes) {
	const Module = await createNeedle({ wasmBinary: wasmBytes });
	const cactPtr = copyBytesToHeap(Module, weightsBytes);
	/*
	 * Node's Emscripten bindings expect a BigInt for needle_load's byte length;
	 * a plain number throws for multi-megabyte weights.
	 */
	const loadResult = Module.ccall(
		"needle_load",
		"number",
		["number", "bigint"],
		[cactPtr, BigInt(weightsBytes.length)]
	);
	if (loadResult < 0) {
		throw new Error(`Whistle model load failed: ${lastNeedleError(Module)}`);
	}
	return Module;
}

function transcribe(Module, pcm) {
	const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
	const pcmPtr = copyBytesToHeap(Module, bytes);
	const outPtr = Module._malloc(OUTPUT_CAPACITY);
	if (!outPtr) {
		Module._free(pcmPtr);
		throw new Error("Whistle output buffer allocation failed");
	}
	try {
		const rc = Module.ccall(
			"needle_transcribe",
			"number",
			[
				"number",
				"number",
				"string",
				"string",
				"number",
				"number",
				"number",
			],
			[pcmPtr, pcm.length, null, null, 0, outPtr, OUTPUT_CAPACITY]
		);
		if (rc < 0) {
			throw new Error(`needle_transcribe failed: ${lastNeedleError(Module)}`);
		}
		return Module.UTF8ToString(outPtr);
	} finally {
		Module._free(outPtr);
		Module._free(pcmPtr);
	}
}

async function main() {
	let audioPath = process.argv[2]
		? path.resolve(process.argv[2])
		: resolveDefaultAudioPath();
	if (!process.argv[2]) {
		try {
			await fs.access(audioPath);
		} catch {
			const sibling = path.resolve(
				repoRoot,
				"../obsidian-plugin-development/scripts/cloud-e2e/fixtures/voice/smoke-hello.wav"
			);
			try {
				await fs.access(sibling);
				audioPath = sibling;
			} catch {
				/* use localFixture path for error message */
			}
		}
	}
	const cacheDir =
		process.env.WHISTLE_CACHE_DIR ??
		path.join(repoRoot, ".whistle-smoke-cache");

	try {
		await fs.access(audioPath);
	} catch {
		console.error(`Audio file not found: ${audioPath}`);
		console.error(
			"Usage: node scripts/smoke-test-whistle.mjs [path-to-audio]"
		);
		process.exit(1);
	}

	console.log(`Cache dir: ${cacheDir}`);
	let wasm = await readCache(cacheDir, CACHE_WASM);
	let weights = await readCache(cacheDir, CACHE_WEIGHTS);

	if (!wasm) {
		console.log(`Downloading ${CACHE_WASM}...`);
		wasm = await fetchBytes(DEFAULT_WASM_URL);
		await writeCache(cacheDir, CACHE_WASM, wasm);
		console.log(`  cached ${wasm.byteLength} bytes`);
	} else {
		console.log(`Using cached ${CACHE_WASM} (${wasm.byteLength} bytes)`);
	}

	if (!weights) {
		console.log(`Downloading ${CACHE_WEIGHTS}...`);
		weights = await fetchBytes(DEFAULT_WEIGHTS_URL);
		await writeCache(cacheDir, CACHE_WEIGHTS, weights);
		console.log(`  cached ${weights.byteLength} bytes`);
	} else {
		console.log(`Using cached ${CACHE_WEIGHTS} (${weights.byteLength} bytes)`);
	}

	console.log("Loading Needle engine...");
	const Module = await loadEngine(wasm, weights);
	console.log("Engine ready.");

	console.log(`Decoding ${audioPath} → 16 kHz mono f32 PCM...`);
	const pcmBuffer = await convertToFloat32Pcm(audioPath);
	const sampleCount = Math.floor(pcmBuffer.byteLength / 4);
	const pcm = new Float32Array(
		pcmBuffer.buffer,
		pcmBuffer.byteOffset,
		sampleCount
	);
	console.log(
		`PCM: ${sampleCount} samples (${(sampleCount / 16000).toFixed(2)} s)`
	);

	const rawJson = transcribe(Module, pcm);
	console.log("Raw JSON:", rawJson);

	let parsed;
	try {
		parsed = JSON.parse(rawJson);
	} catch {
		console.error("Failed to parse transcript JSON.");
		process.exit(1);
	}

	const text = (parsed.text ?? "").trim();
	console.log(`\nTranscript: ${text || "(empty)"}`);
	console.log(
		`Language: ${parsed.language ?? "?"} | ttft_ms: ${parsed.ttft_ms ?? "?"} | decode_tps: ${parsed.decode_tps ?? "?"}`
	);

	if (!text) {
		console.error(
			"\nSmoke failed: transcribe returned no text (engine ran but output was empty)."
		);
		process.exit(1);
	}

	console.log("\nWhistle smoke test passed.");
	process.exit(0);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
