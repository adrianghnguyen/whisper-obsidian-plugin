# Tasks: In-browser ASR (Transformers.js) as drop-in backend

**Input**: Design documents from `specs/001-transformers-js-asr-dropin/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Manual verification in Obsidian per constitution; no automated test suite required.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single Obsidian plugin: `src/` at repository root (main.ts, src/AudioHandler.ts, src/localAsr/, etc.)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add dependency and local ASR module structure

- [ ] T001 Create src/localAsr/ directory with index.ts, worker.ts, and modelRegistry.ts per plan.md
- [ ] T002 [P] Add @huggingface/transformers dependency and ensure build (esbuild) supports worker entry if needed in package.json and build config

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend abstraction, settings, and local ASR implementation that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Define backend interface `transcribe(blob: Blob, fileName?: string): Promise<{ text: string }>` (type or interface) for AudioHandler in src/ or src/localAsr/
- [ ] T004 Extend WhisperSettings with transcriptionBackend and localModelId and default values in src/SettingsManager.ts (or where DEFAULT_SETTINGS are defined)
- [ ] T005 Extend WhisperSettingsTab with backend selector (API vs in-browser) and conditional options (hide API key when local; show local model when local) in src/WhisperSettingsTab.ts
- [ ] T006 [P] Create local model registry (modelId → maxRecommendedDurationSeconds) in src/localAsr/modelRegistry.ts
- [ ] T007 [P] Implement local ASR worker: load Transformers.js ASR pipeline, accept blob, return { text } in src/localAsr/worker.ts
- [ ] T008 Implement local ASR entry: (blob) => Promise<{ text }> delegating to worker with chunking for long audio in src/localAsr/index.ts
- [ ] T009 Bundle default ASR model (e.g. whisper-tiny.en) in plugin assets for offline-first use and wire it plus model choice from settings in src/localAsr/index.ts and build config (see research.md and FR-009)
- [ ] T010 Handle interrupted model load: on failure or cancel offer retry (e.g. Notice or status), reset loading state, log technical detail to console; avoid stuck "Loading" in src/localAsr/index.ts (and worker if applicable)

**Checkpoint**: Foundation ready (including default model bundled and interrupted-load handling) — user story implementation can now begin

---

## Phase 3: User Story 1 - Transcribe using in-browser ASR (Priority: P1) 🎯 MVP

**Goal**: User selects in-browser backend, records or uploads audio, and receives transcription in vault/editor without calling an external API.

**Independent Test**: Select in-browser backend in settings, record or upload a short audio file, and verify the resulting text appears in a new note or at the cursor as configured.

### Implementation for User Story 1

- [ ] T011 [US1] In AudioHandler branch on settings.transcriptionBackend: call local ASR when "local", API when "api"; use response.text for existing vault/editor path in src/AudioHandler.ts
- [ ] T012 [US1] When local backend is selected, show "Whisper(Local) Idle / Recording / Processing" in src/StatusBar.ts
- [ ] T013 [US1] Before running local transcription, detect environment capability (Worker, WASM/ONNX); if unsupported show Obsidian Notice with short message, offer "Use cloud instead?", log technical detail to console in src/localAsr/index.ts or src/AudioHandler.ts

**Checkpoint**: User Story 1 is fully functional (T011–T013); user can transcribe locally and see status; capability failure shows Notice and cloud option.

---

## Phase 4: User Story 2 - Switch between API and in-browser backend (Priority: P2)

**Goal**: User can choose backend in settings; only relevant options are shown; switching backend does not change record/upload workflow.

**Independent Test**: Toggle backend in settings, then record or upload and confirm the correct backend is used and the right options are visible (no API key when local; local model and max duration when local).

### Implementation for User Story 2

- [ ] T014 [US2] Ensure settings form shows only options for selected backend and display selected local model id and max recommended duration from registry when local backend is selected in src/WhisperSettingsTab.ts
- [ ] T015 [US2] When capability check fails, ensure "Use cloud instead?" is offered for this transcription and technical detail is logged to console only (no API keys or stack traces in Notice) in src/AudioHandler.ts or src/localAsr/index.ts

**Checkpoint**: User can switch backends and see correct options; capability failure path offers cloud and logs to console.

---

## Phase 5: User Story 3 - First-time and repeat use of in-browser model (Priority: P3)

**Goal**: First run shows model preparation progress; subsequent runs reuse cached model for faster startup.

**Independent Test**: Use in-browser backend once (observe first-time preparation), then transcribe again and confirm faster or more direct startup when model data is already available.

### Implementation for User Story 3

- [ ] T016 [US3] On first-time local model use, show model preparation progress (status bar or Notice) in src/localAsr/index.ts and/or src/StatusBar.ts
- [ ] T017 [US3] Ensure subsequent transcription runs reuse cached model (no full preparation step) in src/localAsr/index.ts

**Checkpoint**: First-run and repeat-run behaviour matches spec; users see progress on first use and faster startup on reuse.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation and cleanup

- [ ] T018 [P] Run quickstart.md validation (manual verification in Obsidian per constitution) per specs/001-transformers-js-asr-dropin/quickstart.md
- [ ] T019 Code cleanup and any cross-cutting documentation updates in specs/001-transformers-js-asr-dropin/ or project README as needed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–5)**: All depend on Foundational completion
  - US1 (P1) can start after Phase 2 — no dependency on US2/US3
  - US2 (P2) can start after Phase 2 — may rely on US1 capability-check path
  - US3 (P3) can start after Phase 2 — extends local ASR first-run behaviour
- **Polish (Phase 6)**: Depends on desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational — core local transcription and status bar
- **User Story 2 (P2)**: After Foundational — settings UI completeness and capability fallback UX
- **User Story 3 (P3)**: After Foundational — model load progress and cache reuse

### Within Each User Story

- Implementation tasks in order listed; T011 before T012/T013 for US1; T014/T015 can be parallel in US2; T016 before T017 in US3.

### Parallel Opportunities

- Phase 1: T002 [P] can run after T001 (or with T001 if directory is created first)
- Phase 2: T006 [P] and T007 [P] can run in parallel; T008 depends on T007; T009 depends on T006 and T008 (bundle + wire); T010 depends on T008/T009 (interrupted load handling)
- Phase 4: T014 and T015 can run in parallel (different concerns: settings UI vs capability fallback)
- Phase 6: T018 [P] is independent

---

## Parallel Example: User Story 1

```text
# Sequential: T011 (AudioHandler branch) then T012 (StatusBar) then T013 (capability check)
# T012 and T013 can be done in parallel after T011 if desired (different files)
```

---

## Parallel Example: Phase 2

```text
# After T003–T005: T006 (modelRegistry.ts) and T007 (worker.ts) in parallel
# Then T008 (index.ts), then T009 (bundle default model + wire), then T010 (interrupted load handling)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Manual test in Obsidian — select local backend, record/upload, verify text in note and status bar
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → local ASR and settings ready
2. Add User Story 1 → Test locally → MVP
3. Add User Story 2 → Test backend switch and options
4. Add User Story 3 → Test first-run and repeat-run
5. Polish (Phase 6) → quickstart validation and cleanup

### Parallel Team Strategy

- After Phase 2: One developer can own US1 (AudioHandler + StatusBar + capability), another can refine US2 (settings UI) and US3 (model progress/cache) in parallel where files do not conflict.

---

## Notes

- [P] tasks = different files, no dependencies on other tasks in same phase
- [Story] label maps task to user story for traceability
- Each user story is independently testable via manual verification in Obsidian
- Commit after each task or logical group
- Notice: short, safe text only; technical detail in console only (constitution)
