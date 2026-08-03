/**
 * Which Marungko stage a Filipino word belongs to.
 *
 * The Marungko Approach introduces letters in a fixed order, so a word can
 * only be given to a learner once every letter in it has been taught. A word's
 * stage is therefore the highest stage among its letters — computed here
 * rather than typed by hand, because a single mis-tagged word would put
 * letters in front of a child who has not met them yet.
 */

/** Letter → the stage at which the Marungko sequence introduces it. */
const LETTER_STAGE: Record<string, number> = {
  m: 1, s: 1, a: 1,
  i: 2, o: 2,
  b: 3, e: 3, u: 3,
  t: 4, k: 4, l: 4,
  y: 5, n: 5, g: 5,
  p: 6, r: 6, d: 6, h: 6, w: 6,
  // Borrowed letters, taught last alongside "ng"
  c: 7, f: 7, j: 7, q: 7, v: 7, x: 7, z: 7, ñ: 7,
};

/** Digraphs treated as single sounds introduced in stage 7. */
const STAGE_7_DIGRAPHS = ["ng", "ts", "dy", "ny", "sy", "ly", "ky", "py", "by", "my"];

export function stageForWord(text: string): number {
  const word = text.toLowerCase();

  // "ng" and the borrowed digraphs belong to the final stage regardless of
  // the individual letters, which are introduced earlier.
  if (STAGE_7_DIGRAPHS.some((d) => word.includes(d))) return 7;

  let stage = 1;
  for (const ch of word) {
    if (ch === "-" || ch === " ") continue;
    const s = LETTER_STAGE[ch];
    if (!s) throw new Error(`"${text}": no Marungko stage known for the letter "${ch}"`);
    stage = Math.max(stage, s);
  }
  return stage;
}

/** Syllable count from the hyphenated form ("ba-hay" → 2). */
export function syllableCount(syllables: string): number {
  return syllables.split("-").filter(Boolean).length;
}
