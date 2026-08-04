/** Client-side text-to-speech helpers built on the Web Speech API. */

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
  const trimmed = text.trim();
  if (!trimmed) return Promise.resolve();

  stopSpeaking();
  const url = `/api/speech?lang=${lang}&text=${encodeURIComponent(trimmed.slice(0, 300))}`;

  return new Promise((resolve) => {
    const audio = new Audio(url);
    currentAudio = audio;
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      if (currentAudio === audio) currentAudio = null;
      resolve();
    };
    audio.onended = done;
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
  return new Promise((resolve) => {
    stopSpeaking();
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

export function stopSpeaking() {
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
