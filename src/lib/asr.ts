/**
 * Server-side speech recognition for oral-reading scoring.
 *
 * Uses an OpenAI-compatible transcription endpoint — by default Groq's hosted
 * pre-trained Whisper model (`whisper-large-v3-turbo`) with Tagalog set as the
 * language. No custom model is trained and the learner's audio is never used
 * for training, consistent with the study delimitation.
 *
 * The target word is deliberately NOT passed as a prompt: biasing the
 * recognizer toward the expected word would mask the very misreadings the
 * system needs to detect.
 */

const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "whisper-large-v3-turbo";
const TIMEOUT_MS = 8000;
const RETRY_DELAY_MS = 1200;

/**
 * Generic Tagalog context that anchors the recognizer to Filipino spelling.
 * Without it, borrowed words come back in English orthography ("krus" → "cross",
 * "dyip" → "deep"), which would score a perfectly-read word as an error.
 *
 * This must never mention the target word or any word from the bank: biasing
 * the recognizer toward the expected answer would hide real misreadings.
 */
const FILIPINO_PROMPT =
  "Ito ay pagsasanay sa pagbasa sa wikang Filipino. Isang salita lamang ang binibigkas.";

export function asrConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY ?? process.env.ASR_API_KEY);
}

const MIME_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/flac": "flac",
};

/** Transcribe a base64 data-URL recording. Returns null on any failure. */
export async function transcribeAudio(dataUrl: string): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY ?? process.env.ASR_API_KEY;
  if (!apiKey) return null;

  const match = dataUrl.match(/^data:(audio\/[\w.+-]+)(?:;[\w=-]+)*;base64,([\s\S]+)$/);
  if (!match) return null;
  const mime = match[1];
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length < 1000) return null; // too short to contain speech

  const baseUrl = process.env.ASR_BASE_URL ?? DEFAULT_BASE_URL;
  const model = process.env.ASR_MODEL ?? DEFAULT_MODEL;
  const ext = MIME_EXT[mime] ?? "webm";

  const buildForm = () => {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(bytes)], { type: mime }), `reading.${ext}`);
    form.append("model", model);
    form.append("language", "tl");
    form.append("prompt", FILIPINO_PROMPT);
    form.append("temperature", "0");
    form.append("response_format", "json");
    return form;
  };

  const attempt = async (): Promise<{ text: string | null; retryable: boolean }> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${baseUrl}/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: buildForm(),
        signal: controller.signal,
      });
      if (!res.ok) {
        console.error(`ASR request failed: ${res.status} ${await res.text().catch(() => "")}`);
        // Rate limit or transient server error — worth one more try.
        return { text: null, retryable: res.status === 429 || res.status >= 500 };
      }
      const data = (await res.json()) as { text?: string };
      return { text: typeof data.text === "string" ? data.text : null, retryable: false };
    } catch (err) {
      console.error("ASR request error:", err);
      return { text: null, retryable: true };
    } finally {
      clearTimeout(timeout);
    }
  };

  const first = await attempt();
  if (first.text !== null || !first.retryable) return first.text;

  await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  return (await attempt()).text;
}
