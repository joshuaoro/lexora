/** Marungko Approach letter sequence, grouped into LEXORA's seven stages. */
export const STAGE_LETTERS = [
  "m, s, a",
  "+ i, o",
  "+ b, e, u",
  "+ t, k, l",
  "+ y, n, g",
  "+ p, r, d, h, w",
  "+ ng at hiram na titik",
] as const;

/**
 * The same sequence as data rather than as display copy.
 *
 * `STAGE_LETTERS` above is written to be read by a person — it carries "+"
 * signs and a Filipino phrase for the last stage — so anything that needs to
 * *reason* about which letters a learner has met must come here instead.
 * `stageForWord` below is built from it, so there is one table, not two that
 * must be kept in step.
 */
export const STAGE_LETTER_SETS: readonly (readonly string[])[] = [
  ["m", "s", "a"],
  ["i", "o"],
  ["b", "e", "u"],
  ["t", "k", "l"],
  ["y", "n", "g"],
  ["p", "r", "d", "h", "w"],
  ["c", "f", "j", "q", "v", "x", "z", "ñ"],
] as const;

/** Digraphs read as one sound, introduced with "ng" in the final stage. */
const STAGE_7_DIGRAPHS = ["ng", "ts", "dy", "ny", "sy", "ly", "ky", "py", "by", "my"];

const LETTER_STAGE = new Map<string, number>(
  STAGE_LETTER_SETS.flatMap((letters, i) => letters.map((letter) => [letter, i + 1] as const))
);

/**
 * The Marungko stage a word belongs to: the latest stage among its letters.
 *
 * Derived, never chosen. A word may only be shown once every letter in it has
 * been taught, and a stage typed by hand is how one gets in early — the word
 * bank's add form used to offer a stage picker defaulting to 1, so "kalabaw"
 * (stage 6 letters) added in a hurry would have reached a child who knew only
 * m, s and a. The seed, `words:sync` and the add-word route all call this.
 */
export function stageForWord(text: string): number {
  const word = text.toLowerCase();

  // "ng" and the borrowed digraphs belong to the final stage regardless of
  // the individual letters, which are introduced earlier.
  if (STAGE_7_DIGRAPHS.some((d) => word.includes(d))) return 7;

  let stage = 1;
  for (const ch of word) {
    if (ch === "-" || ch === " ") continue;
    const s = LETTER_STAGE.get(ch);
    if (!s) throw new Error(`"${text}": no Marungko stage known for the letter "${ch}"`);
    stage = Math.max(stage, s);
  }
  return stage;
}

/** Every letter the Marungko sequence has introduced by the end of `stage`. */
export function lettersUpToStage(stage: number): string[] {
  return STAGE_LETTER_SETS.slice(0, Math.max(0, Math.min(7, stage))).flat();
}

/**
 * The Marungko stage a learner is taught from: it widens with the level and
 * never shrinks below what they have already reached.
 *
 * One rule, used by the word pools, the adaptive step and the specialist's
 * level override, so the stage a child is shown words from and the stage
 * recorded against them cannot disagree. They did once: a new learner was
 * recorded at stage 1 (m, s, a) while every activity drew stage-3 words.
 *
 * Level 1 maps to stage 3 rather than 1 because stages 1–2 hold only fourteen
 * words between them — too few for an eight-word session not to repeat itself
 * within a sitting, which would turn decoding practice into recall.
 */
export function effectiveStage(level: number, stage: number): number {
  return Math.max(stage, Math.min(7, level + 2));
}

export function stageLabel(stage: number) {
  return `Stage ${stage} (${STAGE_LETTERS[stage - 1] ?? ""})`;
}
