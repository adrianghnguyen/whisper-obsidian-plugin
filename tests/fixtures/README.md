# Audio fixtures for manual / smoke tests

These files are **not** loaded by Vitest. They exist for `scripts/smoke-test-whistle.mjs` and local debugging.

| File | Description |
| --- | --- |
| `smoke-whistle-hello.wav` | Short espeak-ng phrase (“Hello, this is a Whistle smoke test.”). Default input for the Whistle smoke script. |
| `sample-tone.wav` | Synthetic dual-tone clip (16 kHz mono). Useful to verify load + transcribe wiring; Whistle may not produce meaningful words. |

Use your own `.wav`, `.mp3`, or `.webm` for realistic speech; ffmpeg must be on `PATH`.
