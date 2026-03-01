# Whisper plugin – high-level architecture

## Entry and build

- **Obsidian entry:** [main.ts](main.ts) exports the default `Whisper` class (extends Obsidian `Plugin`). Build output is `main.js` (esbuild from `main.ts`).
- **Manifest:** [manifest.json](manifest.json) identifies the plugin (id, name, version, minAppVersion); Obsidian loads `main.js` by convention.

---

## Class structure and ownership

All app logic lives under `src/`. The plugin instance is the single root that owns settings and core components.

```mermaid
flowchart TB
  Whisper[Whisper Plugin]
  SettingsManager[SettingsManager]
  WhisperSettingsTab[WhisperSettingsTab]
  Timer[Timer]
  AudioHandler[AudioHandler]
  NativeAudioRecorder[NativeAudioRecorder]
  StatusBar[StatusBar]
  Controls[Controls]
  Whisper --> SettingsManager
  Whisper --> WhisperSettingsTab
  Whisper --> Timer
  Whisper --> AudioHandler
  Whisper --> NativeAudioRecorder
  Whisper --> StatusBar
  Whisper -.->|"created on demand"| Controls
  WhisperSettingsTab --> SettingsManager
  Controls --> Timer
  Controls --> NativeAudioRecorder
  Controls --> AudioHandler
  Controls --> StatusBar
```

**Core types:**

- **Whisper** ([main.ts](main.ts)) – Holds `settings: WhisperSettings`, `settingsManager`, `timer`, `recorder`, `audioHandler`, optional `controls`, `statusBar`. In `onload()`: loads settings, adds ribbon (opens Controls), settings tab, timer, AudioHandler, NativeAudioRecorder, StatusBar, and commands (start/stop recording, upload file).
- **SettingsManager** ([src/SettingsManager.ts](src/SettingsManager.ts)) – Loads/saves `WhisperSettings` via `plugin.loadData()` / `plugin.saveData()`. Defines `WhisperSettings` (API key/URL, model, prompt, language, save-audio/new-file toggles and paths, debug) and `DEFAULT_SETTINGS`.
- **WhisperSettingsTab** ([src/WhisperSettingsTab.ts](src/WhisperSettingsTab.ts)) – Obsidian `PluginSettingTab`. Uses plugin's `settingsManager`; in `display()` builds the settings UI and writes into `plugin.settings` then saves via `settingsManager.saveSettings()`.
- **Timer** ([src/Timer.ts](src/Timer.ts)) – Stateless elapsed-time counter (1s interval), `start()` / `pause()` / `reset()`, `getFormattedTime()`, optional `onUpdate` callback. Note: `pause()` toggles (stops interval if running, starts it if stopped; effectively pause/resume).
- **StatusBar** ([src/StatusBar.ts](src/StatusBar.ts)) – Single status bar item; shows `RecordingStatus` (Idle / Recording / Processing) and updates text/color.
- **Controls** ([src/Controls.ts](src/Controls.ts)) – Obsidian `Modal`. Holds Start/Pause/Stop buttons and timer display; wires button clicks to `recorder` and `audioHandler`, and uses `plugin.timer` with `setOnUpdate()` to refresh the display. Created lazily when the ribbon is clicked; closed in `onunload`.

**Audio abstraction:**

- **AudioRecorder** ([src/AudioRecorder.ts](src/AudioRecorder.ts)) – Interface: `startRecording()`, `pauseRecording()`, `stopRecording(): Promise<Blob>`.
- **NativeAudioRecorder** – Implements `AudioRecorder` using browser `MediaRecorder` and `getUserMedia`. Picks first supported MIME among `audio/webm`, `audio/ogg`, `audio/mp3`, `audio/mp4`; collects chunks every 100ms; on `stopRecording()` returns one `Blob` and stops stream tracks. Exposes `getMimeType()` and `getRecordingState()` for UI and file naming.

**Audio handling and output:**

- **AudioHandler** ([src/AudioHandler.ts](src/AudioHandler.ts)) – Receives `(blob: Blob, fileName: string)`. Uses [utils.getBaseFileName](src/utils.ts) for note naming. Builds paths from settings (`saveAudioFilePath`, `createNewFileAfterRecordingPath`). Optionally saves the blob to the vault (`writeBinary`). Sends a `FormData` (file, model, language, optional prompt) to `plugin.settings.apiUrl` with Bearer token; expects JSON `{ text: string }`. Then either creates a new note (with `![[audioFilePath]]` and transcription) and opens it, or inserts `response.data.text` at the cursor in the active Markdown view.

---

## How audio is passed through

Two entry points produce a `Blob` + filename; the rest of the pipeline is shared.

**Path 1 – Live recording (ribbon or command "Start/stop recording"):**

1. User starts recording → `StatusBar` → Recording; `NativeAudioRecorder.startRecording()` (getUserMedia → MediaRecorder, chunks pushed to array).
2. User stops → `StatusBar` → Processing; `recorder.stopRecording()` → Blob from chunks, MIME from recorder; filename from current date + extension from `getMimeType()`.
3. `audioHandler.sendAudioData(blob, fileName)` is called (from [main.ts](main.ts) command or from [Controls.ts](src/Controls.ts) Stop button).

**Path 2 – Upload file (command "Upload audio file"):**

1. File input; user picks a file → `file.slice(0, file.size, file.type)` gives a Blob, `fileName = file.name`.
2. Same call: `audioHandler.sendAudioData(audioBlob, fileName)`.

**Inside AudioHandler.sendAudioData():**

1. Resolve paths (audio save path, note path) from settings and filename/base name.
2. Optionally write blob to vault at `audioFilePath`.
3. Build FormData (file, model, language, optional prompt), POST to `apiUrl`, read `response.data.text`.
4. If "create new file": create note with embed + text, open it; else insert text at cursor in active Markdown editor.

So **audio flows as:** Microphone/File → **Blob** → **AudioHandler** → (optional vault write) + **HTTP POST** → **response.data.text** → **vault note** (new file or cursor insert).

---

## Data flow summary

| Stage            | Data form                    | Where                              |
| ---------------- | ---------------------------- | ---------------------------------- |
| Capture          | MediaStream                  | NativeAudioRecorder (internal)     |
| After stop/pick  | Blob + fileName              | Passed to AudioHandler             |
| Optional persist | Uint8Array                   | vault.adapter.writeBinary          |
| API              | FormData (Blob as file)      | axios POST                         |
| API response     | `{ text }`                   | Used for note content / insert     |
| Output           | New .md file or editor range | vault.create / editor.replaceRange |

No queues or background workers; recording and upload both run the same synchronous chain in the main process (status bar shows Processing until `sendAudioData` finishes).

---

## File map (source)

| File                                                   | Role                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| [main.ts](main.ts)                                     | Plugin class, wiring, commands (record, upload)                    |
| [src/AudioRecorder.ts](src/AudioRecorder.ts)           | AudioRecorder interface, NativeAudioRecorder (MediaRecorder)       |
| [src/AudioHandler.ts](src/AudioHandler.ts)             | sendAudioData: save blob, POST to Whisper API, create/insert note  |
| [src/Controls.ts](src/Controls.ts)                    | Recording modal (buttons, timer), triggers recorder + audioHandler |
| [src/Timer.ts](src/Timer.ts)                           | Elapsed time and formatted string                                  |
| [src/StatusBar.ts](src/StatusBar.ts)                   | RecordingStatus enum, status bar item                              |
| [src/SettingsManager.ts](src/SettingsManager.ts)       | WhisperSettings type, defaults, load/save                          |
| [src/WhisperSettingsTab.ts](src/WhisperSettingsTab.ts) | Settings tab UI bound to plugin.settings                           |
| [src/utils.ts](src/utils.ts)                           | getBaseFileName (path + extension stripped)                       |

---

## External interfaces and behaviours

Reference for planning changes (e.g. local ASR): public APIs, types, and key behaviours. File paths below point to the implementing module.

### Types and enums

- **WhisperSettings** ([src/SettingsManager.ts](src/SettingsManager.ts)) – `apiKey`, `apiUrl`, `model`, `prompt`, `language`, `saveAudioFile`, `saveAudioFilePath`, `debugMode`, `createNewFileAfterRecording`, `createNewFileAfterRecordingPath`. Defaults in `DEFAULT_SETTINGS` (same file).
- **RecordingStatus** ([src/StatusBar.ts](src/StatusBar.ts)) – Enum: `Idle`, `Recording`, `Processing`. Used by StatusBar, Controls, and main.ts command for UI and flow control.

### Classes (constructor, public methods, behaviour)

- **Whisper** ([main.ts](main.ts)) – No public API beyond Obsidian `Plugin`. Owned fields: `settings`, `settingsManager`, `timer`, `recorder`, `audioHandler`, `controls` (nullable), `statusBar`. Lifecycle: `onload()` loads settings, creates components, adds ribbon, setting tab, commands; `onunload()` closes controls (if any), removes status bar.
- **SettingsManager** ([src/SettingsManager.ts](src/SettingsManager.ts)) – `constructor(plugin: Plugin)`. `loadSettings(): Promise<WhisperSettings>` (merge `DEFAULT_SETTINGS` with `plugin.loadData()`). `saveSettings(settings: WhisperSettings): Promise<void>` (calls `plugin.saveData`). No UI.
- **WhisperSettingsTab** ([src/WhisperSettingsTab.ts](src/WhisperSettingsTab.ts)) – `constructor(app: App, plugin: Whisper)`. `display(): void` rebuilds the full settings UI, reads/writes `plugin.settings`, saves via `settingsManager.saveSettings()`. Setting groups: API Key, API URL, Model, Prompt, Language, Save recording (toggle + “Recordings folder” path), Save transcription (toggle + “Transcriptions folder” path), Debug Mode. Path inputs are text fields; `getUniqueFolders()` used internally for folder list.
- **Timer** ([src/Timer.ts](src/Timer.ts)) – No constructor args. `setOnUpdate(callback: () => void)`, `start()`, `pause()`, `reset()`, `getFormattedTime(): string`. Behaviour: `elapsedTime` in ms; 1s interval; `pause()` toggles (stops interval if running, starts it if stopped); `reset()` clears time and interval and invokes `onUpdate`.
- **StatusBar** ([src/StatusBar.ts](src/StatusBar.ts)) – `constructor(plugin: Plugin)`. Adds one status bar item in constructor. `updateStatus(status: RecordingStatus)` sets `this.status` and refreshes DOM. `remove()` removes the item. Display: Idle = “Whisper Idle” (green); Recording = “Recording...” (red); Processing = “Processing audio...” (orange).
- **Controls** ([src/Controls.ts](src/Controls.ts)) – `constructor(plugin: Whisper)`. Extends Obsidian `Modal`; `open()` / `close()` from base. No other public methods; internal handlers: startRecording, pauseRecording, stopRecording, updateTimerDisplay, resetGUI. Behaviour: Start/Pause/Stop wired to recorder, timer, statusBar; on Stop → get blob, reset timer, call `audioHandler.sendAudioData(blob, fileName)`, then close modal. Buttons disabled by recorder state (start disabled when recording/paused; pause/stop disabled when inactive). Timer display updated via `plugin.timer.setOnUpdate()`.
- **AudioRecorder** ([src/AudioRecorder.ts](src/AudioRecorder.ts)) – Interface: `startRecording(): Promise<void>`, `pauseRecording(): Promise<void>`, `stopRecording(): Promise<Blob>`.
- **NativeAudioRecorder** ([src/AudioRecorder.ts](src/AudioRecorder.ts)) – Implements `AudioRecorder`. Additional: `getRecordingState(): "inactive" | "recording" | "paused" | undefined`, `getMimeType(): string | undefined`. Behaviour: first `startRecording()` calls `getUserMedia`, picks first supported MIME among webm/ogg/mp3/mp4, starts MediaRecorder with 100ms timeslice; chunks accumulated; `stopRecording()` returns Blob, clears chunks, stops stream tracks and nulls recorder. Subsequent `startRecording()` is no-op if recorder exists; `pauseRecording()` toggles pause/resume.
- **AudioHandler** ([src/AudioHandler.ts](src/AudioHandler.ts)) – `constructor(plugin: Whisper)`. `sendAudioData(blob: Blob, fileName: string): Promise<void>`. Behaviour: base name via `getBaseFileName(fileName)`; paths from settings (`saveAudioFilePath`, `createNewFileAfterRecordingPath`). If no `apiKey`, shows Notice and returns. If `saveAudioFile`, writes blob with `vault.adapter.writeBinary(audioFilePath, Uint8Array)`. Builds FormData (file, model, language, optional prompt), POST to `apiUrl` with Bearer token; expects `response.data.text`. If `createNewFileAfterRecording` or no active MarkdownView: creates note with `![[audioFilePath]]` and transcription, opens via `openLinkText`; else inserts at cursor and `setCursor`. Notices on success and on errors.

### Utils

- **getBaseFileName** ([src/utils.ts](src/utils.ts)) – `getBaseFileName(filePath: string): string`. Returns last path segment with extension stripped (by lastIndexOf `/` and `.`).

### Obsidian API usage

How the plugin uses Obsidian’s contracts; keep consistent when adding features (e.g. local backend, workers).

- **Lifecycle** – `onload`: load settings, create components, add ribbon, setting tab, commands. `onunload`: explicit cleanup only — `controls?.close()`, `statusBar.remove()`; no other listeners or UI to detach.
- **Vault** – `vault.adapter.writeBinary(path, Uint8Array)` for saving audio; `vault.create(path, content)` for new transcription notes. Paths are strings; no `vault.modify` or `TFile` for writes.
- **Editor** – Only the Obsidian Editor API: `getActiveViewOfType(MarkdownView)` then `view.editor`; `editor.getCursor()`, `editor.replaceRange(text, pos)`, `editor.setCursor(pos)`. No raw CodeMirror (desktop and mobile safe).
- **Commands** – `addCommand({ id, name, callback, hotkeys })`. Both commands use `callback` (not `editorCallback`); editor obtained inside callback via `getActiveViewOfType(MarkdownView)`. Command ids: `start-stop-recording` (hotkey Alt+Q), `upload-audio-file` (no default hotkey).
- **Manifest** – Entry is `main.js`. Convention: `id`, `name`, `version`, `minAppVersion`; optionally `description`, `author`, `authorUrl`.

---

This is the high-level architecture: one plugin root, clear ownership of components, and a single audio pipeline (Blob → AudioHandler → API → note) for both recording and file upload.

For what Obsidian requires from the plugin when adding an optional local transcription backend (contract, settings, vault/editor, no new commands), see [README-transformers-js-asr.md](README-transformers-js-asr.md).
