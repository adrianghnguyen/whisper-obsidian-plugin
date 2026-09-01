export const LEGACY_WHISPER_SECRET_ID = "api-key";

export interface SecretStorageReader {
	getSecret(id: string): string | null;
}

export function resolveWhisperApiKey(
	secrets: SecretStorageReader | undefined | null,
	secretId: string
): string {
	if (!secretId || !secrets || typeof secrets.getSecret !== "function") {
		return "";
	}
	return secrets.getSecret(secretId) ?? "";
}

export interface WhisperSecretSettings {
	whisperApiKeySecretId: string;
}

export function migrateLegacyWhisperSecretId(
	settings: WhisperSecretSettings,
	secrets: SecretStorageReader | undefined | null
): boolean {
	if (
		settings.whisperApiKeySecretId ||
		!secrets ||
		typeof secrets.getSecret !== "function"
	) {
		return false;
	}
	const legacyKey = secrets.getSecret(LEGACY_WHISPER_SECRET_ID);
	if (!legacyKey) {
		return false;
	}
	settings.whisperApiKeySecretId = LEGACY_WHISPER_SECRET_ID;
	return true;
}

export function isWhisperApiKeyRequired(
	apiUrl: string,
	resolvedApiKey: string
): boolean {
	const isDefaultApi =
		apiUrl === "https://api.openai.com/v1/audio/transcriptions";
	return isDefaultApi && !resolvedApiKey;
}
