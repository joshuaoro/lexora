/**
 * Neural Filipino speech synthesis, from Microsoft Azure AI Speech.
 *
 * Shared by the word bank's "Generate audio" button, the instruction and
 * syllable speech (src/lib/speech.ts), and the bulk scripts, so a specialist
 * who adds a word never has to touch a terminal.
 *
 * Until 14 October this went through `msedge-tts`, which drives the Edge
 * browser's Read Aloud service: unofficial, unkeyed, and changed by Microsoft
 * without notice. That week it began refusing every connection (HTTP 403), and
 * any phrase not already cached fell back to the browser's own voice, the
 * English-sounding one the research team had rejected. Azure AI Speech is the
 * supported service behind the same voices, reached with a key over plain
 * HTTPS, so there is no package to break. The voice, the rates and the format
 * are unchanged, so every clip already stored stays valid and sounds the same.
 *
 * Needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (server-only; never
 * NEXT_PUBLIC_). Without them every call throws, and callers fall back as
 * they do for any synthesis failure.
 */

export const TTS_VOICE = process.env.TTS_VOICE ?? "fil-PH-BlessicaNeural";
const MAX_BYTES = 300_000;
const OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3";

/**
 * How long one call may keep retrying a throttled or failing service.
 *
 * A page is waiting on the routes' calls, so they give up quickly and let the
 * browser's voice stand in. The bulk scripts pass far more: the free tier
 * throttles by requests per minute, and a script that gave up on the first
 * 429 would leave half the bank without audio.
 */
const DEFAULT_PATIENCE_MS = 8_000;
const ATTEMPT_TIMEOUT_MS = 20_000;
const MAX_WAIT_MS = 60_000;

export type SynthesisOptions = { patienceMs?: number };

/** A failure another attempt cannot fix: a bad key, bad SSML, a clip too big. */
class Final extends Error {}

const XML_ENTITIES: Record<string, string> = {
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;",
  '"': "&quot;",
  "'": "&apos;",
};
const escapeXml = (s: string) => s.replace(/[<>&"']/g, (c) => XML_ENTITIES[c]);

function ssml(text: string, voice: string, rate: string): string {
  // xml:lang from the voice name: "fil-PH-BlessicaNeural" → "fil-PH".
  const lang = voice.split("-").slice(0, 2).join("-");
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${escapeXml(lang)}">` +
    `<voice name="${escapeXml(voice)}"><prosody rate="${escapeXml(rate)}">${escapeXml(text)}</prosody></voice>` +
    `</speak>`
  );
}

/** One clip of `text` in `voice` at `rate` ("-10%"), as MP3 bytes. */
export async function synthesizeAudio(
  text: string,
  voice: string,
  rate: string,
  { patienceMs = DEFAULT_PATIENCE_MS }: SynthesisOptions = {}
): Promise<Buffer> {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) throw new Error("AZURE_SPEECH_KEY and AZURE_SPEECH_REGION must be set");

  const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const body = ssml(text, voice, rate);
  const started = Date.now();

  for (let attempt = 1; ; attempt++) {
    let problem: string;
    let retryAfterMs = 0;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": OUTPUT_FORMAT,
          "User-Agent": "lexora",
        },
        body,
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      });
      if (res.ok) {
        const audio = Buffer.from(await res.arrayBuffer());
        if (audio.length === 0) throw new Final("empty audio");
        if (audio.length > MAX_BYTES) throw new Final(`clip too large (${audio.length} bytes)`);
        return audio;
      }
      await res.body?.cancel();
      // Only throttling and the service's own failures are worth another try.
      // A 400 (bad SSML), 401 (bad key) or 403 fails the same way every time.
      if (res.status !== 429 && res.status < 500) {
        throw new Final(`Azure Speech refused the request (HTTP ${res.status})`);
      }
      problem = `HTTP ${res.status}`;
      retryAfterMs = (Number(res.headers.get("retry-after")) || 0) * 1000;
    } catch (err) {
      if (err instanceof Final) throw err;
      problem = err instanceof Error ? err.message : String(err); // network, or the attempt timed out
    }

    const waitMs = Math.min(MAX_WAIT_MS, Math.max(retryAfterMs, 500 * 2 ** (attempt - 1)));
    if (Date.now() - started + waitMs > patienceMs) {
      throw new Error(`Azure Speech unavailable after ${attempt} attempt(s): ${problem}`);
    }
    await new Promise((r) => setTimeout(r, waitMs));
  }
}

const toDataUrl = (audio: Buffer) => `data:audio/mpeg;base64,${audio.toString("base64")}`;

/**
 * Synthesize arbitrary text with a named voice, as a data URL.
 *
 * Used for interface instructions and lone syllables, which need the same
 * neural voice as the words but have no row in the word bank.
 */
export async function synthesizeSpeech(
  text: string,
  voice: string,
  rate: string,
  options?: SynthesisOptions
): Promise<string> {
  return toDataUrl(await synthesizeAudio(text, voice, rate, options));
}

export type WordClips = { audioWord: string; audioSyll: string };

/**
 * Synthesize both clips for one word.
 * `syllables` is the hyphenated form ("ba-hay"); commas make the neural voice
 * pause between syllables.
 */
export async function synthesizeWord(
  text: string,
  syllables: string,
  options?: SynthesisOptions
): Promise<WordClips> {
  return {
    audioWord: await synthesizeSpeech(text, TTS_VOICE, "-10%", options),
    audioSyll: await synthesizeSpeech(syllables.split("-").join(", "), TTS_VOICE, "-25%", options),
  };
}
