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
