# Implementation Plan: In-browser ASR (Transformers.js) as drop-in backend

**Branch**: `001-transformers-js-asr-dropin` | **Date**: 2026-03-01 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-transformers-js-asr-dropin/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add an optional in-browser ASR backend using Transformers.js so users can transcribe locally without an API. The existing record/upload flow and vault/editor behaviour stay the same; only the "audio → text" step gains a second implementation (local) behind the same response contract (`{ text: string }`). Technical approach: @huggingface/transformers ASR pipeline in a Web Worker for non-blocking UI; small default model bundled; optional other models; capability check with Notice + "Use cloud instead?" and console-only technical detail.

## Technical Context

**Language/Version**: TypeScript (as in repo; esbuild bundle)  
**Primary Dependencies**: Obsidian plugin API, esbuild, axios; for this feature add Transformers.js (e.g. @huggingface/transformers) for in-browser ASR  
**Storage**: N/A (plugin settings via `plugin.loadData()` / `plugin.saveData()`; no separate database)  
**Testing**: Manual verification in Obsidian before release (per constitution); `npm test && npm run lint` for build and lint  
**Target Platform**: Obsidian desktop and mobile (Electron; minAppVersion as in manifest)  
**Project Type**: Obsidian plugin (community plugin / desktop-app)  
**Performance Goals**: Main UI responsive during in-browser transcription; no freezing; status reflects Idle / Recording / Processing  
**Constraints**: Same response contract as existing API (`{ text: string }`); minimal footprint and packaging; default model size bound (e.g. &lt;50 MB per FR-009); no modification of existing plugin code except minimal wiring and GUI (backend selector, settings).  
**Scale/Scope**: Single plugin bundle; one new local transcription path; settings extension; new modules only (e.g. local ASR, worker).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|-----------|--------|--------|
| **I. Obsidian-first** | Feature delivered as plugin capabilities; Obsidian API only; no separate backend or server. | PASS — In-browser ASR runs inside the plugin (Worker or main-thread async); no external server. |
| **II. User privacy and API safety** | API keys not exposed; user-facing Notice short and safe; technical/diagnostic detail only in console. | PASS — Spec FR-008, FR-013: Notice short/safe; console for detail; no keys or stack traces in Notice. |
| **III. Simplicity and maintainability** | Minimal codebase; extensions/wrappers preferred; minimal changes to existing plugin classes. | PASS — FR-012: New code extensions only; backend selection swaps endpoint; no edits to recording pipeline or handler logic except minimal wiring and GUI. |
| **IV. Conventional commits and versioning** | Conventional commit syntax; version in sync across manifest, package.json, versions.json, tags. | PASS — No change to release or versioning process. |
| **V. Quality gates** | Build passes (TypeScript, esbuild); lint/format applied; manual verification in Obsidian before release. | PASS — Same as today. |
| **Technical constraints** | Stack (TypeScript, Obsidian API, esbuild, axios); scope (client-only); architecture and data contract; extensions only. | PASS — Same response contract for both backends; new behaviour in new modules; architecture doc respected. |

**Gate result**: All checks pass. No violations requiring justification.

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
src/
├── AudioHandler.ts      # Minimal branch: call API or local backend; same vault/editor path after { text }
├── SettingsManager.ts   # Extended: transcriptionBackend, localModelId (minimal wiring)
├── WhisperSettingsTab.ts # Extended: backend selector, backend-specific options (GUI only)
├── StatusBar.ts         # Extended: show "Whisper(Local)" when local backend selected
├── localAsr/            # NEW: Transformers.js ASR pipeline (e.g. in Worker), transcribe(blob) → Promise<{ text }>
├── [existing files unchanged]
main.ts                  # Minimal wiring: pass backend choice into components

tests/
```

**Structure Decision**: Single project (existing repo layout). New behaviour lives under `src/localAsr/` and minimal extensions to SettingsManager, WhisperSettingsTab, AudioHandler, StatusBar; no new top-level apps or backend/frontend split.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. Table left empty.
