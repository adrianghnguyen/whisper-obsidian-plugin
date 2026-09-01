# AGENTS.md

Fork of [nikdanilov/whisper-obsidian-plugin](https://github.com/nikdanilov/whisper-obsidian-plugin). Day-to-day work targets `origin` (`adrianghnguyen/whisper-obsidian-plugin`). Plugin id stays `whisper`.

## Deploy

Staging first: copy `main.js`, `manifest.json`, and `styles.css` to `C:\plugin-sandbox-Obsidian\.obsidian\plugins\whisper\`, then `obsidian plugin:reload id=whisper vault=plugin-sandbox-Obsidian`. Promote to `C:\Obsidian\.obsidian\plugins\whisper\` only when asked. Community Update overwrites the fork build.

## Tests

`npm test` is offline (Vitest). Live session tests in `tests/GeminiLiveTranscriber.test.ts` use a fake WebSocket. Protocol helpers live in `tests/liveProtocol.test.ts`. Those mocks cannot catch Gemini Live API protocol drift.

## Gemini Live hard debug

When the mic session connects but nothing is transcribed, or when Google may have changed the Live wire format, run the real-network smoke test. It is **not** part of `npm test` so CI stays offline.

Needs Node 22+ (global `WebSocket`), `ffmpeg` on PATH, a short spoken audio file, and `GEMINI_API_KEY` from the environment. That is the same Google AI Studio key as Settings → Whisper → Gemini API Key (REST and Live share it). Never hardcode or commit the key.

```powershell
Set-Location C:\Coding_projects\whisper-obsidian-plugin
$env:GEMINI_API_KEY = "<key>"
node scripts/smoke-test-live.mjs path\to\speech.webm
```

Expect `Setup complete.` then `[INTERIM]` / `[FINAL]` lines. If setup succeeds and no transcripts appear, the wire protocol likely drifted: wait for `setupComplete` before sending PCM, use `realtimeInput.audio` (not deprecated `mediaChunks`), decode Blob/binary frames before `JSON.parse`, and end with `audioStreamEnd`.

Optional: `$env:DEBUG_WS = "1"` logs truncated raw server messages.

The smoke test also accepts optional VAD overrides so pause-tolerance behavior can be verified against the real network: `$env:GEMINI_LIVE_SILENCE_MS = "2500"` enables `realtimeInputConfig.automaticActivityDetection` (with `GEMINI_LIVE_END_SENSITIVITY`, `GEMINI_LIVE_START_SENSITIVITY`, `GEMINI_LIVE_PREFIX_PADDING_MS` as further overrides). Omit `GEMINI_LIVE_SILENCE_MS` for plain server defaults. Note: on `gemini-3.1-flash-live-preview` `silenceDurationMs` has been reported as ignored (js-genai#1467); `gemini-3.5-transcribe-live` honors it per the capabilities guide.

Vault catalog: `Notes/obsidian plugin tweaks.md`.
