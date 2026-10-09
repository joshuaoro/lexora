/**
 * Speech playback.
 *
 * Both words and interface instructions are neural clips synthesized on the
 * server and served from the database, because almost no device ships a
 * Filipino voice and one asked to read Tagalog produces English phonics. The
 * Web Speech API remains here only as a fallback when the server cannot be
 * reached, and for free text typed into the Reader, which has no stored clip.
 */

export function ttsSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Prefer a Filipino voice (fil-PH / tl) when the browser provides one. */
export function getFilipinoVoice(): SpeechSynthesisVoice | null {
  if (!ttsSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang.toLowerCase().startsWith("fil")) ??
    voices.find((v) => v.lang.toLowerCase().startsWith("tl")) ??
    null
  );
}

/**
 * Speak a line of interface text.
 *
 * Served from the same neural voice that pronounces the words, because the
 * browser's own engine could not do this job: virtually no device ships a
 * Filipino voice, so asking it to read Tagalog produced an English voice
 * sounding out Filipino spelling — unintelligible, and unintelligible to
 * exactly the children who need the instruction spoken.
 *
 * The clip is cached on the server and by the browser, so a phrase is
 * synthesized once for everyone. If the server cannot be reached the browser's
 * voice still tries; it is poor for Filipino, but a child who has lost their
 * connection is better served by something than by nothing.
 */
export function speakUi(text: string, lang: "en" | "fil", rate = 0.95): Promise<void> {
  stopSpeaking();
  return playUiClip(text, lang, rate);
}

/** speakUi without the stop, so a sequence of clips can play one after another. */
function playUiClip(
  text: string,
  lang: "en" | "fil",
  rate: number,
  onStart?: () => void
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return Promise.resolve();

  const url = `/api/speech?lang=${lang}&text=${encodeURIComponent(trimmed.slice(0, 300))}`;

  return new Promise((resolve) => {
    const audio = new Audio(url);
    // Honour the learner's speed setting, as word playback does. The clip is
    // synthesized once at a fixed pace, so the slider has to act here — without
    // this the setting silently governs the words and not the sentences.
    // Clamped: below ~0.6 the browser's time-stretch is unintelligible.
    audio.playbackRate = Math.min(1.5, Math.max(0.6, rate));
    currentAudio = audio;
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      if (currentAudio === audio) currentAudio = null;
      resolve();
    };
    audio.onended = done;
    audio.onplaying = () => onStart?.();
    audio.onerror = () => {
      if (settled) return;
      settled = true;
      if (currentAudio === audio) currentAudio = null;
      browserSpeak(trimmed, lang, rate).then(resolve);
    };
    audio.play().catch(() => {
      if (settled) return;
      settled = true;
      browserSpeak(trimmed, lang, rate).then(resolve);
    });
  });
}

/** Last resort when the neural clip cannot be fetched or played. */
function browserSpeak(text: string, lang: "en" | "fil", rate: number): Promise<void> {
  return new Promise((resolve) => {
    if (!ttsSupported()) return resolve();
    const voices = window.speechSynthesis.getVoices();
    const wanted = lang === "fil" ? ["fil", "tl"] : ["en"];
    const voice = voices.find((v) => wanted.some((p) => v.lang.toLowerCase().startsWith(p))) ?? null;

    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? (lang === "fil" ? "fil-PH" : "en-US");
    u.rate = rate;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

let currentAudio: HTMLAudioElement | null = null;

/**
 * Play a stored pronunciation clip. Used in preference to browser TTS for
 * word-bank words, because most devices have no Filipino voice installed and
 * would read Tagalog with English phonics.
 */
export function playAudioUrl(url: string, rate = 1): Promise<void> {
  stopSpeaking();
  return playMedia(url, rate);
}

/** playAudioUrl without the stop, so it can be one step of a sequence. */
function playMedia(url: string, rate: number): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    // Clamp: below ~0.6 the browser's time-stretch makes speech unintelligible.
    audio.playbackRate = Math.min(1.5, Math.max(0.6, rate));
    currentAudio = audio;
    const done = () => {
      if (currentAudio === audio) currentAudio = null;
      resolve();
    };
    audio.onended = done;
    audio.onerror = done;
    audio.play().catch(done);
  });
}

const pause = (ms: number, rate: number) =>
  new Promise((r) => setTimeout(r, ms / Math.min(1.5, Math.max(0.6, rate))));

/** Speak one word/short text; resolves when finished or cancelled. */
export function speakOnce(text: string, rate = 0.85): Promise<void> {
  return new Promise((resolve) => {
    if (!ttsSupported()) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    const voice = getFilipinoVoice();
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? "fil-PH";
    u.rate = rate;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

/**
 * Advanced by every stopSpeaking(). A sequence of clips checks it between
 * clips, so anything else that starts speaking — the next word, a button —
 * ends the sequence instead of talking over it.
 */
let generation = 0;

/**
 * How long each syllable has, from the moment its clip starts playing, at
 * normal speed — after which its silent tail is cut and the next one starts.
 *
 * Every synthesized clip is padded to about two seconds however short the
 * syllable: roughly 0.2 s of lead-in, the syllable, then more than a second of
 * silence. Played whole and back to back, that put over two seconds between
 * "ba" and "ta" — long enough that a child has to hold the first part in mind
 * across a gap, which is a memory task, not a blending one. Measured across
 * all 201 syllable clips on 8 October, speech ends by 0.99 s at the latest
 * ("u"), so a 1.2 s slot never cuts a syllable short and leaves about 0.4–1.0
 * s between them. The slot stretches with a slower speech-rate setting.
 */
export const SYLLABLE_SLOT_MS = 1200;

/**
 * Say a word's syllables one at a time, with a pause the app controls.
 *
 * The stored syllable clip was one synthesis of "ba, hay": the comma was meant
 * to make the voice pause, and mostly did not. Measured on 8 October, "bahay",
 * "mesa" and "salamat" had no pause at all between syllables, and Whisper
 * transcribed the clip of "sa, la, mat" as "Salamat!" — the blending activity
 * was playing the answer. Each syllable is now its own clip, from the same
 * neural voice and the same cache as the spoken instructions.
 */
/**
 * `clips` holds, per part, a specialist's recording to play instead of the
 * voice — a lone vowel (the "a" of a-so), recorded as the sound and not the
 * letter name. A recording is already trimmed to the sound, so it plays whole
 * with a short pause after it rather than inside a slot.
 */
export async function speakSyllables(parts: string[], rate = 0.85, clips?: (string | null)[]) {
  stopSpeaking();
  const mine = generation;
  const slot = SYLLABLE_SLOT_MS / Math.min(1.5, Math.max(0.6, rate));
  for (let i = 0; i < parts.length; i++) {
    if (generation !== mine) return;
    const clip = clips?.[i];
    if (clip) {
      await playMedia(clip, rate);
      if (i === parts.length - 1 || generation !== mine) return;
      await pause(RECORDED_GAP_MS, rate);
      continue;
    }
    let started = () => {};
    const playing = new Promise<void>((r) => (started = r));
    const done = playUiClip(parts[i], "fil", rate, () => started());
    if (i === parts.length - 1) return done; // the last one plays out

    // The slot runs from the first sound, not from the request, so a clip that
    // is slow to arrive is not cut short for it.
    await Promise.race([done, playing]);
    await Promise.race([done, new Promise((r) => setTimeout(r, slot))]);
    if (generation !== mine) return;
    cutCurrent();
  }
}

/** The pause after a specialist's trimmed recording, at normal speed. */
const RECORDED_GAP_MS = 350;

/**
 * The prompt of Change the sound: the word, then the sound to take out, then
 * the sound to put in — "bata … /b/ … /m/". Cancelled like any sequence.
 *
 * The two sounds are always specialist recordings (no voice can say /b/ without
 * saying "bi"); the word is its stored clip, or the neural voice's.
 */
export async function speakSwap(
  word: { wordId: string | null; hasAudio: boolean; text: string; version: number },
  fromSound: string,
  toSound: string,
  rate = 0.85
) {
  stopSpeaking();
  const mine = generation;
  if (word.wordId && word.hasAudio) {
    await playMedia(
      `/api/word-audio/${word.wordId}?kind=word&v=${word.version}`,
      Math.max(0.6, rate + 0.15)
    );
  } else {
    await playUiClip(word.text, "fil", rate);
  }
  if (generation !== mine) return;
  await pause(700, rate);
  if (generation !== mine) return;
  await playMedia(fromSound, rate);
  if (generation !== mine) return;
  await pause(500, rate);
  if (generation !== mine) return;
  await playMedia(toSound, rate);
}

/** Stop the clip that is playing without ending a sequence it belongs to. */
function cutCurrent() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

export function stopSpeaking() {
  generation += 1;
  if (ttsSupported()) window.speechSynthesis.cancel();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

/**
 * Play the stored clip when the word has one, else fall back to browser TTS.
 * `kind` selects the whole-word or syllable-by-syllable recording.
 */
export function sayWord(opts: {
  wordId?: string | null;
  hasAudio?: boolean;
  text: string;
  rate?: number;
  kind?: "word" | "syll";
  /** Bumped when a clip changes, so a re-recorded word isn't served from cache. */
  version?: number;
}): Promise<void> {
  const { wordId, hasAudio, text, rate = 0.85, kind = "word", version } = opts;
  if (wordId && hasAudio) {
    const v = version ? `&v=${version}` : "";
    // Stored clips are already spoken slowly; map the TTS rate onto playback.
    return playAudioUrl(`/api/word-audio/${wordId}?kind=${kind}${v}`, Math.max(0.6, rate + 0.15));
  }
  return speakOnce(text, rate);
}
