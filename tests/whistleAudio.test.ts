import { describe, it, expect } from "vitest";
import { floatToPcm16Base64 } from "../src/transcribers/liveProtocol";
import {
	WHISTLE_MAX_SAMPLES,
	concatFloat32,
	mixToMono,
	pcm16Base64ToFloat32,
	pcmFromDecoded,
	takeStreamChunks,
} from "../src/transcribers/whistle/audio";
import {
	WHISTLE_MAX_CLIP_SECONDS,
	WHISTLE_SAMPLE_RATE,
	WHISTLE_STREAM_CHUNK_SAMPLES,
} from "../src/transcribers/whistle/options";

describe("mixToMono", () => {
	it("returns a single channel unchanged", () => {
		const left = new Float32Array([0.1, -0.2, 0.3]);
		expect(Array.from(mixToMono([left]))).toEqual(Array.from(left));
	});

	it("averages stereo channels", () => {
		const left = new Float32Array([1, 0.5, 0]);
		const right = new Float32Array([-1, 0.5, 1]);
		expect(Array.from(mixToMono([left, right]))).toEqual([0, 0.5, 0.5]);
	});

	it("returns an empty buffer when there are no channels", () => {
		expect(mixToMono([]).length).toBe(0);
	});
});

describe("pcmFromDecoded", () => {
	it("keeps 16 kHz mono samples as-is", () => {
		const samples = new Float32Array([0.25, -0.5, 0.75]);
		const pcm = pcmFromDecoded({
			channelData: [samples],
			sampleRate: WHISTLE_SAMPLE_RATE,
		});
		expect(Array.from(pcm)).toEqual([0.25, -0.5, 0.75]);
	});

	it("resamples 48 kHz audio down to 16 kHz", () => {
		const input = new Float32Array(48);
		for (let i = 0; i < input.length; i++) {
			input[i] = i / 47;
		}
		const pcm = pcmFromDecoded({
			channelData: [input],
			sampleRate: 48000,
		});
		expect(pcm.length).toBe(16);
	});

	it("mixes stereo before resampling", () => {
		const left = new Float32Array([1, 1, 1, 1]);
		const right = new Float32Array([-1, -1, -1, -1]);
		const pcm = pcmFromDecoded({
			channelData: [left, right],
			sampleRate: WHISTLE_SAMPLE_RATE,
		});
		expect(Array.from(pcm)).toEqual([0, 0, 0, 0]);
	});
});

describe("WHISTLE_MAX_SAMPLES", () => {
	it("is 30 seconds at 16 kHz", () => {
		expect(WHISTLE_MAX_SAMPLES).toBe(
			WHISTLE_MAX_CLIP_SECONDS * WHISTLE_SAMPLE_RATE
		);
	});
});

describe("pcm16Base64ToFloat32", () => {
	it("round-trips PCM16 base64 from the live recorder", () => {
		const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);
		const decoded = pcm16Base64ToFloat32(floatToPcm16Base64(samples));
		expect(decoded.length).toBe(samples.length);
		for (let i = 0; i < samples.length; i++) {
			expect(decoded[i]).toBeCloseTo(samples[i], 4);
		}
	});
});

describe("concatFloat32", () => {
	it("appends chunks without mutating the originals", () => {
		const left = new Float32Array([1, 2]);
		const right = new Float32Array([3]);
		expect(Array.from(concatFloat32(left, right))).toEqual([1, 2, 3]);
		expect(Array.from(left)).toEqual([1, 2]);
	});
});

describe("takeStreamChunks", () => {
	it("splits a buffer into 1 s windows and keeps the remainder", () => {
		const buffer = new Float32Array(WHISTLE_STREAM_CHUNK_SAMPLES * 2 + 12);
		for (let i = 0; i < buffer.length; i++) {
			buffer[i] = i;
		}
		const { chunks, remainder } = takeStreamChunks(buffer);
		expect(chunks).toHaveLength(2);
		expect(chunks[0].length).toBe(WHISTLE_STREAM_CHUNK_SAMPLES);
		expect(chunks[1][0]).toBe(WHISTLE_STREAM_CHUNK_SAMPLES);
		expect(remainder.length).toBe(12);
		expect(remainder[0]).toBe(WHISTLE_STREAM_CHUNK_SAMPLES * 2);
	});

	it("returns the whole buffer as remainder when it is shorter than a window", () => {
		const buffer = new Float32Array([1, 2, 3]);
		const { chunks, remainder } = takeStreamChunks(buffer);
		expect(chunks).toHaveLength(0);
		expect(Array.from(remainder)).toEqual([1, 2, 3]);
	});
});
