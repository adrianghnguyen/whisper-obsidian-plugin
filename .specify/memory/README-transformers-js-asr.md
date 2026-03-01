# Optional local transcription backend – Obsidian plugin requirements

This note states what **Obsidian** requires from the whisper plugin when adding an optional local (client-side) transcription path. It does not specify how that path is implemented; it only specifies the plugin contract, APIs, and UX that Obsidian imposes.

See [whisper-plugin-architecture.md](whisper-plugin-architecture.md) for the overall architecture.

---

## What Obsidian expects from the plugin

- **Entry**: A single Plugin class (default export from `main.js`), declared in `manifest.json`. No separate server or process.
- **Settings**: Stored via `plugin.loadData()` / `plugin.saveData()`; edited in a `PluginSettingTab` (e.g. [src/WhisperSettingsTab.ts](src/WhisperSettingsTab.ts)). All backend-specific options (API key, URL, model, or “local” model id) live in that stored settings object.
- **Commands**: Registered in `onload()` with `plugin.addCommand()`. The existing “Start/stop recording” and “Upload audio file” commands stay; they call the same handler. No new commands are required to support a local backend.
- **UI feedback**: Use Obsidian’s APIs only: `StatusBar` for state (Idle / Recording / Processing), `Notice` for short user messages. Long-running work (e.g. local transcription) must not block the main thread so the app stays responsive; how that is done (e.g. Web Worker) is an implementation detail.
- **Vault and editor**: File creation and edits go through `plugin.app.vault` and the active `MarkdownView`’s editor. No direct filesystem or DOM hacks.

---

## Single transcription entry point

The plugin has one place where “audio in → text out” happens: **AudioHandler.sendAudioData(blob, fileName)**.

Obsidian-relevant contract:

| Obsidian requirement | How the plugin satisfies it |
|----------------------|------------------------------|
| One flow for both recording and upload | Both paths end in `audioHandler.sendAudioData(blob, fileName)`. |
| Result must become vault content or editor text | After obtaining a single `text` string, the plugin uses `vault.create()` for a new note or `editor.replaceRange()` / `editor.setCursor()` for insert at cursor. |
| Paths and options come from settings | `audioFilePath`, `noteFilePath`, and “create new file vs insert” are derived from `plugin.settings` (paths, toggles). Same for any backend choice. |

So for Obsidian, the only requirement for “local backend” is: **inside `sendAudioData`, some code path (chosen by settings) turns the same `Blob` + fileName into one `text` string**, then the existing vault/editor logic runs unchanged. No new Obsidian APIs, commands, or UI flows.

---

## Where the backend is chosen (Obsidian side)

Branching happens **inside** [src/AudioHandler.ts](src/AudioHandler.ts), after:

- Path resolution (from settings),
- Optional save of the blob to the vault (`vault.adapter.writeBinary`),

and before:

- Creating the note or inserting at cursor.

Obsidian does not care how each branch gets `text` (HTTP vs local). It only requires that the plugin does not block the UI for long periods and that it uses `Notice` for errors and optional progress, not raw alerts or console-only feedback.

---

## Settings (Obsidian storage and UI)

- **Storage**: All options are in one settings object saved with `plugin.saveData()`. Adding a “transcription backend” option (e.g. `openai` vs `local`) is just one more field; when backend is `local`, fields like API key and API URL can be ignored or hidden in the settings tab.
- **Settings tab**: Built in `PluginSettingTab.display()`. The tab can show different fields depending on backend (e.g. “API key” and “API URL” for OpenAI; “Local model” for local). Same `plugin.settings` and `settingsManager.saveSettings()`; no extra Obsidian APIs.
- **No secrets in UI**: Constitution requires that API keys and technical details are not shown in Notices or in the UI; only in the settings tab where the user explicitly configures them.

---

## Build and runtime (what Obsidian expects)

- **Artifacts**: Obsidian loads `main.js`, `manifest.json`, and `styles.css`. The plugin must work as a single bundle (or load additional code from that bundle). No separate server; no requirement that Obsidian “host” a backend.
- **Environment**: The plugin runs inside Obsidian (Electron). It has access to the same APIs as any plugin: vault, workspace, editor, status bar, and the JavaScript/browser APIs that Obsidian’s process provides. Long-running work should be done in a way that keeps the main thread responsive (Obsidian does not specify how; that’s an implementation choice).

---

## Summary (Obsidian-only)

| Topic | What Obsidian needs from the plugin |
|-------|-------------------------------------|
| **Entry point** | One method consumes `(blob, fileName)` and eventually produces one `text` string; backend (API or local) is an internal branch. |
| **Vault/editor** | Use `vault.adapter.writeBinary`, `vault.create`, `workspace.getActiveViewOfType(MarkdownView)`, `editor.replaceRange`, `editor.setCursor`. Same for any backend. |
| **Settings** | One settings object (`loadData`/`saveData`); settings tab shows backend-appropriate fields; no API key for local. |
| **Commands** | No new commands; existing commands keep calling `sendAudioData`. |
| **Feedback** | StatusBar for state; Notice for messages and errors; long work must not freeze the UI. |
| **Build** | Single plugin bundle; no server; optional local path is just code inside that bundle. |

This keeps the doc focused on Obsidian’s requirements. How the local path turns a Blob into text (e.g. which library or worker) is outside this note.
