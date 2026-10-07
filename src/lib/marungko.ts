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
 * *reason* about which letters a learner has met must come here instead. This
 * mirrors LETTER_STAGE in prisma/marungko-stage.ts, which derives a word's
 * stage during seeding; the two must agree.
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
