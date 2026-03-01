# Research: In-browser ASR (Transformers.js) drop-in

**Feature**: 001-transformers-js-asr-dropin  
**Date**: 2025-03-01

## 1. In-browser ASR library

**Decision**: Use **@huggingface/transformers** (Transformers.js) with the `automatic-speech-recognition` pipeline.

**Rationale**: Runs entirely in the browser via ONNX Runtime/WebAssembly; no backend server. Pipeline API returns `{ text }` (and optional timestamps), which matches the plugin’s existing response contract. Well-suited for Obsidian’s Electron environment; models available on Hugging Face Hub with ONNX weights.

**Alternatives considered**: (1) Native Web Speech API — limited to browser engine, no Whisper-quality control. (2) External local server (e.g. whisper.cpp) — violates “no separate backend” (constitution). (3) @xenova/transformers — predecessor of @huggingface/transformers; Hugging Face package is the current maintained option.

---

## 2. Keeping the main thread responsive

**Decision**: Run the ASR pipeline inside a **Web Worker**. Main thread only sends blob (or URL) to the worker and receives `{ text }` (or error) via postMessage.

**Rationale**: Constitution and spec require the main UI to stay responsive during transcription. Transformers.js inference can be long-running; running it in a worker avoids blocking the UI and matches Obsidian’s single-process plugin model.

**Alternatives considered**: (1) Main-thread async — still blocks during CPU-heavy inference. (2) Separate process — not part of the Obsidian plugin contract; adds complexity.

---

## 3. Default model and optional models

**Decision**: Ship a **small default model** (e.g. Xenova/whisper-tiny.en or similar quantized model) **bundled in plugin assets** so the plugin works offline from first use (no first-time download). "Small" is defined by a named model id and/or size bound (e.g. &lt;50 MB) to keep the plugin bundle acceptable (SC-002). Store a **model identifier** in settings; allow users to **choose other models** (e.g. from a list or URL) that are downloaded on demand. Display **max recommended duration** per model in settings (e.g. from a small registry or model metadata).

**Rationale**: Spec requires “small default model bundled” and “users can download and use other models.” Whisper-style models have ~30 s chunk limits; per-model max duration in settings satisfies the requirement to “list the max recommended duration for the selected local model.”

**Alternatives considered**: (1) No bundled model — poor first-run experience. (2) Single fixed model only — contradicts requirement for optional other models.

---

## 4. Contract alignment with existing API

**Decision**: Local path returns the **same shape** as the API: `{ text: string }`. No branching in downstream vault/editor logic; AudioHandler treats both backends identically after obtaining `text`.

**Rationale**: Constitution and spec require pluggable backends to expose the same response contract. Architecture doc already describes single flow: Blob → transcription → `text` → vault/editor.

**Alternatives considered**: Extending the contract (e.g. timestamps) would require downstream changes; deferred or optional in a later iteration.

---

## 5. Environment capability check and fallback

**Decision**: Before running local transcription, **detect** whether the environment can run the in-browser backend (e.g. Worker support, WASM/ONNX). If not: show a short **Notice**, offer **“Use cloud instead?”** (or equivalent), and **log** technical details to the console only.

**Rationale**: Spec and clarifications: user-facing message via Notice (short, safe); technical detail only in console; option to use API for this transcription.

---

## 6. Long audio and chunking

**Decision**: Do **not** impose a plugin-level duration limit (matches existing cloud path). Rely on **pipeline options** (e.g. `chunk_length_s: 30`) so the local backend chunks internally and returns a **single merged text** to preserve the existing contract.

**Rationale**: Spec states plugin does not enforce duration limit; settings show max recommended duration per model; implementation may chunk internally and still return one `text`.

---

## Summary table

| Topic              | Decision / practice                                      |
|--------------------|----------------------------------------------------------|
| Library            | @huggingface/transformers, ASR pipeline                  |
| Threading           | Web Worker for inference                                 |
| Default model      | Small bundled model; optional other models in settings   |
| Response contract  | `{ text: string }` only for downstream                    |
| Capability check   | Detect; Notice + “Use cloud?”; console for details        |
| Long audio         | Chunk inside pipeline; single merged `text`              |
