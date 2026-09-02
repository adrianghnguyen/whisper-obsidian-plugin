/**
 * Smoke test for Gemini Live API using a webm (or other ffmpeg-readable) file.
 *
 * Decodes the file, converts to 16kHz PCM, and sends it in chunks
 * over the WebSocket Live API, simulating real-time streaming.
 *
 * Node 22+ required (global WebSocket). Usage:
 *   GEMINI_API_KEY=... node scripts/smoke-test-live.mjs <path-to-audio>
 */
import { spawn } from "child_process";

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "models/gemini-3.5-transcribe-live";
const WS_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

/**
 * Convert audio to 16kHz mono 16-bit PCM using ffmpeg.
 * Returns a Buffer of raw PCM data.
 */
function convertToPcm(inputPath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-y",
      "-i", inputPath,
      "-f", "s16le",
      "-acodec", "pcm_s16le",
      "-ar", "16000",
      "-ac", "1",
      "pipe:1",
    ]);

    const chunks = [];
    ffmpeg.stdout.on("data", (chunk) => chunks.push(chunk));
    ffmpeg.stderr.on("data", () => {}); // ffmpeg logs to stderr
    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
    ffmpeg.on("error", reject);
  });
}

async function decodeWsData(raw) {
  if (typeof raw === "string") return raw;
  if (typeof Blob !== "undefined" && raw instanceof Blob) return raw.text();
  if (Buffer.isBuffer(raw)) return raw.toString("utf8");
  if (raw instanceof ArrayBuffer) return Buffer.from(raw).toString("utf8");
  return String(raw);
}

async function main() {
  if (!API_KEY) {
    console.error("Set GEMINI_API_KEY in the environment.");
    process.exit(1);
  }

  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: GEMINI_API_KEY=... node scripts/smoke-test-live.mjs <path-to-audio>");
    process.exit(1);
  }

  console.log(`Converting ${filePath} to 16kHz PCM...`);
  const pcmBuffer = await convertToPcm(filePath);
  console.log(`PCM size: ${pcmBuffer.length} bytes (${(pcmBuffer.length / 32000).toFixed(1)}s at 16kHz)`);

  const CHUNK_SIZE = 3200; // 100ms
  const chunks = [];
  for (let i = 0; i < pcmBuffer.length; i += CHUNK_SIZE) {
    chunks.push(pcmBuffer.subarray(i, i + CHUNK_SIZE));
  }
  console.log(`Split into ${chunks.length} chunks of ${CHUNK_SIZE} bytes each`);

  const wsUrl = `${WS_URL}?key=${encodeURIComponent(API_KEY)}`;
  console.log("Connecting to Live API...");

  const ws = new WebSocket(wsUrl);
  let setupDone = false;
  let finalsReceived = 0;
  let allChunksSent = false;

  const finish = (code) => {
    console.log(
      `\nSession summary: setup=${setupDone}, finals=${finalsReceived}.`
    );
    console.log(
      code === 0
        ? "SMOKE TEST PASSED"
        : "SMOKE TEST FAILED (no finals received)"
    );
    ws.close();
    process.exit(code);
  };

  const sendChunks = () => {
    console.log("Streaming audio chunks...");
    let chunkIndex = 0;
    const interval = setInterval(() => {
      if (chunkIndex >= chunks.length) {
        clearInterval(interval);
        allChunksSent = true;
        ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
        console.log("All chunks sent. Waiting for transcription...");
        return;
      }

      const chunk = chunks[chunkIndex++];
      ws.send(
        JSON.stringify({
          realtimeInput: {
            audio: {
              mimeType: "audio/pcm;rate=16000",
              data: chunk.toString("base64"),
            },
          },
        })
      );
    }, 100);
  };

  ws.addEventListener("open", () => {
    console.log("WebSocket connected. Sending setup...");
    const setup = {
      model: MODEL,
      generationConfig: {
        responseModalities: ["TEXT"],
      },
      inputAudioTranscription: {
        mode: "smart",
      },
    };
    const silenceMs = Number(process.env.GEMINI_LIVE_SILENCE_MS);
    if (Number.isFinite(silenceMs) && silenceMs > 0) {
      setup.realtimeInputConfig = {
        automaticActivityDetection: {
          disabled: false,
          endOfSpeechSensitivity:
            process.env.GEMINI_LIVE_END_SENSITIVITY || "END_SENSITIVITY_LOW",
          startOfSpeechSensitivity:
            process.env.GEMINI_LIVE_START_SENSITIVITY ||
            "START_SENSITIVITY_HIGH",
          silenceDurationMs: silenceMs,
          prefixPaddingMs: Number(process.env.GEMINI_LIVE_PREFIX_PADDING_MS) || 300,
        },
      };
    }
    if (process.env.GEMINI_LIVE_SYSTEM_PROMPT) {
      setup.systemInstruction = {
        parts: [{ text: process.env.GEMINI_LIVE_SYSTEM_PROMPT }],
      };
    }
    ws.send(
      JSON.stringify({
        setup,
      })
    );
  });

  ws.addEventListener("message", async (event) => {
    const text = await decodeWsData(event.data);
    const msg = JSON.parse(text);

    if (process.env.DEBUG_WS) {
      console.log("RAW MSG:", text.substring(0, 500));
    }

    if (msg.error) {
      console.error("Live API error:", msg.error);
      ws.close();
      return;
    }

    if (msg.setupComplete && !setupDone) {
      setupDone = true;
      console.log("Setup complete.");
      sendChunks();
    }

    const sc = msg.serverContent;
    const interim =
      sc?.interimInputTranscription?.text ?? msg.interimInputTranscription?.text;
    const final = sc?.inputTranscription?.text ?? msg.inputTranscription?.text;
    if (interim) console.log(`[INTERIM] ${interim}`);
    if (final) {
      finalsReceived += 1;
      console.log(`[FINAL]   ${final}`);
    }
    // turnComplete is a conversational-model signal (the model finished
    // generating a response turn). The transcribe models never emit it —
    // success here means: setup complete, all chunks sent, and at least one
    // final transcription received.
    if (sc?.turnComplete) {
      console.log("\nTurn complete.");
      finish(0);
    }
    if (allChunksSent && finalsReceived > 0) {
      // Give trailing finals a moment to arrive, then report success.
      setTimeout(() => finish(0), 2000);
    }
  });

  ws.addEventListener("error", (err) => {
    console.error("WebSocket error:", err.message || err);
  });

  ws.addEventListener("close", () => {
    console.log("WebSocket closed.");
    process.exit(setupDone && finalsReceived > 0 ? 0 : 1);
  });

  setTimeout(() => {
    console.log("Timeout reached — no final transcription received.");
    finish(1);
  }, 60000);
}

main();
