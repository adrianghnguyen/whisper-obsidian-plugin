/**
 * Streaming PCM audio recorder.
 *
 * Captures raw audio from the microphone via AudioContext, resamples to
 * 16 kHz mono 16-bit linear PCM, and delivers chunks to a callback.
 * Used by GeminiLiveTranscriber for the WebSocket Live API.
 */
export class StreamingRecorder {
	private audioContext: AudioContext | null = null;
	private mediaStream: MediaStream | null = null;
	private source: MediaStreamAudioSourceNode | null = null;
	private processor: ScriptProcessorNode | null = null;
	private onChunk: ((base64Pcm: string) => void) | null = null;
	private onStop: (() => void) | null = null;
	private isRecording = false;
	private deviceId: string | null = null;

	setDeviceId(deviceId: string | null): void {
		this.deviceId = deviceId;
	}

	async start(
		onChunk: (base64Pcm: string) => void,
		onStop?: () => void
	): Promise<void> {
		if (this.isRecording) return;

		this.onChunk = onChunk;
		this.onStop = onStop || null;

		const audioConstraints: MediaStreamConstraints["audio"] =
			this.deviceId && this.deviceId !== "default"
				? { deviceId: { ideal: this.deviceId } }
				: true;

		this.mediaStream = await navigator.mediaDevices.getUserMedia({
			audio: audioConstraints,
		});

		this.audioContext = new AudioContext({ sampleRate: 16000 });
		this.source = this.audioContext.createMediaStreamSource(
			this.mediaStream
		);

		// ScriptProcessorNode for PCM access (AudioWorklet would be better
		// but requires a separate file; ScriptProcessor works in practice)
		const bufferSize = 4096;
		this.processor = this.audioContext.createScriptProcessor(
			bufferSize,
			1,
			1
		);

		this.processor.onaudioprocess = (event) => {
			if (!this.isRecording) return;
			const input = event.inputBuffer.getChannelData(0);

			// Convert float32 [-1, 1] to 16-bit PCM little-endian
			const pcmBuffer = new Int16Array(input.length);
			for (let i = 0; i < input.length; i++) {
				const s = Math.max(-1, Math.min(1, input[i]));
				pcmBuffer[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
			}

			// Base64 encode the PCM bytes
			const bytes = new Uint8Array(pcmBuffer.buffer);
			let binary = "";
			for (let i = 0; i < bytes.length; i++) {
				binary += String.fromCharCode(bytes[i]);
			}
			const base64 = btoa(binary);

			this.onChunk?.(base64);
		};

		this.source.connect(this.processor);
		this.processor.connect(this.audioContext.destination);
		this.isRecording = true;
	}

	stop(): void {
		if (!this.isRecording) return;
		this.isRecording = false;

		this.processor?.disconnect();
		this.source?.disconnect();

		if (this.mediaStream) {
			this.mediaStream.getTracks().forEach((t) => t.stop());
		}

		this.audioContext?.close();
		this.audioContext = null;
		this.mediaStream = null;
		this.source = null;
		this.processor = null;

		this.onStop?.();
	}

	get isActive(): boolean {
		return this.isRecording;
	}
}