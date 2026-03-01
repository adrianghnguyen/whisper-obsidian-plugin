# Quickstart: 001-transformers-js-asr-dropin

**Branch**: `001-transformers-js-asr-dropin`  
**Date**: 2025-03-01

## Goal

Implement an optional in-browser ASR backend using Transformers.js so users can transcribe locally without an API. The existing record/upload flow and vault/editor behaviour stay the same; only the “audio → text” step gains a second implementation (local) behind the same response contract.

## Prerequisites

- Repo build passes (TypeScript, esbuild) as today.
- Read [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), and [data-model.md](data-model.md).
- Architecture and Obsidian requirements: [.specify/memory/whisper-plugin-architecture.md](.specify/memory/whisper-plugin-architecture.md), [.specify/memory/README-transformers-js-asr.md](.specify/memory/README-transformers-js-asr.md).

## Contracts

- **Transcription response**: Both backends return `{ text: string }`. See [contracts/transcription-response.md](contracts/transcription-response.md).
- **Backend abstraction**: AudioHandler calls one of two implementations (API or local) that both satisfy “blob in → `Promise<{ text }>` out.” See [contracts/backend-interface.md](contracts/backend-interface.md).

## Implementation order (suggested)

1. **Settings**: Extend `WhisperSettings` with `transcriptionBackend` and `localModelId`; extend `WhisperSettingsTab` to show backend selector and backend-specific options (hide API key when local; show local model and max recommended duration when local).
2. **Local ASR module**: Add `src/localAsr/` (or equivalent): load Transformers.js ASR pipeline (e.g. in a Web Worker), implement `(blob) => Promise<{ text }>`, handle chunking for long audio, use a small default model and optional model choice from settings.
3. **AudioHandler**: Add minimal branching: if backend is local, call local ASR instead of HTTP; on result, use existing vault/editor path with `response.text`. Preserve existing API path unchanged.
4. **Status bar**: When backend is local, show “Whisper(Local) Idle / Recording / Processing” (or equivalent) per spec.
5. **Capability check**: Before running local transcription, detect if environment supports the local backend; if not, show Notice, offer “Use cloud instead?”, log detail to console.
6. **First-run**: When local model is used for the first time, show progress/notice for model preparation; subsequent runs reuse cached model.

## Key constraints

- No edits to existing pipeline or handler logic except minimal wiring and backend branch.
- New behaviour in new modules; same response contract for both backends.
- Notice: short, safe text only; technical detail in console only.

## Next step

Run **/speckit.tasks** to break this plan into concrete tasks (e.g. in `tasks.md`).
