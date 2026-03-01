# Data model: In-browser ASR drop-in

**Feature**: 001-transformers-js-asr-dropin  
**Date**: 2025-03-01

## Entities

### Transcription backend

Logical concept: the mechanism that turns audio into text.

| Attribute | Type | Description |
|-----------|------|-------------|
| type | `"api"` \| `"local"` | Backend kind. |
| apiOptions | (when type=api) | API key, API URL, model, etc. (existing fields). |
| localModelId | (when type=local) | Identifier for the in-browser model (e.g. default bundled id or Hub model id). |
| localModelMaxDurationSeconds | (when type=local, display only) | Max recommended duration for the selected model; shown in settings, not necessarily stored if derivable from registry. |

**Validation**: Exactly one backend type is active. When type is `local`, API key/URL are not required for transcription. When type is `api`, existing validation (e.g. API key for request) applies.

**State**: No explicit state machine; backend is selected in settings and used for the next transcription until the user changes it.

---

### Settings (WhisperSettings extension)

Stored via `plugin.loadData()` / `plugin.saveData()`. Existing fields unchanged; new fields for backend selection and local options.

| New/Extended field | Type | Description |
|--------------------|------|-------------|
| transcriptionBackend | `"api"` \| `"local"` | Which backend to use. |
| localModelId | string | Model identifier for local ASR (e.g. default "Xenova/whisper-tiny.en" or user-chosen). |

**Validation**: If `transcriptionBackend === "local"`, API key is optional (not used for local path). If `transcriptionBackend === "api"`, existing API key/URL rules apply. `localModelId` must be a non-empty string when backend is local (default value in DEFAULT_SETTINGS).

**Relationships**: Settings owns backend type and all backend-specific options; one consistent storage and UI surface (WhisperSettingsTab shows only relevant fields per backend).

---

### Audio input

Unchanged from current design: recording or uploaded file.

| Attribute | Type | Description |
|-----------|------|-------------|
| blob | Blob | Audio data. |
| fileName | string | Original filename (used for base name, paths). |

Same blob and filename are passed to AudioHandler regardless of backend; backend only determines how `text` is produced.

---

### Local model registry (in-memory / config)

Optional structure used at runtime to map `localModelId` to display metadata (e.g. max recommended duration). Not persisted as a separate entity; can be a constant map or derived from model config.

| Attribute | Type | Description |
|-----------|------|-------------|
| modelId | string | Key (e.g. Hub model id). |
| maxRecommendedDurationSeconds | number | Shown in settings for the selected model. |

---

## State transitions

- **Backend switch**: User changes `transcriptionBackend` or local model in settings → next transcription uses the new backend/model; no transition state.
- **First-time local use**: Model data not yet available → show preparation/progress (e.g. status or notice); when ready → transcription runs; subsequent runs reuse cached model.
- **Capability failure**: Environment cannot run local backend → show Notice, offer “Use cloud instead?”; no change to stored backend setting unless user switches.

---

## Out of scope for this feature

- Word-level or segment-level timestamps in the stored contract (future extension).
- Persisted “model cache” beyond browser/plugin cache — handled by Transformers.js and browser.
