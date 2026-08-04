import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

/**
 * Neural Filipino speech synthesis for word-bank pronunciation clips.
 * Shared by the bulk script (`npm run audio:generate`) and the per-word
 * "Generate audio" button in the Word bank, so a specialist who adds a word
 * never has to touch a terminal.
 */

export const TTS_VOICE = process.env.TTS_VOICE ?? "fil-PH-BlessicaNeural";
const MAX_BYTES = 300_000;

async function synthesize(tts: MsEdgeTTS, text: string, rate: string): Promise<string> {
  const { audioStream } = await tts.toStream(text, { rate });
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    audioStream.on("data", (c: Buffer) => chunks.push(c));
    audioStream.on("end", () => resolve());
    audioStream.on("error", reject);
  });
  const buffer = Buffer.concat(chunks);
  if (buffer.length === 0) throw new Error("empty audio stream");
  if (buffer.length > MAX_BYTES) throw new Error(`clip too large (${buffer.length} bytes)`);
  return `data:audio/mpeg;base64,${buffer.toString("base64")}`;
}

/**
 * Synthesize arbitrary text with a named voice.
 *
 * Used for interface instructions, which need the same neural voice as the
 * words but are not words and have no row in the word bank.
 */
export async function synthesizeSpeech(
  text: string,
  voice: string,
  rate: string
): Promise<string> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  return synthesize(tts, text, rate);
}

export type WordClips = { audioWord: string; audioSyll: string };

/**
 * Synthesize both clips for one word.
 * `syllables` is the hyphenated form ("ba-hay"); commas make the neural voice
 * pause between syllables.
 */
export async function synthesizeWord(text: string, syllables: string): Promise<WordClips> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(TTS_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  return {
    audioWord: await synthesize(tts, text, "-10%"),
    audioSyll: await synthesize(tts, syllables.split("-").join(", "), "-25%"),
  };
}

/** Reusable synthesizer for bulk generation (one connection for many words). */
export async function createSynthesizer() {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(TTS_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  return async (text: string, syllables: string): Promise<WordClips> => ({
    audioWord: await synthesize(tts, text, "-10%"),
    audioSyll: await synthesize(tts, syllables.split("-").join(", "), "-25%"),
  });
}
