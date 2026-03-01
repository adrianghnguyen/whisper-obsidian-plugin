# Feature Specification: In-browser ASR (Transformers.js) as drop-in backend

**Feature Branch**: `001-transformers-js-asr-dropin`  
**Created**: 2025-03-01  
**Status**: Draft  
**Input**: User description: "I want to be able to use the ASR Transformers.js skill as a drop-in replacement for the existing whisper plugin. It should have a minimal footprint and easy to package into the plugin. It'll need to minimally impact the existing plugin. Ask me for clarifications."

**Architecture reference**: [whisper-plugin-architecture.md](.specify/memory/whisper-plugin-architecture.md) — the audio flow is Microphone/File → Blob → AudioHandler → transcription endpoint → `{ text }` → vault/editor. The local backend swaps only the transcription endpoint; the rest of the pipeline is unchanged.

## Clarifications

### Session 2025-03-01

- Q: How does the system handle very long audio with the in-browser backend? → A: No plugin-level duration limit (matches existing cloud path). Plugin settings MUST list the max recommended duration for the selected local model so the user can see it per model; that is sufficient. Implementation may chunk internally to produce the same single-text response.
- Q: When the environment cannot run the in-browser backend, what must the plugin do? → A: Show a clear message and offer the user the option to use the API backend for this transcription (e.g. “Use cloud instead?”). User-facing message MUST use the same mechanism as the rest of the plugin (Obsidian Notice for toast/popup), with a short, safe message only; technical details MUST be logged to the browser console (e.g. console.error or console.warn). This matches existing plugin behaviour (Notice for user; console for devs) and constitution (no API keys or stack traces in Notice).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Transcribe using in-browser ASR (Priority: P1)

A user who prefers not to use an external API or wants to work offline selects the in-browser transcription backend in settings. They record or upload audio as they do today. The plugin transcribes the audio locally in the app and creates or updates the note with the same behaviour as the existing API path (new file or insert at cursor, same paths and options).

**Why this priority**: Delivers the core value of the feature—local transcription without a server.

**Independent Test**: Can be fully tested by selecting the in-browser backend, recording or uploading a short audio file, and verifying the resulting text appears in a new note or at the cursor as configured.

**Acceptance Scenarios**:

1. **Given** the user has selected the in-browser ASR backend and configured output path/options, **When** they finish a recording or upload an audio file, **Then** transcription runs without calling an external API and the resulting text is written to the vault or editor per settings.
2. **Given** the in-browser backend is selected, **When** the user views the status bar (Idle, Recording, or Processing), **Then** the status bar text indicates local mode (e.g. "Whisper(Local) Idle") so it is clear the cloud backend is not in use.
3. **Given** the in-browser backend is selected, **When** transcription is in progress, **Then** the main UI stays responsive (no freezing) and the user sees clear status feedback (e.g. Idle / Recording / Processing).
4. **Given** the in-browser backend is selected and no API key is set, **When** the user records or uploads audio, **Then** transcription still runs successfully without prompting for an API key.

---

### User Story 2 - Switch between API and in-browser backend (Priority: P2)

A user can choose in settings which transcription backend to use (existing API or in-browser ASR). Only the options relevant to the selected backend are shown or required. Changing the backend does not require changing any other workflow; record and upload flows stay the same.

**Why this priority**: Ensures the new backend fits the existing plugin model and avoids breaking current API users.

**Independent Test**: Can be tested by toggling the backend in settings, then performing a recording or upload and confirming the correct backend is used and the right options are visible.

**Acceptance Scenarios**:

1. **Given** the settings tab is open, **When** the user changes the transcription backend, **Then** the form shows only the options that apply to that backend (e.g. no API key when in-browser is selected).
2. **Given** the in-browser backend is selected, **When** the user opens the plugin settings, **Then** the local transcription model chosen and the max recommended duration for that model are visible in the settings UI.
3. **Given** the user has previously used the API backend, **When** they switch to the in-browser backend and transcribe, **Then** no API request is made and transcription uses the local path only.
4. **Given** the in-browser backend is selected but the environment cannot run it (e.g. unsupported capabilities), **When** the user triggers transcription, **Then** the plugin shows a Notice with a clear, user-safe message, offers the option to use the API backend for this transcription (e.g. “Use cloud instead?”), and logs a message to the browser console (technical detail for debugging).

---

### User Story 3 - First-time and repeat use of in-browser model (Priority: P3)

The first time a user runs transcription with the in-browser backend, any required model data is obtained in a way that is clearly indicated (e.g. progress or status). Later runs reuse that data so transcription starts without a long delay when possible.

**Why this priority**: Makes the in-browser option practical and sets expectations for first run vs subsequent runs.

**Independent Test**: Can be tested by using the in-browser backend once (observing first-time behaviour), then transcribing again and confirming faster or more direct startup when data is already available.

**Acceptance Scenarios**:

1. **Given** the user has never used the in-browser backend on this device, **When** they run transcription with that backend, **Then** the user is informed that model data is being prepared (e.g. via status or notice) and can complete the action once ready.
2. **Given** model data for the in-browser backend is already available, **When** the user runs transcription again, **Then** transcription starts without repeating the full initial preparation step.

---

### Edge Cases

- When the environment cannot run the in-browser backend: see **FR-013** (Notice, "Use cloud instead?", console for technical detail).
- Long audio: the plugin does not enforce a duration limit (same as the existing cloud path). Settings show the max recommended duration for the selected local model so the user can see it; the local backend may chunk internally to produce the same single-text response contract.
- When model download or preparation is interrupted (e.g. network off, user closes app): the plugin MUST offer retry (e.g. via Notice or status action), MUST NOT leave the UI in a stuck "Loading" or inconsistent state, and MAY log technical detail to the console.
- If the user has no API key and selects the API backend, existing behaviour (e.g. notice asking for API key) applies; the in-browser backend does not change that.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The plugin MUST support a configurable transcription backend so the user can choose between the existing API-based backend and an in-browser ASR backend.
- **FR-002**: When the in-browser backend is selected, the plugin MUST produce transcription text from audio (recording or upload) without sending audio to an external API.
- **FR-003**: The single entry point for transcription (record and upload) MUST remain unchanged; backend selection only affects how audio is turned into text internally.
- **FR-004**: The in-browser backend MUST provide the exact same response as the cloud endpoint (same output contract: e.g. a single transcription text string) so the same downstream logic (vault/editor) applies to both backends with no branching on backend type.
- **FR-005**: The plugin MUST keep the main UI responsive during in-browser transcription (e.g. long-running work must not block the main thread).
- **FR-006**: The plugin MUST use the same vault and editor behaviour for in-browser transcription as for the API backend (create new file vs insert at cursor, paths, and related settings).
- **FR-007**: Settings MUST store the chosen backend and any backend-specific options (e.g. in-browser model identifier); the settings UI MUST show only relevant options for the selected backend. When the in-browser backend is selected, the plugin settings MUST display the local transcription model chosen (e.g. default bundled model or a selected downloaded model) and MUST list the max recommended duration for that model (so the user can see recommended limits per model).
- **FR-008**: The plugin MUST provide clear user feedback for in-browser transcription state (e.g. Idle / Recording / Processing) and for errors or progress (e.g. model preparation), using the same feedback mechanisms as today (e.g. status bar, Obsidian Notice for toasts). When the in-browser backend is selected, the Obsidian status bar MUST indicate local mode (e.g. "Whisper(Local) Idle", "Whisper(Local) Recording...", "Whisper(Local) Processing...") so the user can see at a glance that the cloud backend is not in use. User-facing messages MUST use Notice with short, safe text only; technical or diagnostic detail MUST be written to the browser console (matching existing plugin behaviour and constitution).
- **FR-013**: When the environment cannot run the in-browser backend (e.g. missing or unsupported capabilities), the plugin MUST show a clear message via Obsidian Notice, MUST offer the user the option to use the API backend for this transcription (e.g. “Use cloud instead?”), and MUST log a message to the browser console (e.g. console.error or console.warn with technical detail). Notice content MUST be short and user-safe; no API keys, stack traces, or sensitive details in the Notice; details only in console.
- **FR-009**: The in-browser backend MUST ship with a small default model bundled in the plugin so it works offline from first use; users MUST be able to download and use other models if they want. "Small" is defined for packaging by a named default (e.g. whisper-tiny.en) and/or a size bound (e.g. &lt;50 MB) so the plugin bundle remains acceptable per SC-002.
- **FR-010**: The existing API backend MUST remain available and selectable; in-browser is an additional option only.
- **FR-011**: No existing plugin code MUST be modified. The new local backend is implemented as new code extensions only. The setting for backend choice effectively swaps which transcription endpoint is used (cloud or local); the audio recording pipeline (recording, upload, Blob → AudioHandler) remains exactly as it is today.
- **FR-012**: Changes for this feature are limited to (1) under-the-hood addition of the local transcription path that returns the same response contract as the cloud endpoint, and (2) GUI changes (e.g. settings) to select the backend and show backend-specific options. No edits to existing pipeline or handler logic.

### Key Entities

- **Transcription backend**: The mechanism that turns audio into text. Has type (API vs in-browser) and type-specific options (API key/URL/model vs local model id and per-model metadata such as max recommended duration for display in settings).
- **Settings**: Stored preferences including backend type, output paths, create-new-file vs insert, and backend-specific options. One consistent storage and UI surface for all backends.
- **Audio input**: Recording or uploaded file; same blob and filename for all backends; backend only determines how text is produced.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users who select the in-browser backend can complete a full record-or-upload-to-note flow without entering an API key or sending audio to a server.
- **SC-002**: Plugin bundle size and packaging complexity remain acceptable for a single Obsidian plugin (no separate server or multi-step install beyond the plugin).
- **SC-003**: Users can switch between API and in-browser backends in settings and get correct, predictable behaviour for each without breaking the other.
- **SC-004**: In-browser transcription runs without freezing the app; status reflects Recording and Processing so users understand what is happening.
- **SC-005**: First-time use of the in-browser backend sets clear expectations (e.g. one-time preparation); subsequent runs start transcription without repeating full setup when possible.

## Assumptions

- The existing plugin contract (single entry point, vault/editor behaviour, settings storage, commands, feedback) remains; only the implementation of “audio → text” is extended with a second backend.
- Existing plugin code (recording pipeline, AudioHandler path resolution and vault/editor behaviour, Controls, StatusBar, etc.) is not edited; the local processing model is added as new code extensions that plug in as the local endpoint.
- In-browser ASR runs in the same process as the plugin (e.g. worker or main thread with non-blocking pattern); no separate long-lived server.
- A small default model is bundled for offline-first use; additional models can be offered as optional downloads; model choice can be a setting (e.g. default vs downloaded options).
- Obsidian’s environment (Electron) supports the APIs required for in-browser ASR (e.g. Web Workers, required runtimes). If not, the feature will surface a clear error.
