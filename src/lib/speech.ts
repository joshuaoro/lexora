import { createHash } from "node:crypto";
import { prisma } from "./db";
import { synthesizeSpeech } from "./word-tts";
import { checkLimit, recordFailure } from "./rate-limit";

/**
 * Neural speech for interface text, synthesized once and reused.
 *
 * Instructions used to be spoken by the browser's own engine. Almost no device
 * ships a Filipino voice, so a browser asked to read Tagalog reaches for an
 * English one and produces something a child cannot follow — which defeats the
 * point, because spoken instructions exist for the children who cannot read the
 * written ones. The word bank solved this years-old problem for words; this is
 * the same solution applied to the sentences around them, with the same voice,
 * so the app speaks to a child in one voice rather than two.
 */

/** One voice for both languages: the same one that pronounces the words. */
export const SPEECH_VOICE = process.env.SPEECH_VOICE ?? process.env.TTS_VOICE ?? "fil-PH-BlessicaNeural";
/** Slightly under natural pace, matching the word clips. */
export const SPEECH_RATE = process.env.SPEECH_RATE ?? "-10%";

/** Long enough for any instruction, short enough that the route cannot be abused. */
export const MAX_SPEECH_CHARS = 300;

/**
 * How many *new* phrases one account may have synthesized in a window.
 *
 * Anyone can register as a learner without a code, and this route writes to the
 * database on a cache miss — so without a ceiling a script could mint unique
 * strings until the 500MB the study lives in was full. Cache hits are not
 * counted, because they cost nothing and are the normal case: the fixed
 * instruction set is pre-generated, so a real session should rarely reach the
 * synthesizer at all. Twenty is far above what a child could trigger and far
 * below what would matter.
 */
export const NEW_CLIPS_PER_HOUR = 20;
export const CLIP_WINDOW_MS = 60 * 60 * 1000;

export function speechHash(text: string, lang: string): string {
  return createHash("sha256")
    .update(`${SPEECH_VOICE}|${SPEECH_RATE}|${lang}|${text}`)
    .digest("hex");
}

/**
 * Return the clip for this text, synthesizing it if it has not been said
 * before. Returns null when synthesis fails, so callers can fall back to the
 * browser's own voice rather than going silent.
 */
export async function getOrCreateSpeech(
  text: string,
  lang: string,
  /** Who is asking, for the synthesis budget. Omitted by the warm-up script. */
  quotaKey?: string
): Promise<{ audio: string; generated: boolean } | "quota" | null> {
  const trimmed = text.trim().slice(0, MAX_SPEECH_CHARS);
  if (!trimmed) return null;

  const hash = speechHash(trimmed, lang);

  const existing = await prisma.speechClip.findUnique({
    where: { hash },
    select: { audio: true },
  });
  if (existing) return { audio: existing.audio, generated: false };

  // A miss is about to write to the database, so this is where the budget
  // applies — not on the reads, which are the overwhelming majority.
  if (quotaKey) {
    const key = `speech:${quotaKey}`;
    if (!checkLimit(key, NEW_CLIPS_PER_HOUR).allowed) return "quota";
    recordFailure(key, CLIP_WINDOW_MS);
  }

  let audio: string;
  try {
    audio = await synthesizeSpeech(trimmed, SPEECH_VOICE, SPEECH_RATE);
  } catch (err) {
    console.error("Instruction speech synthesis failed:", err);
    return null;
  }

  await prisma.speechClip.upsert({
    where: { hash },
    create: { hash, lang, voice: SPEECH_VOICE, rate: SPEECH_RATE, text: trimmed, audio },
    // A concurrent request may have written it first; keep theirs.
    update: {},
  });

  return { audio, generated: true };
}
