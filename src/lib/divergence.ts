import { prisma } from "./db";
import { viaLearnerScope } from "./demo";

/**
 * Reading from memory, or reading the letters?
 *
 * A child who has practised the same 254-word bank for eight weeks can post a
 * high accuracy without decoding much of anything — they may simply know those
 * words by sight. The non-word probe exists to tell the two apart: a word that
 * has never existed cannot be recognised, only sounded out. Setting the two
 * side by side is where that pays off. Ninety per cent on real words against
 * forty on non-words is not a middling result; it says the accuracy is recall,
 * and it calls for a different intervention entirely.
 *
 * Comparing like with like
 * ------------------------
 * Both sides here are **specialist verdicts**, never the machine's.
 *
 * The obvious version of this chart puts the app's real-word accuracy next to
 * the human-scored probe accuracy, and it would be wrong. Real words are scored
 * by Whisper against a similarity threshold; probe items are scored by a person
 * listening, precisely because the recogniser cannot spell a word that does not
 * exist. Charting one against the other would confound the scorer with the
 * thing being measured, and could show a dramatic "memorisation gap" that is
 * really the difference between two ways of marking.
 *
 * So the real-word side is restricted to readings a specialist has also
 * reviewed. That makes the chart slower to fill and the comparison honest.
 */

/**
 * Minimums before anything is drawn, stated so the numbers can be defended.
 *
 * The calibration module asks for 30 labelled readings; that is unreachable on
 * the probe side, where a run is 8 items behind a 7-day cooldown — 30 would
 * mean four sittings per child before the chart ever appeared. One complete run
 * is the natural unit, and half a run would be an arbitrary slice of one.
 */
export const MIN_REAL_REVIEWS = 10;
export const MIN_PROBE_REVIEWS = 8;

/**
 * Below this, the difference is reported but flagged as not separable.
 *
 * At n=8 a proportion moves in steps of 12.5%, so a "50-point gap" can be a
 * single item. Two confident-looking bars over a handful of readings is the
 * slide that gets taken apart in a defense.
 */
export const THIN_SAMPLE = 20;

export type Side = { n: number; correct: number; pct: number | null };

export type Divergence = {
  real: Side;
  pseudo: Side;
  /** Real-word minus non-word, in points. Null until both sides qualify. */
  gapPoints: number | null;
  enoughData: boolean;
  thin: boolean;
  /**
   * How many of the underlying verdicts were made blind.
   *
   * Not a filter — this chart compares two sets of human verdicts, so the
   * machine's verdict is not a term in the comparison and filtering to blind
   * would empty it for no gain. But anchoring pulls a judgement toward the
   * machine, and the machine is comparatively reliable on real words and
   * unreliable on non-words, so it could bias the two sides *unequally* —
   * which is exactly what distorts a gap. Reported so the limitation can be
   * named rather than assumed away.
   */
  blindReal: number;
  blindPseudo: number;
};

function side(rows: { correct: boolean; agrees: boolean }[]): Side {
  // The stored column says whether the specialist agreed with the machine, so
  // their own verdict is that agreement applied to the machine's.
  const correct = rows.filter((r) => r.agrees === r.correct).length;
  return {
    n: rows.length,
    correct,
    pct: rows.length ? Math.round((correct / rows.length) * 100) : null,
  };
}

/** Pass a learnerId for one child, or omit it for the cohort. */
export async function divergence(
  learnerId?: string,
  { includeDemo = false }: { includeDemo?: boolean } = {}
): Promise<Divergence> {
  const rows = await prisma.attempt.findMany({
    where: {
      ...(learnerId ? { learnerId } : viaLearnerScope(includeDemo)),
      isRetry: false,
      activityType: { in: ["READ_ALOUD", "PRACTICE", "PSEUDO_PROBE"] },
      review: { isNot: null },
      wordId: { not: null },
    },
    select: {
      correct: true,
      review: { select: { agrees: true, blind: true } },
      word: { select: { isPseudo: true } },
    },
  });

  const mapped = rows.map((r) => ({
    correct: r.correct,
    agrees: r.review!.agrees,
    blind: r.review!.blind,
    isPseudo: r.word!.isPseudo,
  }));

  const realRows = mapped.filter((r) => !r.isPseudo);
  const pseudoRows = mapped.filter((r) => r.isPseudo);

  const real = side(realRows);
  const pseudo = side(pseudoRows);
  const enoughData = real.n >= MIN_REAL_REVIEWS && pseudo.n >= MIN_PROBE_REVIEWS;

  return {
    real,
    pseudo,
    gapPoints:
      enoughData && real.pct !== null && pseudo.pct !== null ? real.pct - pseudo.pct : null,
    enoughData,
    thin: enoughData && (real.n < THIN_SAMPLE || pseudo.n < THIN_SAMPLE),
    blindReal: realRows.filter((r) => r.blind).length,
    blindPseudo: pseudoRows.filter((r) => r.blind).length,
  };
}
