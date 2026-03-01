# Contract: Transcription response

**Feature**: 001-transformers-js-asr-dropin  
**Consumers**: AudioHandler (vault/editor logic after obtaining text)  
**Producers**: API backend (HTTP), local in-browser backend (Transformers.js)

## Purpose

Pluggable backends (API vs in-browser) must expose the same response so downstream code does not branch on backend type. This contract is the single shape both backends must produce.

## Response shape

**Type**: JSON-like object (or equivalent in TypeScript).

| Field | Type   | Required | Description |
|-------|--------|----------|-------------|
| `text` | string | Yes      | Single transcription result. May be the concatenation of chunked results for long audio. |

**Example**:

```json
{ "text": "Hello, this is the transcribed text." }
```

## Consumer usage

- **AudioHandler**: After calling the selected backend (API or local), reads `response.text` (or equivalent) and then:
  - If “create new file”: creates note with `![[audioFilePath]]` and `text`, opens it.
  - Else: inserts `text` at cursor in active Markdown view.
- No branching on backend type; only one code path for “given `text`, write to vault/editor.”

## Producer obligations

- **API backend**: Existing behaviour — HTTP response body with `{ text: string }`.
- **Local backend**: Must resolve to the same shape (e.g. from Transformers.js ASR pipeline result, merge chunks if needed, return `{ text: string }`). Must not return extra fields to this contract’s consumers (extra fields may exist internally but are not part of the plugin’s downstream contract).

## Versioning

Current version: single field `text`. If timestamps or segments are added later, they will be optional and downstream logic will remain compatible with “text only.”
