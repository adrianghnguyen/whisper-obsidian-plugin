# Audio fixtures for manual / smoke tests

These files are **not** loaded by Vitest. They exist for voice-clip smokes and local debugging.

| File | Description |
| --- | --- |
| `voice-smoke-hello.wav` | Short spoken phrase for `npm run smoke:voice-clip`. Same clip as Cloud E2E `obsidian-plugin-development/scripts/cloud-e2e/fixtures/voice/smoke-hello.wav`. |
| `sample-tone.wav` | Synthetic dual-tone clip (16 kHz mono). Wiring checks only; not meaningful speech. |

Sandbox default: `run-voice-clip-smoke.sh whistle` passes the shared Cloud clip (or set `CLOUD_E2E_VOICE_CLIP`).
