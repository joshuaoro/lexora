/**
 * The letter sounds a reading specialist records, in the Marungko order.
 *
 * Every letter LEXORA's word bank teaches through stage 6, plus the digraph
 * "ng". The borrowed letters of stage 7 (c, f, j…) are left out: no syllable
 * is a lone one of them, and no word pair in the bank swaps one.
 *
 * Only a person's recording of these is ever played. The neural voice reads a
 * lone letter by its name, and "ey" for /a/ is the opposite of what the
 * Marungko Approach teaches.
 */
export const LETTER_SOUNDS = [
  "m", "s", "a", "i", "o", "b", "e", "u", "t", "k", "l", "y", "n", "g",
  "p", "r", "d", "h", "w", "ng",
] as const;

export type LetterSoundId = (typeof LETTER_SOUNDS)[number];

export function isLetterSound(s: string): s is LetterSoundId {
  return (LETTER_SOUNDS as readonly string[]).includes(s);
}

/** A syllable that is a single vowel: the "a" of a-so. */
export function isLoneVowel(syllable: string): boolean {
  return /^[aeiou]$/.test(syllable);
}

/**
 * A word's first sound, when it is a consonant this list covers: "ng" for
 * ngipin, "b" for bata. Null for a word that starts with a vowel, which has no
 * first sound to swap.
 */
export function firstSound(word: string): LetterSoundId | null {
  const w = word.toLowerCase();
  if (w.startsWith("ng")) return "ng";
  const c = w[0];
  return c && !"aeiou".includes(c) && isLetterSound(c) ? c : null;
}

/** Where a recorded sound is served. The version keeps a re-record from being cached stale. */
export function letterSoundUrl(sound: string, version: number): string {
  return `/api/sounds/${encodeURIComponent(sound)}?v=${version}`;
}
