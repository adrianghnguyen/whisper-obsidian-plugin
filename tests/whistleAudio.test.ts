import { describe, it, expect } from "vitest";
import {
	WHISTLE_MAX_SAMPLES,
	mixToMono,
	pcmFromDecoded,
} from "../src/transcribers/whistle/audio";
import { WHISTLE_MAX_CLIP_SECONDS, WHISTLE_SAMPLE_RATE } from "../src/transcribers/whistle/options";

describe("mixToMono", () => {
	it("returns a single channel unchanged", () => {
		const left = new Float32Array([0.1, -0.2, 0.3]);
		expect(Array.from(mixToMono([left]))).toEqual([0.1, -0.2, 0.3]);
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
