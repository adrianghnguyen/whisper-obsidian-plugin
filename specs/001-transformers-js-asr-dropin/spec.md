# Feature Specification: In-browser ASR (Transformers.js) as drop-in backend

**Feature Branch**: `001-transformers-js-asr-dropin`  
**Created**: 2025-03-01  
**Status**: Draft  
**Input**: User description: "I want to be able to use the ASR Transformers.js skill as a drop-in replacement for the existing whisper plugin. It should have a minimal footprint and easy to package into the plugin. It'll need to minimally impact the existing plugin. Ask me for clarifications."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Transcribe using in-browser ASR (Priority: P1)

A user who prefers not to use an external API or wants to work offline selects the in-browser transcription backend in settings. They record or upload audio as they do today. The plugin transcribes the audio locally in the app and creates or updates the note with the same behaviour as the existing API path (new file or insert at cursor, same paths and options).

**Why this priority**: Delivers the core value of the feature—local transcription without a server.

**Independent Test**: Can be fully tested by selecting the in-browser backend, recording or uploading a short audio file, and verifying the resulting text appears in a new note or at the cursor as configured.

**Acceptance Scenarios**:

1. **Given** the user has selected the in-browser ASR backend and configured output path/options, **When** they finish a recording or upload an audio file, **Then** transcription runs without calling an external API and the resulting text is written to the vault or editor per settings.
2. **Given** the in-browser backend is selected, **When** transcription is in progress, **Then** the main UI stays responsive (no freezing) and the user sees clear status feedback (e.g. Idle / Recording / Processing).
3. **Given** the in-browser backend is selected and no API key is set, **When** the user records or uploads audio, **Then** transcription still runs successfully without prompting for an API key.

---

### User Story 2 - Switch between API and in-browser backend (Priority: P2)

A user can choose in settings which transcription backend to use (existing API or in-browser ASR). Only the options relevant to the selected backend are shown or required. Changing the backend does not require changing any other workflow; record and upload flows stay the same.

**Why this priority**: Ensures the new backend fits the existing plugin model and avoids breaking current API users.

**Independent Test**: Can be tested by toggling the backend in settings, then performing a recording or upload and confirming the correct backend is used and the right options are visible.

**Acceptance Scenarios**:

1. **Given** the settings tab is open, **When** the user changes the transcription backend, **Then** the form shows only the options that apply to that backend (e.g. no API key when in-browser is selected).
2. **Given** the user has previously used the API backend, **When** they switch to the in-browser backend and transcribe, **Then** no API request is made and transcription uses the local path only.

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

- What happens when the user selects in-browser backend but the environment cannot run it (e.g. missing or unsupported capabilities)? The system should show a clear message and not silently fail.
- How does the system handle very long audio (e.g. beyond a few minutes) with the in-browser backend? Either support chunked processing with progress feedback or enforce a reasonable limit and inform the user.
- What happens when model download or preparation is interrupted (e.g. network off, user closes app)? The system should allow retry and avoid leaving the plugin in an inconsistent state.
- If the user has no API key and selects the API backend, existing behaviour (e.g. notice asking for API key) applies; the in-browser backend does not change that.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The plugin MUST support a configurable transcription backend so the user can choose between the existing API-based backend and an in-browser ASR backend.
- **FR-002**: When the in-browser backend is selected, the plugin MUST produce transcription text from audio (recording or upload) without sending audio to an external API.
- **FR-003**: The single entry point for transcription (record and upload) MUST remain unchanged; backend selection only affects how audio is turned into text internally.
- **FR-004**: The plugin MUST keep the main UI responsive during in-browser transcription (e.g. long-running work must not block the main thread).
- **FR-005**: The plugin MUST use the same vault and editor behaviour for in-browser transcription as for the API backend (create new file vs insert at cursor, paths, and related settings).
- **FR-006**: Settings MUST store the chosen backend and any backend-specific options (e.g. in-browser model identifier); the settings UI MUST show only relevant options for the selected backend.
- **FR-007**: The plugin MUST provide clear user feedback for in-browser transcription state (e.g. Idle / Recording / Processing) and for errors or progress (e.g. model preparation), using the same feedback mechanisms as today (e.g. status bar, notices).
- **FR-008**: The in-browser backend MUST ship with a small default model bundled in the plugin so it works offline from first use; users MUST be able to download and use other models if they want.
- **FR-009**: The existing API backend MUST remain available and selectable; in-browser is an additional option only.

### Key Entities

- **Transcription backend**: The mechanism that turns audio into text. Has type (API vs in-browser) and type-specific options (API key/URL/model vs local model id, etc.).
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
- In-browser ASR runs in the same process as the plugin (e.g. worker or main thread with non-blocking pattern); no separate long-lived server.
- A small default model is bundled for offline-first use; additional models can be offered as optional downloads; model choice can be a setting (e.g. default vs downloaded options).
- Obsidian’s environment (Electron) supports the APIs required for in-browser ASR (e.g. Web Workers, required runtimes). If not, the feature will surface a clear error.
