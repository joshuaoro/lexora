import { prisma } from "./db";
import { median, PLAUSIBLE } from "./stats";
import { viaLearnerScope } from "./demo";

/**
 * The start and the end of testing, side by side — a record, not an outcome.
 *
 * A specialist may tag completed sessions BASELINE, REGULAR or ENDLINE. Without
 * this, every figure the app computed was aggregated over all time, and a
 * progress-tracking dashboard (Objective 5: accuracy "over time") could not put
 * the first sessions beside the last.
 *
 * What this is not: a pre/post measure. The study's delimitation excludes
 * measuring gains in reading, and its statistical treatment is descriptive
 * only. So this reports what the app recorded in each phase and the counts it
 * rests on, for the specialist planning what to teach — no change score is
 * offered as a finding, and no significance test is run. The probe row is the
 * useful one for that planning: real-word accuracy rising while the probe stays
 * flat suggests the bank is being recognised rather than decoded.
 */

export const MIN_PHASE_READINGS = 10;
export const MIN_PHASE_PROBES = 8; // one full probe run, as in divergence.ts

/** Below this, a difference is reported but flagged as not separable. */
export const THIN_PHASE = 20;

export type PhaseMeasures = {
  phase: "BASELINE" | "ENDLINE";
  readings: number;
  correct: number;
  accuracyPct: number | null;
  medianDecodeMs: number | null;
  probeReviewed: number;
  probeCorrect: number;
  probePct: number | null;
};

export type PhaseComparison = {
  baseline: PhaseMeasures;
  endline: PhaseMeasures;
  /** Endline minus baseline, in points. Null until both sides qualify. */
  accuracyChange: number | null;
  probeChange: number | null;
  /** Negative means faster, which is the improvement. */
  decodeChangeMs: number | null;
  enoughData: boolean;
  /** Which phase is holding the comparison up, when one is. */
  missing: "BASELINE" | "ENDLINE" | "both" | null;
  thin: boolean;
  /**
   * Readings that carry no session, and so no phase.
   *
   * These are **not** bad data and nothing about them failed to record: the
   * score, transcript, timing and any specialist verdict are all intact, and
   * they are counted in every other figure the app reports. A session is
   * created when an activity starts, and if that one request did not land the
   * readings still saved — they simply have nothing to take a phase from.
   *
   * Surfaced because a pre/post comparison quietly drawn over two-thirds of the
   * data is worse than none. Never described as errors or failures: a
   * specialist should read them as missing context, not as a fault in the
   * child's session or a reason to distrust the rest.
   */
  untaggedReadings: number;
};

const MEASURED_TYPES = ["READ_ALOUD", "PRACTICE"];

/** Pass a learnerId for one child, or omit it for the cohort. */
export async function phaseComparison(
  learnerId?: string,
  { includeDemo = false }: { includeDemo?: boolean } = {}
): Promise<PhaseComparison> {
  const scope = learnerId ? { learnerId } : viaLearnerScope(includeDemo);

  const rows = await prisma.attempt.findMany({
    where: {
      ...scope,
      isRetry: false,
      activityType: { in: [...MEASURED_TYPES, "PSEUDO_PROBE"] },
    },
    select: {
      correct: true,
      responseMs: true,
      activityType: true,
      session: { select: { phase: true } },
      review: { select: { agrees: true } },
    },
  });

  const measure = (phase: "BASELINE" | "ENDLINE"): PhaseMeasures => {
    const inPhase = rows.filter((r) => r.session?.phase === phase);

    const reads = inPhase.filter((r) => MEASURED_TYPES.includes(r.activityType));
    const correct = reads.filter((r) => r.correct).length;

    // Correct readings only, and only plausible latencies — the same rule the
    // rest of the app uses, so the figure means what it means elsewhere.
    const timed = reads
      .filter(
        (r) => r.correct && r.responseMs >= PLAUSIBLE.gte && r.responseMs <= PLAUSIBLE.lte
      )
      .map((r) => r.responseMs);

    // Probe items carry no usable machine verdict, so only reviewed ones count,
    // and the specialist's verdict is recovered from their agreement.
    const probes = inPhase.filter((r) => r.activityType === "PSEUDO_PROBE" && r.review !== null);
    const probeCorrect = probes.filter((r) => r.review!.agrees === r.correct).length;

    return {
      phase,
      readings: reads.length,
      correct,
      accuracyPct: reads.length ? Math.round((correct / reads.length) * 100) : null,
      medianDecodeMs: timed.length ? median(timed) : null,
      probeReviewed: probes.length,
      probeCorrect,
      probePct: probes.length ? Math.round((probeCorrect / probes.length) * 100) : null,
    };
  };

  const baseline = measure("BASELINE");
  const endline = measure("ENDLINE");

  const qualifies = (p: PhaseMeasures) => p.readings >= MIN_PHASE_READINGS;
  const enoughData = qualifies(baseline) && qualifies(endline);
  const missing = enoughData
    ? null
    : !qualifies(baseline) && !qualifies(endline)
      ? "both"
      : !qualifies(baseline)
        ? "BASELINE"
        : "ENDLINE";

  const bothProbes =
    baseline.probeReviewed >= MIN_PHASE_PROBES && endline.probeReviewed >= MIN_PHASE_PROBES;

  return {
    baseline,
    endline,
    accuracyChange:
      enoughData && baseline.accuracyPct !== null && endline.accuracyPct !== null
        ? endline.accuracyPct - baseline.accuracyPct
        : null,
    probeChange:
      bothProbes && baseline.probePct !== null && endline.probePct !== null
        ? endline.probePct - baseline.probePct
        : null,
    decodeChangeMs:
      enoughData && baseline.medianDecodeMs !== null && endline.medianDecodeMs !== null
        ? endline.medianDecodeMs - baseline.medianDecodeMs
        : null,
    enoughData,
    missing: missing as PhaseComparison["missing"],
    thin: enoughData && (baseline.readings < THIN_PHASE || endline.readings < THIN_PHASE),
    untaggedReadings: rows.filter(
      (r) => r.session === null && MEASURED_TYPES.includes(r.activityType)
    ).length,
  };
}
