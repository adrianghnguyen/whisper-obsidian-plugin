import { resampleTo16k } from "../liveProtocol";
import {
	WHISTLE_MAX_CLIP_SECONDS,
	WHISTLE_SAMPLE_RATE,
	WHISTLE_STREAM_CHUNK_SAMPLES,
} from "./options";

export const WHISTLE_MAX_SAMPLES =
	WHISTLE_MAX_CLIP_SECONDS * WHISTLE_SAMPLE_RATE;

export function mixToMono(channelData: Float32Array[]): Float32Array {
	if (channelData.length === 0) {
		return new Float32Array(0);
	}
	if (channelData.length === 1) {
		return channelData[0];
	}
	const length = channelData[0].length;
	const out = new Float32Array(length);
	for (let i = 0; i < length; i++) {
		let sum = 0;
		for (const ch of channelData) {
			sum += ch[i] ?? 0;
		}
		out[i] = sum / channelData.length;
	}
	return out;
}

export function pcmFromDecoded(decoded: {
	channelData: Float32Array[];
	sampleRate: number;
}): Float32Array {
	const mono = mixToMono(decoded.channelData);
	return resampleTo16k(mono, decoded.sampleRate);
}

export function pcm16Base64ToFloat32(base64: string): Float32Array {
	let bytes: Uint8Array;
	if (typeof atob === "function") {
		const binary = atob(base64);
		bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}
	} else {
		bytes = new Uint8Array(Buffer.from(base64, "base64"));
	}
	const sampleCount = Math.floor(bytes.byteLength / 2);
	const pcm = new Int16Array(bytes.buffer, bytes.byteOffset, sampleCount);
	const out = new Float32Array(sampleCount);
	for (let i = 0; i < sampleCount; i++) {
		out[i] = pcm[i] < 0 ? pcm[i] / 0x8000 : pcm[i] / 0x7fff;
	}
	return out;
}

export function concatFloat32(
	left: Float32Array,
	right: Float32Array
): Float32Array {
	if (left.length === 0) {
		return right;
	}
	if (right.length === 0) {
		return left;
	}
	const out = new Float32Array(left.length + right.length);
	out.set(left, 0);
	out.set(right, left.length);
	return out;
}

export function takeStreamChunks(
	buffer: Float32Array,
	chunkSamples: number = WHISTLE_STREAM_CHUNK_SAMPLES
): { chunks: Float32Array[]; remainder: Float32Array } {
	if (chunkSamples <= 0) {
		return { chunks: [], remainder: buffer };
	}
	const chunks: Float32Array[] = [];
	let offset = 0;
	while (offset + chunkSamples <= buffer.length) {
		chunks.push(buffer.slice(offset, offset + chunkSamples));
		offset += chunkSamples;
	}
	return {
		chunks,
		remainder: offset === 0 ? buffer : buffer.slice(offset),
	};
}
