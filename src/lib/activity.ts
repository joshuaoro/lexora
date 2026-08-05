/**
 * Which activities produce a score, and which only produce a count.
 *
 * A session row is rendered as "correct / total" almost everywhere, which
 * quietly assumes every activity is marked. Two are not, for different reasons:
 *
 *   READER        nothing is scored — the child is listening, not answering.
 *   PSEUDO_PROBE  nothing is scored *yet*. The verdict comes from a specialist
 *                 listening to the recording afterwards, so the session's own
 *                 correct count stays at zero however well the child read.
 *
 * That zero is not neutral. A child who read all eight non-words correctly had
 * their session displayed as "0/8" — indistinguishable from getting every one
 * wrong, to the child on their dashboard and to the specialist reviewing them.
 * Naming the rule once, here, keeps the four places that render a score from
 * disagreeing about it again.
 */
export const UNSCORED_ACTIVITY_TYPES = ["READER", "PSEUDO_PROBE"] as const;

export function isScoredActivity(type: string): boolean {
  return !(UNSCORED_ACTIVITY_TYPES as readonly string[]).includes(type);
}
