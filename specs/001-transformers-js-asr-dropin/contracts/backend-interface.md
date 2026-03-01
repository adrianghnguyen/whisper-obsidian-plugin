# Contract: Transcription backend interface (internal)

**Feature**: 001-transformers-js-asr-dropin  
**Consumer**: AudioHandler  
**Implementors**: API path (existing), local ASR path (new)

## Purpose

AudioHandler needs a single abstraction to obtain transcription from either backend. This document describes the internal interface that both paths must satisfy so AudioHandler can call “get text from this blob” without knowing the backend.

## Interface

**Method (conceptual)**: `transcribe(blob: Blob, fileName?: string): Promise<{ text: string }>`

- **Input**: Audio as `Blob`; optional `fileName` for context (e.g. logging).  
- **Output**: Promise resolving to an object with at least `text: string`, matching [transcription-response.md](transcription-response.md).  
- **Errors**: Rejected promise or thrown error; caller (AudioHandler) shows Notice and logs as per constitution.

## Implementations

- **API**: Build FormData from blob, POST to `apiUrl`, read `response.data.text`; return `{ text: response.data.text }`.
- **Local**: Send blob (or object URL) to worker or in-process service; run Transformers.js ASR pipeline; merge chunks if needed; return `{ text: string }`.

## Notes

- This is an internal design contract for the codebase, not a user-facing or HTTP API.
- AudioHandler may branch on `settings.transcriptionBackend` to choose which implementation to call, but after the call it only uses `{ text }` for vault/editor logic.
