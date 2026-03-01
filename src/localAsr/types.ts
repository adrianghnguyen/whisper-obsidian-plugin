/**
 * Backend interface: transcribe(blob, fileName?, options?) => Promise<{ text }>.
 * Both API and local paths implement this. See contracts/backend-interface.md.
 */
export interface TranscribeBackend {
	(
		blob: Blob,
		fileName?: string,
		options?: { modelId?: string }
	): Promise<{ text: string }>;
}
