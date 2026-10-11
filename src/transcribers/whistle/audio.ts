import { resampleTo16k } from "../liveProtocol";
import { WHISTLE_MAX_CLIP_SECONDS, WHISTLE_SAMPLE_RATE } from "./options";

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
