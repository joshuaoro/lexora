/**
 * Which Marungko stage a Filipino word belongs to.
 *
 * The rule itself lives in src/lib/marungko.ts, beside the letter sequence it
 * is built from, because the add-word route needs it too: a word's stage is the
 * latest stage among its letters, computed rather than typed by hand, since a
 * single mis-tagged word would put letters in front of a child who has not met
 * them yet. Re-exported here for the seed and the content scripts.
 */
export { stageForWord } from "../src/lib/marungko";

/** Syllable count from the hyphenated form ("ba-hay" → 2). */
export function syllableCount(syllables: string): number {
  return syllables.split("-").filter(Boolean).length;
}
