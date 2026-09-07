

## 1.12.0 (2026-09-07)


### Features

* accept video files for upload/transcription ([#63](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/63)) ([8d8b1f9](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/8d8b1f9f10577a65fca2476c53adbd71a73c6272))
* add audio device selection to settings ([5492d49](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/5492d4901fe32effb4c7fa7f9712de3f11a5548f))
* add cancel recording button ([#46](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/46)) ([c3f0c46](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/c3f0c46794f77e87a9a194cdd8fddff8977be1f2))
* add command palette icons for mic commands ([983c0b9](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/983c0b9ebcad96df841c73c1657cbd8614e25b21))
* add debug mode ([2d356a1](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/2d356a12ddc2fd24d99c02a73641573c32022b93))
* add Gemini API as an alternate transcription provider ([f3b8eb5](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/f3b8eb506cdcf0c3720e0c050e307f169044c460))
* add gemini-live as a transcription provider with live model setting ([663f6ea](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/663f6eafcaa06fe5b7984388c73c9ce755a2d094))
* add GeminiLiveTranscriber with WebSocket-based streaming transcription via Live API ([9f97239](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/9f9723981fa60dc3c684324f67937acbe2b80839))
* add GeminiTranscriber with generateContent API for gemini-3.5-transcribe ([df98b51](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/df98b519b7e377d1c2591e5a2f164d647ee425ec))
* add new alert ([6439e7b](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/6439e7b6e33882e9e2ee87fd85dcfe528bb4afaa))
* add note filename and content templates ([#109](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/109)) ([29fdcd3](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/29fdcd3d9d9ffa555e63c27acd67bd3a803a2a86)), closes [#66](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/66)
* add preserve audio file ([f8517e4](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/f8517e44219dc8b1b1d2875ec4b0230fe835d95b))
* add save audio file setting ([d21e4b3](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/d21e4b3a2556a25142b5c748b3734cf519abb689))
* add StreamingEditor for interim/final text reconciliation ([20d10c4](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/20d10c49f0a4513a148d52f09bd7218a78f2307d))
* add StreamingRecorder for raw PCM audio capture via AudioContext ([437fa15](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/437fa154f5083898b7e99f05d98c12cc99a2ace0))
* add support of prompt parameter ([786644e](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/786644ed939ccc8e4a2b2bcc9beffb21173c38ed))
* add test infrastructure and feature plan ([1b12bda](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/1b12bda5b00789d376c3cd93b668ba30fae047d5))
* add transcribe action to file menu ([816606f](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/816606fad873a97562d5e3e00cfb9b2727594f9b))
* add upload audio file feature ([c340b22](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/c340b22ff3d1abb9e853b0b2a59ed53025edfc2b))
* always paste at cursor, default to dictation mode ([#111](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/111)) ([6353599](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/635359976d0cc459b45d24f42e7e1534db16da50)), closes [#34](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/34)
* auto-detect language when left empty ([#47](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/47)) ([3b82849](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/3b828498d8d584c60f4d755b49c6fa47f243037b))
* expose pause/resume and open controls as commands ([#77](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/77), [#29](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/29)) ([8e0cc4e](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/8e0cc4e6fbe65839a270e6d74f5249fa7d5ba852))
* expose temperature and response_format settings ([#35](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/35)) ([fcd97e8](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/fcd97e88a82f0b500f789f04c63501ddf85770b8))
* extract OpenAiTranscriber from AudioHandler into dedicated module ([eca4cfa](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/eca4cfafa1ee69d1d6b5551c039c00d1c4ed48ba))
* **gemini:** expose transcription API config under Advanced ([b645045](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/b645045cb78fc660b90c91579023b5a38db85eb0))
* independent paste-at-cursor and save-to-file toggles ([#64](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/64)) ([6147aeb](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/6147aeb936e0d9ceba8676857ed986500189e9a4))
* **live:** add client-side voice buffer system and pause delay setting ([2c6206b](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/2c6206b6987dfb23a8d66425e493393510502324))
* **live:** add pause tolerance setting to avoid premature turn splits ([6e4b5f9](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/6e4b5f923e45fea7bfcf2ccb4a3a0eace40c430c))
* **live:** highlight interim streamed text in editor ([c2787af](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/c2787afa30375ca929556c6a14ac534d491cfde3))
* LLM post-processing for transcriptions ([#108](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/108)) ([b5c9456](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/b5c94563b03682d0aacfb9d0f60685843b6a9062)), closes [#72](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/72)
* option to ignore original filename on upload ([#68](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/68)) ([bb02e25](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/bb02e250842a88e24560acc66a83bb74f9eb1f0b))
* persist microphone choice per hostname ([e6d4703](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/e6d4703da957bc79d46b048ec4da3604ba5bc2fe))
* post-processing API URL, updated models and defaults ([#112](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/112)) ([2e9a70d](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/2e9a70dfc72f30e5c1d0cfc27ebbfdcacdd96d6d)), closes [#70](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/70)
* post-processing provider dropdown with custom endpoint support ([#116](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/116)) ([43f05f9](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/43f05f93add65c38952ddef3515f49de4f5277bc))
* refactor settings tab ([f25b880](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/f25b88052c3f633249d688954e5a1d6028fcd4dc))
* refactor status bar ([9f6bfa2](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/9f6bfa214611a771fc30bd14c504064dc90cdb01))
* send surrounding text as Whisper prompt context ([#71](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/71)) ([f9e27b2](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/f9e27b2fde6156b2c76450456bf83a6201b39641))
* set outputdir to env variable ([077c5ee](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/077c5eedda82d71c9a0c2f6d81ab8d5371f4b4b7))
* **settings:** add per-provider enable toggles ([2477fc0](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/2477fc0012b133a361175bf844d3976ae362bb4e))
* show and cycle the microphone on the status bar ([9987dca](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/9987dcadf492544a0f04b277fa863269b874aa06))
* show hostname and resolved mic in settings ([28f21ab](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/28f21ab39a3b0d09bf9aae9f178de8fcc05de554))
* show live char count in status bar during streaming ([1d37421](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/1d37421c64ef8a42e23f9bc349bfed7f6113f83f))
* show notice when recording starts ([#41](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/41)) ([71f5a29](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/71f5a297d5e22c7dbaf89bd403fa3bf6e93b1659))
* split codebase into smaller components ([e7b3498](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/e7b3498481e2dddd811e46f0fe0bd939e01978f1))
* **status-bar:** cycle provider on click and show mic menu on hover ([70a6dfd](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/70a6dfdcf98de482d0c9fa0c142c959c54ae96f1))
* **status-bar:** soft red pulse while recording ([93798a2](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/93798a2cb06dcd9a61bef17ab2f3e8bb35d1d9d9))
* store API keys in Obsidian SecretStorage instead of data.json ([#83](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/83)) ([f7c7e18](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/f7c7e1894a46a4a73b3701d90573c091353a4e74))
* **streaming:** disable server VAD and stream continuous audio with manual activity signaling ([201696d](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/201696db6ba1d7fee7d70a93fb9c5db2b64c5ac7))
* support custom API endpoints without API key ([#2](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/2), [#61](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/61), [#74](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/74)) ([7850f12](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/7850f123953395d8ba576db57327eae30661e36c))
* toggle between embed and link for audio file reference ([#26](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/26)) ([257c10a](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/257c10a892e23d9009bdeca4f0ad17c254a0933c))
* **transcribers:** add self-describing module descriptors and registry ([c502b78](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/c502b78b9b1d538cd10ba6672aa2cf890665ba3a))
* URI handler for recording automation ([#110](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/110)) ([f28cd59](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/f28cd599383656f1d1fe2cd71a3cc7a69de80584)), closes [#27](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/27)


### Bug Fixes

* add misc updates ([f3d4906](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/f3d490670a468e39a1872cdc2a3cff01cf0fcd27))
* add prompt type and desc ([d25ea92](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/d25ea9234df339c3b0ee8bf1b15984751576d62e))
* auto-create folders when they don't exist ([#40](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/40)) ([91ccc2a](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/91ccc2a3aad0cba69cb22f821a0cf33bded7ec7e))
* bugs found during codebase audit ([efec1af](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/efec1af15c68b445c2457026c15d6ff84e7f47de))
* **build:** default OUTPUT_PATH to current directory when undefined ([167bfb3](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/167bfb30d1416067db08409d8d7eebb1ceabda6f))
* Controls reads state from StatusBar, not recorder ([9796487](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/97964879478a993bddd10595a8c575a2e130a127))
* don't link to nonexistent audio file when save is off ([#52](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/52)) ([2a38144](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/2a381448ab8e152d11c480177232c1f1f6e7631d))
* fix MIME type for mobile devices ([1db4866](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/1db486613ced5b12022f303d926dd91fdda74ad2))
* fix typo ([fcce20d](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/fcce20de8123d34405cfd6bd62578ae05d53a5f0))
* **gemini:** migrate batch model off removed -preview id ([b9894b1](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/b9894b1bc4615c34ef1afdfc891b05b5193869d6))
* improve mobile audio compatibility ([#76](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/76), [#73](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/73), [#60](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/60)) ([ef6a016](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/ef6a0166a8c933fcf0c99644e1459e3ff1febc43))
* improve notification copy ([a1d8aca](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/a1d8aca02be9ffaf2f0834dde58156c5074a8316))
* **live:** insert space between streamed transcription segments ([45fe38c](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/45fe38c7dac1e9a60bd0939d5bd5b14635166b69))
* **live:** keep server VAD enabled and recover dropped audio so speech after a pause is not lost ([a5e3d2b](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/a5e3d2bb408108f3fe12adad5aeb999feb05f8b7))
* **live:** remove Gemini Live system instruction setting ([f6e9b29](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/f6e9b292f4482c5b90f111e5c63b4b1a17a78838))
* mask API key fields in settings as password inputs ([0c49667](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/0c496674045cbae37c125c475e59453220c52d85))
* organize settings into sections, remove redundant title ([24e5396](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/24e539656b99bc77e5211cf6c4f385099621dbe7))
* parse Interactions API response from steps[0].content[0].text ([248c8a8](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/248c8a89fc24e31b0818c07d20b3713759bc6f4d))
* paste transcription at cursor when saving note file ([#115](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/115)) ([a518202](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/a518202c65b66aee1d9b34f166f7c01442b08f04))
* prefix error notices with ✘ to distinguish from status messages ([1867e97](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/1867e97792e6ef69875b3d4abe52d32cabde4eb3))
* re-register status listener on modal open, not just constructor ([988ed83](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/988ed83cd9380277e0d3d8d4ffba06be90ebfc5e))
* recording controls UX — show/hide buttons, paused state ([0fbd64c](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/0fbd64c368a3cd13e7319179aee108ffc1589963))
* release mic after use ([651ed76](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/651ed76a5a57e23419931b9314478093ed597410))
* replace path module with js function ([bad6dc0](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/bad6dc0db11faca49dedbcda9817fd374f8cbfd8))
* reset status on recording failure, handle extensionless filenames ([c1a2412](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/c1a24129ecd0b4752f5332fffece4b1b13469b7b))
* resolve desktop hostname via os.hostname ([8ddb045](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/8ddb045996ae033dc58c8a4b695e739a30a0b390))
* **security:** add strict null guarding for secretStorage readers ([44dfefc](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/44dfefc8ef7a5fc806c27e5a46786ded6ff9ab08))
* settings UX cleanup and better defaults ([a2ab889](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/a2ab889419275c33490ee447c5da54c3af0893a5))
* **settings:** debounce textarea saves to avoid UI jank ([52faec8](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/52faec801837f9508e23d285259bc8cc84d5568b))
* **settings:** defer migration persistence until onLayoutReady ([b8a09fd](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/b8a09fdf0a522248ff9393a0d2e909b6c5e081cd))
* skip transcription for silent/too-short recordings ([#65](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/65), [#56](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/56)) ([7a5092d](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/7a5092da56163fa35fb2b944f5b1976cf7f92662))
* **smoke:** report success when finals arrive without turnComplete ([2ad112a](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/2ad112a036b6df55599769eb11c529c01e66cd94))
* **status-bar:** remove unused live char count ([9fd4d41](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/9fd4d41ee2b8920f7d6441b567750097693b4a30))
* stream Gemini Live audio on one Google API key ([29f3dbc](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/29f3dbc8e83dad6001cb5afa1a8f3d7379da7831))
* **streaming:** atomic span replacement and multi-pass committed segment history ([40a7519](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/40a7519784d43b53a8f0814d28d340a7872d3007))
* **streaming:** isolate multi-pass voice segments and handle cumulative transcripts ([9e82947](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/9e82947d2fed42eee8beaab475b7a2d8a2aa7ddf))
* sync Controls UI with commands and URI handler ([#113](https://github.com/adrianghnguyen/whisper-obsidian-plugin/issues/113)) ([3c1bb33](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/3c1bb3320d46965b4631b55c85d171802c48d916))
* sync phone mic under mobile map with soft deviceId ([c03ba38](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/c03ba385f4291da66acd79ebeb678968351d10f7))
* update AudioHandler to try...catch 'save_audio' and 'parse_audio' ([89fc56e](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/89fc56e8bcda9ffdfaf255cc3877e82ecc4c297a))
* update manifest ([0d7c236](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/0d7c236942713e5fddf7eb45e9d439e431765f0f))
* update mimeType list and use 'audio/webm' by default if possible ([8e8747c](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/8e8747c3221da8868b7af79b16ba4aef67cc15b2))
* update settings desc ([7b65bfc](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/7b65bfcdf5a09b0798b704b3cc98c5f9bc8fa664))
* use Interactions API for gemini-3.5-transcribe instead of generateContent ([1fc7e21](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/1fc7e2138b57c9a1d6bb5afdbb09d52ef1979679))
* use interimInputTranscription field name and lock interim text on stream end ([786ae81](https://github.com/adrianghnguyen/whisper-obsidian-plugin/commit/786ae81a4e616c9ed388ba5d9d2bfc526b1b89c8))

## [Unreleased]

## [1.11.0](https://github.com/adrianghnguyen/whisper-obsidian-plugin/compare/1.10.0...1.11.0) (2026-09-04)

### Features

* **Pause tolerance for Gemini Live.** A new Advanced setting controls how long the Live API waits through silence before committing your words to the note. Higher settings keep stuttering or thinking pauses from splitting sentences mid-thought (maps to `END_SENSITIVITY_LOW` plus a longer silence window); Medium (1.5 s) is the new default.
* **Space between streamed segments.** Consecutive Gemini Live transcription segments no longer run together (e.g. `Hello worldHow are you`); a separating space is inserted between segments when needed.

### Bug Fixes

* **Gemini batch transcription model 404.** The default (and saved) Interactions API model was still `gemini-3.5-transcribe-preview`, which Google removed; settings now use `gemini-3.5-transcribe` and migrate the old id on load.
* **Speech after a mid-sentence pause is no longer lost.** The Live session now keeps the API's automatic voice activity detection enabled with a long silence window, so a stutter or thinking pause between voice chunks no longer drops the rest of the utterance; what you say after the pause continues the same sentence instead of vanishing.
* **Live audio recovers from connection drops.** If the WebSocket hiccups or a chunk fails to send mid-recording, the plugin reconnects automatically while the microphone keeps running, buffers the interrupted audio (up to ~24 s), replays it once the connection returns, and continues the sentence in the note instead of silently ending the stream.

## [1.10.0](https://github.com/adrianghnguyen/whisper-obsidian-plugin/compare/1.9.4...1.10.0) (2026-08-31)

### Features

* **Highlight interim Gemini Live text in the note.** As you speak, the streamed (not-yet-final) text is shown in a distinct style and settles into normal text once finalized, so you can see the stream in real time.
* **Configurable Gemini transcription model and prompt.** Advanced settings now expose the Gemini Live transcription API model and prompt overrides, so you can steer transcription behavior without code changes.

### Bug Fixes

* **Remove the unused live character count from the status bar.** The recording label no longer shows a character total that stayed at 0; it now shows just the state and microphone name.

## [1.9.4](https://github.com/adrianghnguyen/whisper-obsidian-plugin/compare/1.9.3...1.9.4) (2026-08-30)

### Bug Fixes

* **Gemini Live now transcribes the microphone.** Starting a live session could connect without sending usable audio, so the editor stayed empty. Whisper waits until the session is ready, streams the selected mic as 16 kHz PCM on the current Live audio channel, and writes interim and final text into the note.
* **Gemini API and Gemini Live share one Google AI Studio key.** REST and the Live WebSocket use the same key; settings no longer imply a second Google credential.
* defer settings disk writes during load so vault startup cannot deadlock

## [1.9.3](https://github.com/adrianghnguyen/whisper-obsidian-plugin/compare/1.9.1...1.9.3) (2026-08-15)

### Features

* per-host microphone map in synced data.json
* status bar shows and cycles the current microphone
* explicit Clear for API keys in secret storage

### Bug Fixes

* skip empty SecretStorage writes so settings rebuilds do not wipe keys

## [1.9.1](https://github.com/nikdanilov/whisper-obsidian-plugin/compare/1.9.0...1.9.1) (2026-04-07)


### Bug Fixes

* settings UX cleanup and better defaults ([a2ab889](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/a2ab889419275c33490ee447c5da54c3af0893a5))

## [1.9.0](https://github.com/nikdanilov/whisper-obsidian-plugin/compare/1.8.7...1.9.0) (2026-04-07)


### Features

* post-processing provider dropdown with custom endpoint support ([#116](https://github.com/nikdanilov/whisper-obsidian-plugin/issues/116)) ([43f05f9](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/43f05f93add65c38952ddef3515f49de4f5277bc))

## [1.8.7](https://github.com/nikdanilov/whisper-obsidian-plugin/compare/1.8.6...1.8.7) (2026-04-06)


### Bug Fixes

* reset status on recording failure, handle extensionless filenames ([c1a2412](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/c1a24129ecd0b4752f5332fffece4b1b13469b7b))

## [1.8.6](https://github.com/nikdanilov/whisper-obsidian-plugin/compare/1.8.5...1.8.6) (2026-04-06)


### Bug Fixes

* paste transcription at cursor when saving note file ([#115](https://github.com/nikdanilov/whisper-obsidian-plugin/issues/115)) ([a518202](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/a518202c65b66aee1d9b34f166f7c01442b08f04))

## [1.8.5](https://github.com/nikdanilov/whisper-obsidian-plugin/compare/1.8.4...1.8.5) (2026-04-06)


### Bug Fixes

* mask API key fields in settings as password inputs ([0c49667](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/0c496674045cbae37c125c475e59453220c52d85))

## [1.8.4](https://github.com/nikdanilov/whisper-obsidian-plugin/compare/1.8.3...1.8.4) (2026-04-06)

## [1.8.3](https://github.com/nikdanilov/whisper-obsidian-plugin/compare/1.8.2...1.8.3) (2026-04-06)


### Features

* store API keys in Obsidian SecretStorage instead of data.json ([#83](https://github.com/nikdanilov/whisper-obsidian-plugin/issues/83)) ([f7c7e18](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/f7c7e1894a46a4a73b3701d90573c091353a4e74))

## [1.6.1](https://github.com/nikdanilov/whisper-obsidian-plugin/compare/1.6.0...1.6.1) (2026-04-05)


### Bug Fixes

* recording controls UX — show/hide buttons, paused state ([0fbd64c](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/0fbd64c368a3cd13e7319179aee108ffc1589963))

## [1.6.0](https://github.com/nikdanilov/whisper-obsidian-plugin/compare/1.5.5...1.6.0) (2026-04-05)


### Features

* accept video files for upload/transcription ([#63](https://github.com/nikdanilov/whisper-obsidian-plugin/issues/63)) ([8d8b1f9](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/8d8b1f9f10577a65fca2476c53adbd71a73c6272))
* add audio device selection to settings ([5492d49](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/5492d4901fe32effb4c7fa7f9712de3f11a5548f))
* add cancel recording button ([#46](https://github.com/nikdanilov/whisper-obsidian-plugin/issues/46)) ([c3f0c46](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/c3f0c46794f77e87a9a194cdd8fddff8977be1f2))
* add test infrastructure and feature plan ([1b12bda](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/1b12bda5b00789d376c3cd93b668ba30fae047d5))
* add transcribe action to file menu ([816606f](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/816606fad873a97562d5e3e00cfb9b2727594f9b))
* auto-detect language when left empty ([#47](https://github.com/nikdanilov/whisper-obsidian-plugin/issues/47)) ([3b82849](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/3b828498d8d584c60f4d755b49c6fa47f243037b))
* expose pause/resume and open controls as commands ([#77](https://github.com/nikdanilov/whisper-obsidian-plugin/issues/77), [#29](https://github.com/nikdanilov/whisper-obsidian-plugin/issues/29)) ([8e0cc4e](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/8e0cc4e6fbe65839a270e6d74f5249fa7d5ba852))
* expose temperature and response_format settings ([#35](https://github.com/nikdanilov/whisper-obsidian-plugin/issues/35)) ([fcd97e8](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/fcd97e88a82f0b500f789f04c63501ddf85770b8))
* independent paste-at-cursor and save-to-file toggles ([#64](https://github.com/nikdanilov/whisper-obsidian-plugin/issues/64)) ([6147aeb](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/6147aeb936e0d9ceba8676857ed986500189e9a4))
* option to ignore original filename on upload ([#68](https://github.com/nikdanilov/whisper-obsidian-plugin/issues/68)) ([bb02e25](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/bb02e250842a88e24560acc66a83bb74f9eb1f0b))
* send surrounding text as Whisper prompt context ([#71](https://github.com/nikdanilov/whisper-obsidian-plugin/issues/71)) ([f9e27b2](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/f9e27b2fde6156b2c76450456bf83a6201b39641))
* show notice when recording starts ([#41](https://github.com/nikdanilov/whisper-obsidian-plugin/issues/41)) ([71f5a29](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/71f5a297d5e22c7dbaf89bd403fa3bf6e93b1659))
* support custom API endpoints without API key ([#2](https://github.com/nikdanilov/whisper-obsidian-plugin/issues/2), [#61](https://github.com/nikdanilov/whisper-obsidian-plugin/issues/61), [#74](https://github.com/nikdanilov/whisper-obsidian-plugin/issues/74)) ([7850f12](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/7850f123953395d8ba576db57327eae30661e36c))
* toggle between embed and link for audio file reference ([#26](https://github.com/nikdanilov/whisper-obsidian-plugin/issues/26)) ([257c10a](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/257c10a892e23d9009bdeca4f0ad17c254a0933c))


### Bug Fixes

* auto-create folders when they don't exist ([#40](https://github.com/nikdanilov/whisper-obsidian-plugin/issues/40)) ([91ccc2a](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/91ccc2a3aad0cba69cb22f821a0cf33bded7ec7e))
* bugs found during codebase audit ([efec1af](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/efec1af15c68b445c2457026c15d6ff84e7f47de))
* **build:** default OUTPUT_PATH to current directory when undefined ([167bfb3](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/167bfb30d1416067db08409d8d7eebb1ceabda6f))
* don't link to nonexistent audio file when save is off ([#52](https://github.com/nikdanilov/whisper-obsidian-plugin/issues/52)) ([2a38144](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/2a381448ab8e152d11c480177232c1f1f6e7631d))
* improve mobile audio compatibility ([#76](https://github.com/nikdanilov/whisper-obsidian-plugin/issues/76), [#73](https://github.com/nikdanilov/whisper-obsidian-plugin/issues/73), [#60](https://github.com/nikdanilov/whisper-obsidian-plugin/issues/60)) ([ef6a016](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/ef6a0166a8c933fcf0c99644e1459e3ff1febc43))
* improve notification copy ([a1d8aca](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/a1d8aca02be9ffaf2f0834dde58156c5074a8316))
* organize settings into sections, remove redundant title ([24e5396](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/24e539656b99bc77e5211cf6c4f385099621dbe7))
* skip transcription for silent/too-short recordings ([#65](https://github.com/nikdanilov/whisper-obsidian-plugin/issues/65), [#56](https://github.com/nikdanilov/whisper-obsidian-plugin/issues/56)) ([7a5092d](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/7a5092da56163fa35fb2b944f5b1976cf7f92662))

## [1.5.5](https://github.com/nikdanilov/whisper-obsidian-plugin/compare/1.5.4...1.5.5) (2024-01-29)


### Features

* add debug mode ([2d356a1](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/2d356a12ddc2fd24d99c02a73641573c32022b93))

## [1.5.4](https://github.com/nikdanilov/whisper-obsidian-plugin/compare/1.5.3...1.5.4) (2024-01-29)


### Bug Fixes

* update mimeType list and use 'audio/webm' by default if possible ([8e8747c](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/8e8747c3221da8868b7af79b16ba4aef67cc15b2))

## [1.5.3](https://github.com/nikdanilov/whisper-obsidian-plugin/compare/1.5.2...1.5.3) (2024-01-29)


### Features

* add support of prompt parameter ([786644e](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/786644ed939ccc8e4a2b2bcc9beffb21173c38ed))


### Bug Fixes

* add prompt type and desc ([d25ea92](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/d25ea9234df339c3b0ee8bf1b15984751576d62e))

## [1.5.2](https://github.com/nikdanilov/whisper-obsidian-plugin/compare/1.5.1...1.5.2) (2024-01-29)


### Bug Fixes

* update AudioHandler to try...catch 'save_audio' and 'parse_audio' ([89fc56e](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/89fc56e8bcda9ffdfaf255cc3877e82ecc4c297a))

## [1.5.1](https://github.com/nikdanilov/whisper-obsidian-plugin/compare/1.5.0...1.5.1) (2023-06-19)


### Features

* set outputdir to env variable ([077c5ee](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/077c5eedda82d71c9a0c2f6d81ab8d5371f4b4b7))


### Bug Fixes

* add misc updates ([f3d4906](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/f3d490670a468e39a1872cdc2a3cff01cf0fcd27))
* replace path module with js function ([bad6dc0](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/bad6dc0db11faca49dedbcda9817fd374f8cbfd8))
* update manifest ([0d7c236](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/0d7c236942713e5fddf7eb45e9d439e431765f0f))

## [1.5.0](https://github.com/nikdanilov/whisper-obsidian-plugin/compare/1.4.2...1.5.0) (2023-06-18)


### Features

* add preserve audio file ([f8517e4](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/f8517e44219dc8b1b1d2875ec4b0230fe835d95b))
* add save audio file setting ([d21e4b3](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/d21e4b3a2556a25142b5c748b3734cf519abb689))
* add upload audio file feature ([c340b22](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/c340b22ff3d1abb9e853b0b2a59ed53025edfc2b))


### Bug Fixes

* fix typo ([fcce20d](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/fcce20de8123d34405cfd6bd62578ae05d53a5f0))
* update settings desc ([7b65bfc](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/7b65bfcdf5a09b0798b704b3cc98c5f9bc8fa664))

## [1.4.2](https://github.com/nikdanilov/whisper-obsidian-plugin/compare/1.4.1...1.4.2) (2023-06-12)

## [1.4.1](https://github.com/nikdanilov/whisper-obsidian-plugin/compare/1.4.0...1.4.1) (2023-06-12)


### Bug Fixes

* release mic after use ([651ed76](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/651ed76a5a57e23419931b9314478093ed597410))

## [1.4.0](https://github.com/nikdanilov/whisper-obsidian-plugin/compare/1.3.0...1.4.0) (2023-06-12)


### Features

* add new alert ([6439e7b](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/6439e7b6e33882e9e2ee87fd85dcfe528bb4afaa))

## [1.3.0](https://github.com/nikdanilov/whisper-obsidian-plugin/compare/1.2.0...1.3.0) (2023-05-01)

### Features

-   refactor settings tab ([f25b880](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/f25b88052c3f633249d688954e5a1d6028fcd4dc))
-   refactor status bar ([9f6bfa2](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/9f6bfa214611a771fc30bd14c504064dc90cdb01))

## 1.2.0 (2023-04-29)

### Features

-   split codebase into smaller components ([e7b3498](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/e7b3498481e2dddd811e46f0fe0bd939e01978f1))

### Bug Fixes

-   fix MIME type for mobile devices ([1db4866](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/1db486613ced5b12022f303d926dd91fdda74ad2))

## 1.1.0 (2023-04-29)

### Features

-   split codebase into smaller components ([e7b3498](https://github.com/nikdanilov/whisper-obsidian-plugin/commit/e7b3498481e2dddd811e46f0fe0bd939e01978f1))