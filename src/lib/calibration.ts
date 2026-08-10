import { prisma } from "./db";
import { scoreReading, activeScoreThreshold } from "./scoring";
import { viaLearnerScope } from "./demo";

/**
 * Fitting LEXORA's acceptance threshold to specialist judgements.
 *
 * The acoustic model is pre-trained and stays that way — Whisper is called
 * through an API, nothing is fine-tuned, and no child's recording is ever used
 * as training data. What *is* adapted is the layer on top of it: the similarity
 * at which a transcript counts as a correct reading. That number started as a
 * reasoned default (0.95) chosen against clear synthesized speech, and real
 * children bring accents, hesitation, and a room with other children in it.
 *
 * Every reviewed attempt is a labelled example — `Attempt.score` is the
 * continuous decision variable and the specialist's verdict is ground truth —
 * so the cut-point does not have to stay a guess. This module sweeps it,
 * measures agreement with the specialists at each value, and reports where the
 * evidence puts it.
 *
 * It reports. It never moves the threshold on its own: doing that mid-study
 * would mean the baseline and the endline were scored by different rules. The
 * similarity is stored on every attempt, so a change decided at the end can be
 * applied by re-scoring the exported data rather than by silently altering what
 * "correct" meant halfway through.
 */

/* ── the labelled sample ────────────────────────────────────────────────── */

export type LabelledReading = {
  target: string;
  transcript: string | null;
  variants: string[];
  /** The specialist's own verdict, recovered from their agreement. */
  specialistCorrect: boolean;
  isPseudo: boolean;
  /** Was the machine's verdict hidden when this judgement was made? */
  blind: boolean;
};

/**
 * Every reviewed first reading, across all learners.
 *
 * Cohort-wide on purpose: the threshold is one global setting, so calibrating
 * it against a single child would fit it to that child. Retries are excluded
 * for the same reason they are excluded everywhere else — a reading taken after
 * the word was modelled is not an independent measure.
 */
export async function loadLabelledReadings(
  { includeDemo = false }: { includeDemo?: boolean } = {}
): Promise<LabelledReading[]> {
  const rows = await prisma.attempt.findMany({
    where: {
      isRetry: false,
      activityType: { in: ["READ_ALOUD", "PRACTICE", "PSEUDO_PROBE"] },
      review: { isNot: null },
      // Demo learners carry fabricated readings; a threshold fitted to those
      // would be fitted to a seed script.
      ...viaLearnerScope(includeDemo),
    },
    select: {
      target: true,
      transcript: true,
      correct: true,
      review: { select: { agrees: true, blind: true } },
      word: { select: { variants: true, isPseudo: true } },
    },
  });

  return rows.map((r) => ({
    target: r.target,
    transcript: r.transcript,
    variants: (r.word?.variants ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
    // The stored column is "did the specialist agree with the machine", so the
    // specialist's own verdict is that agreement applied to the machine's.
    specialistCorrect: r.review!.agrees === r.correct,
    isPseudo: r.word?.isPseudo ?? false,
    blind: r.review!.blind,
  }));
}

/* ── replaying the decision ─────────────────────────────────────────────── */

/**
 * How a single reading behaves as the threshold moves.
 *
 * The live rule is not `score >= threshold`. `scoreReading` also accepts an
 * approved ASR spelling outright — "cross" for *krus* — and demands an exact
 * match for words of three letters or fewer, both of which ignore the threshold
 * entirely. A sweep that compared the stored similarity against each candidate
 * would therefore be measuring a classifier LEXORA does not run, and would
 * recommend an operating point for it.
 *
 * So the real function is asked, twice, at thresholds it can never meet and can
 * never miss. That separates the readings whose fate the threshold decides from
 * those it does not, using the shipped rule rather than a copy of it that could
 * drift away from it later.
 */
type Replayed =
  | { kind: "fixed"; accepted: boolean; score: number }
  | { kind: "threshold"; score: number };

function replay(r: LabelledReading): Replayed {
  const atCeiling = scoreReading(r.target, r.transcript, 2, r.variants);
  if (atCeiling.correct) {
    // Accepted even where no similarity could reach: a variant match, or a
    // short word matched exactly.
    return { kind: "fixed", accepted: true, score: atCeiling.score };
  }
  const atFloor = scoreReading(r.target, r.transcript, 0, r.variants);
  if (!atFloor.correct) {
    // Rejected even where every similarity passes: no response, or a short word
    // that was not matched exactly.
    return { kind: "fixed", accepted: false, score: atFloor.score };
  }
  return { kind: "threshold", score: atFloor.score };
}

function acceptedAt(r: Replayed, threshold: number): boolean {
  return r.kind === "fixed" ? r.accepted : r.score >= threshold;
}

/* ── metrics ────────────────────────────────────────────────────────────── */

export type Confusion = { tp: number; fp: number; tn: number; fn: number };

export type ThresholdMetrics = Confusion & {
  threshold: number;
  n: number;
  accuracy: number;
  sensitivity: number;
  specificity: number;
  precision: number;
  /** Cohen's κ — the agreement figure reading research reports. */
  kappa: number;
  /** Matthews correlation — the honest one when the classes are lopsided. */
  mcc: number;
  /** Youden's J = sensitivity + specificity − 1. */
  youden: number;
};

/**
 * Matthews correlation coefficient.
 *
 * Preferred here over accuracy and F1 because this sample is lopsided: most
 * readings are correct, so a classifier that simply accepted everything would
 * post a high accuracy and an F1 that looks respectable while being useless.
 * MCC only rises when all four cells of the confusion matrix are good.
 *
 * Zero when a whole row or column of the matrix is empty — the coefficient is
 * undefined there, and zero is the conventional reading of "no better than
 * chance", which is what a degenerate classifier deserves.
 */
export function mcc({ tp, fp, tn, fn }: Confusion): number {
  const denom = Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn));
  if (denom === 0) return 0;
  return (tp * tn - fp * fn) / denom;
}

/** Cohen's κ between the system's verdicts and the specialist's. */
export function kappa({ tp, fp, tn, fn }: Confusion): number {
  const n = tp + fp + tn + fn;
  if (n === 0) return 0;
  const observed = (tp + tn) / n;
  const expected =
    ((tp + fp) / n) * ((tp + fn) / n) + ((fn + tn) / n) * ((fp + tn) / n);
  if (expected === 1) return 0; // perfect chance agreement; κ undefined
  return (observed - expected) / (1 - expected);
}

function metricsFor(confusion: Confusion, threshold: number): ThresholdMetrics {
  const { tp, fp, tn, fn } = confusion;
  const n = tp + fp + tn + fn;
  const safe = (num: number, den: number) => (den === 0 ? 0 : num / den);
  const sensitivity = safe(tp, tp + fn);
  const specificity = safe(tn, tn + fp);
  return {
    ...confusion,
    threshold,
    n,
    accuracy: safe(tp + tn, n),
    sensitivity,
    specificity,
    precision: safe(tp, tp + fp),
    kappa: kappa(confusion),
    mcc: mcc(confusion),
    youden: sensitivity + specificity - 1,
  };
}

/** Tally the confusion matrix at one threshold. Positive class = "read correctly". */
function confusionAt(replayed: Replayed[], labels: boolean[], threshold: number): Confusion {
  const c: Confusion = { tp: 0, fp: 0, tn: 0, fn: 0 };
  for (let i = 0; i < replayed.length; i++) {
    const accepted = acceptedAt(replayed[i], threshold);
    const truth = labels[i];
    if (accepted && truth) c.tp++;
    else if (accepted && !truth) c.fp++;
    else if (!accepted && !truth) c.tn++;
    else c.fn++;
  }
  return c;
}

/* ── the sweep ──────────────────────────────────────────────────────────── */

export const SWEEP_MIN = 0.5;
export const SWEEP_MAX = 1.0;
export const SWEEP_STEP = 0.01;

/**
 * Below this many labelled readings, no threshold is recommended.
 *
 * A cut-point fitted to a handful of examples is a number with a decimal point
 * and nothing behind it, and it would be quoted in a paper as though it were
 * evidence. The panel says how many more are needed instead.
 */
export const MIN_SAMPLE = 30;

/** How close to peak MCC still counts as "as good as the best". */
const PLATEAU_EPSILON = 0.01;

const BOOTSTRAP_RESAMPLES = 1000;

export type Calibration = {
  /** One row per candidate threshold, low to high. */
  curve: ThresholdMetrics[];
  /** The threshold currently in force, and how it performs. */
  current: ThresholdMetrics;
  /** Best by MCC, and by Youden's J — reported separately when they disagree. */
  bestByMcc: ThresholdMetrics | null;
  bestByYouden: ThresholdMetrics | null;
  /**
   * The span of thresholds statistically indistinguishable from the best.
   * A wide span means the optimum is weakly identified and the single "best"
   * value should not be quoted on its own.
   */
  plateau: { from: number; to: number } | null;
  /** 95% bootstrap interval for the MCC-optimal threshold. */
  interval: { low: number; high: number } | null;
  sampleSize: number;
  /** Reviewed probe readings, reported apart — never used to pick the point. */
  pseudoSampleSize: number;
  pseudo: ThresholdMetrics | null;
  enoughData: boolean;
  /**
   * The same fit computed over blind and anchored labels separately.
   *
   * Until blind review existed, a specialist saw the machine's verdict — in
   * colour, with its similarity — above the play button, so their judgement was
   * not independent of the thing it was judging. Agreement measured that way is
   * inflated by an unknown amount, and the only way to find out by how much is
   * to keep the two populations apart and report both. The gap between them is
   * a finding about anchoring, not a footnote about methods.
   *
   * Either side is null when too few labels of that kind exist to say anything.
   */
  byCondition: {
    blind: ConditionSummary | null;
    anchored: ConditionSummary | null;
  };
};

/** Agreement at the threshold in force, for one labelling condition. */
export type ConditionSummary = {
  n: number;
  atCurrent: ThresholdMetrics;
};

function sweep(replayed: Replayed[], labels: boolean[]): ThresholdMetrics[] {
  const out: ThresholdMetrics[] = [];
  const steps = Math.round((SWEEP_MAX - SWEEP_MIN) / SWEEP_STEP);
  for (let i = 0; i <= steps; i++) {
    // Built by multiplication rather than by repeated addition: accumulating
    // 0.01 fifty times drifts, and the thresholds are compared and displayed.
    const t = Number((SWEEP_MIN + i * SWEEP_STEP).toFixed(2));
    out.push(metricsFor(confusionAt(replayed, labels, t), t));
  }
  return out;
}

function argmax(curve: ThresholdMetrics[], of: (m: ThresholdMetrics) => number) {
  return curve.reduce((best, m) => (of(m) > of(best) ? m : best), curve[0]);
}

/**
 * Bootstrap the optimal threshold.
 *
 * Resamples the labelled readings with replacement and re-finds the peak each
 * time, so the reported interval reflects how much the recommendation depends
 * on which particular children happened to be reviewed. With five participants
 * that dependence is the main thing a reader should be told about.
 */
function bootstrapInterval(
  replayed: Replayed[],
  labels: boolean[]
): { low: number; high: number } | null {
  const n = replayed.length;
  if (n === 0) return null;

  const peaks: number[] = [];
  for (let b = 0; b < BOOTSTRAP_RESAMPLES; b++) {
    const rs: Replayed[] = new Array(n);
    const ls: boolean[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const j = Math.floor(Math.random() * n);
      rs[i] = replayed[j];
      ls[i] = labels[j];
    }
    peaks.push(argmax(sweep(rs, ls), (m) => m.mcc).threshold);
  }

  peaks.sort((a, b) => a - b);
  return {
    low: peaks[Math.floor(0.025 * peaks.length)],
    high: peaks[Math.min(peaks.length - 1, Math.floor(0.975 * peaks.length))],
  };
}

/** Run the whole calibration over a labelled sample. Pure — no database. */
export function calibrate(
  readings: LabelledReading[],
  currentThreshold = activeScoreThreshold()
): Calibration {
  const real = readings.filter((r) => !r.isPseudo);
  const pseudoReadings = readings.filter((r) => r.isPseudo);

  const replayed = real.map(replay);
  const labels = real.map((r) => r.specialistCorrect);

  const curve = sweep(replayed, labels);
  const currentRounded = Number(currentThreshold.toFixed(2));
  const current =
    curve.find((m) => m.threshold === currentRounded) ??
    metricsFor(confusionAt(replayed, labels, currentThreshold), currentRounded);

  const enoughData = real.length >= MIN_SAMPLE;

  let bestByMcc: ThresholdMetrics | null = null;
  let bestByYouden: ThresholdMetrics | null = null;
  let plateau: { from: number; to: number } | null = null;
  let interval: { low: number; high: number } | null = null;

  if (enoughData) {
    bestByMcc = argmax(curve, (m) => m.mcc);
    bestByYouden = argmax(curve, (m) => m.youden);

    const near = curve.filter((m) => m.mcc >= bestByMcc!.mcc - PLATEAU_EPSILON);
    plateau = { from: near[0].threshold, to: near[near.length - 1].threshold };

    interval = bootstrapInterval(replayed, labels);
  }

  // Probe items are measured but never allowed to move the operating point:
  // they are scored by ear precisely because the machine's verdict on a
  // non-word is not something to fit a threshold to.
  const pseudoReplayed = pseudoReadings.map(replay);
  const pseudoLabels = pseudoReadings.map((r) => r.specialistCorrect);
  const pseudo = pseudoReadings.length
    ? metricsFor(confusionAt(pseudoReplayed, pseudoLabels, currentThreshold), currentRounded)
    : null;

  // Agreement at the threshold in force, split by whether the machine's verdict
  // was visible when the label was made. Reported even on small samples, with
  // the count attached, because the comparison is the point — but a single-digit
  // n is not worth computing at all.
  const MIN_CONDITION = 5;
  const condition = (want: boolean): ConditionSummary | null => {
    const subset = real.filter((r) => r.blind === want);
    if (subset.length < MIN_CONDITION) return null;
    return {
      n: subset.length,
      atCurrent: metricsFor(
        confusionAt(subset.map(replay), subset.map((r) => r.specialistCorrect), currentThreshold),
        currentRounded
      ),
    };
  };

  return {
    byCondition: { blind: condition(true), anchored: condition(false) },
    curve,
    current,
    bestByMcc,
    bestByYouden,
    plateau,
    interval,
    sampleSize: real.length,
    pseudoSampleSize: pseudoReadings.length,
    pseudo,
    enoughData,
  };
}

/** Load and calibrate in one call. */
export async function calibrationReport(
  opts: { includeDemo?: boolean } = {}
): Promise<Calibration> {
  return calibrate(await loadLabelledReadings(opts));
}
