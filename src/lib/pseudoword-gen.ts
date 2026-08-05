import { lettersUpToStage } from "./marungko";

/**
 * Propose Filipino non-words for the decoding probe.
 *
 * This suggests; it does not decide. Every candidate is shown to a reading
 * specialist, who keeps the ones that are genuinely not words before any of
 * them reaches a child.
 *
 * Why it is not allowed to generate straight into a session
 * ---------------------------------------------------------
 * Generating fresh non-words on every run is tempting — infinite supply, and
 * nothing to memorise. It breaks the probe in two ways that only show up later.
 *
 * The first is that Filipino is a small, open-syllable language, so random
 * legal strings land on real words constantly: ba-ta, ma-ta, ta-ma, ka-ma,
 * lu-pa, pu-sa. Every one of those a child reads from memory, scored as a
 * decoding success that never happened. No word list fixes this either, because
 * the children are in Davao and speak Cebuano too, so the generator would have
 * to know both languages plus local names and brands. A specialist who speaks
 * both can screen a list of twelve in under a minute. That is the check.
 *
 * The second is comparability. A pre/post design needs the endline to be the
 * same instrument as the baseline. If both runs draw freshly invented words,
 * "40% to 70%" could as easily mean the second set was easier, and there is no
 * way to tell after the fact. A fixed, reviewed bank is what makes the
 * comparison mean something — and it is what a panel can actually inspect.
 *
 * So: generate candidates, let a human accept them, keep the accepted ones.
 */

const VOWELS = ["a", "e", "i", "o", "u"];

/** Codas Filipino allows at the end of a closed syllable. */
const CODAS = ["b", "d", "k", "l", "m", "n", "p", "r", "s", "t", "y"];

function pick<T>(xs: T[]): T {
  return xs[Math.floor(Math.random() * xs.length)];
}

export type Candidate = {
  text: string;
  syllables: string;
  pattern: string;
  level: number;
};

/**
 * Build one candidate at or below `stage`, or null when the letters available
 * cannot make a pronounceable word — the earliest stages have very few.
 */
function build(stage: number, syllableCount: number, closeLast: boolean): Candidate | null {
  const allowed = new Set(lettersUpToStage(stage));
  const consonants = [...allowed].filter((c) => !VOWELS.includes(c));
  const vowels = VOWELS.filter((v) => allowed.has(v));
  if (consonants.length < 2 || vowels.length < 2) return null;

  const codas = CODAS.filter((c) => allowed.has(c));
  const parts: string[] = [];

  for (let i = 0; i < syllableCount; i++) {
    const last = i === syllableCount - 1;
    let syl = pick(consonants) + pick(vowels);
    if (last && closeLast && codas.length) syl += pick(codas);
    parts.push(syl);
  }

  const text = parts.join("");
  // "ng" is one sound in Filipino and belongs to the final Marungko stage; an
  // accidental n+g across a syllable seam would silently promote the word's
  // stage and put a digraph in front of a child who has not met it.
  if (text.includes("ng") && stage < 7) return null;

  const pattern = parts
    .map((syl) => [...syl].map((ch) => (VOWELS.includes(ch) ? "V" : "C")).join(""))
    .join("");

  return {
    text,
    syllables: parts.join("-"),
    pattern,
    // Mirrors the real bank: two open syllables is level 1, a closed syllable
    // is level 2, three syllables is level 3.
    level: syllableCount >= 3 ? 3 : closeLast ? 2 : 1,
  };
}

/**
 * Suggest up to `count` candidates for a specialist to review.
 *
 * `taken` is every word already in the bank, real and probe alike, lowercased.
 * Anything matching is dropped before it is ever shown — the one collision the
 * machine can rule out by itself.
 */
export function suggestPseudowords(stage: number, taken: Set<string>, count = 12): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();

  // Bounded rather than "until we have enough": at stage 1 the letter set is
  // m, s, a and almost every legal string is either a real word or already
  // suggested, so an unbounded loop would spin.
  for (let tries = 0; tries < count * 60 && out.length < count; tries++) {
    const syllableCount = Math.random() < 0.25 ? 3 : 2;
    const closeLast = syllableCount === 2 ? Math.random() < 0.55 : false;
    const candidate = build(stage, syllableCount, closeLast);
    if (!candidate) continue;
    if (seen.has(candidate.text) || taken.has(candidate.text)) continue;
    seen.add(candidate.text);
    out.push(candidate);
  }

  return out;
}
