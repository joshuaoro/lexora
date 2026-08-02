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

export function stageLabel(stage: number) {
  return `Stage ${stage} (${STAGE_LETTERS[stage - 1] ?? ""})`;
}
