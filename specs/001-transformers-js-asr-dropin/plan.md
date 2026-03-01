# Implementation Plan: In-browser ASR (Transformers.js) as drop-in backend

**Branch**: `001-transformers-js-asr-dropin` | **Date**: 2025-03-01 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-transformers-js-asr-dropin/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add an optional in-browser ASR backend using Transformers.js so users can transcribe audio locally without an API. The plugin keeps a single entry point (record/upload → AudioHandler); backend selection in settings swaps the transcription path (HTTP vs local). The local path returns the same `{ text }` contract as the API so vault/editor logic is unchanged. New code is implemented as extensions/wrappers only (new modules); minimal wiring in settings and AudioHandler to choose backend and show backend-specific options.

## Technical Context

**Language/Version**: TypeScript (as in repo; esbuild bundle)  
**Primary Dependencies**: Obsidian plugin API, esbuild, axios; for this feature add **@huggingface/transformers** (Transformers.js) for in-browser ASR (see [research.md](research.md)).  
**Storage**: Obsidian plugin scope only — `plugin.loadData()` / `plugin.saveData()` for settings; no separate DB  
**Testing**: Manual verification in Obsidian before release (constitution); no automated test suite required  
**Target Platform**: Obsidian desktop and mobile (Electron; minAppVersion as in manifest)  
**Project Type**: Obsidian plugin (single bundle, client-side only)  
**Performance Goals**: Main UI stays responsive during in-browser transcription (long-running work off main thread, e.g. Web Worker)  
**Constraints**: Same response contract as existing API (`{ text: string }`); minimal footprint; new code as extensions only; no edits to existing pipeline/handler logic except minimal wiring  
**Scale/Scope**: Single plugin; one new backend option; one settings surface; existing commands and flows unchanged  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Constraint | Status | Notes |
|------------------------|--------|--------|
| **I. Obsidian-first** | ✅ | All delivery via plugin (commands, settings, ribbon, vault); no separate backend/server. |
| **II. User privacy and API safety** | ✅ | No API key for local path; Notice short/safe; technical detail in console only. |
| **III. Simplicity and maintainability** | ✅ | New code as extensions/wrappers; minimal changes to existing plugin classes (settings + backend selector only). |
| **IV. Conventional commits and versioning** | ✅ | No change to release or versioning process. |
| **V. Quality gates** | ✅ | Build and lint as today; manual verification in Obsidian. |
| **Data contract** | ✅ | Pluggable backends expose same response (`{ text }`); no consumer branching. |
| **Extensions and wrappers** | ✅ | New behaviour in new modules; existing code unchanged except minimal wiring/GUI. |

**Gate result**: PASS — no violations. Complexity Tracking table not required.

## Project Structure

### Documentation (this feature)

```text
specs/001-transformers-js-asr-dropin/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
main.ts                  # Plugin class; minimal wiring for backend choice if needed
src/
├── AudioHandler.ts      # Minimal change: branch by backend; call local or API path; same downstream
├── SettingsManager.ts   # Extend WhisperSettings (backend type, local model id, etc.); no structural change
├── WhisperSettingsTab.ts # Conditional UI for backend (API vs local options)
├── StatusBar.ts         # Optional: display "Whisper(Local)" when local backend selected
├── AudioRecorder.ts     # No change
├── Controls.ts          # No change
├── Timer.ts             # No change
├── utils.ts             # No change
├── localAsr/            # NEW: local ASR path (Transformers.js, worker, model loading)
│   ├── index.ts         # or LocalTranscriptionService — (blob) => Promise<{ text }>
│   ├── worker.ts        # Optional: worker entry for non-blocking run
│   └── modelRegistry.ts # Optional: model id → config (e.g. max recommended duration)
└── ...
```

**Structure Decision**: Single Obsidian plugin codebase. New behaviour lives under `src/localAsr/` (or equivalent) and is invoked from `AudioHandler` when backend is local. No new top-level apps or backends. The **default ASR model** (e.g. whisper-tiny.en) is **bundled in plugin assets** so the plugin works offline from first use; optional models are downloaded on demand (see research.md and FR-009).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Not applicable — no violations.
