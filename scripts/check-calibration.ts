/**
 * Arithmetic check for the threshold calibration.
 *
 *   npm run calibration:check
 *
 * The numbers this module produces go straight into a paper, so a plausible but
 * wrong κ or MCC would be worse than a crash: nobody would notice. Every value
 * below was worked out by hand from the confusion matrix and is asserted to the
 * digit, and the threshold replay is checked against the cases that do not obey
 * `score >= threshold` — approved ASR spellings and words of three letters or
 * fewer, both of which the live scorer decides without consulting the cut-point
 * at all.
 */
import "dotenv/config";
import {
  calibrate,
  kappa,
  mcc,
  MIN_SAMPLE,
  type LabelledReading,
} from "../src/lib/calibration";

let failures = 0;

function check(name: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failures++;
}

function close(a: number, b: number, tol = 1e-6) {
  return Math.abs(a - b) < tol;
}

console.log("Calibration arithmetic check\n");

/* ── 1. metrics against values computed by hand ────────────────────────── */
console.log("[1] κ and MCC on a matrix worked out by hand");

// TP=5 FP=2 TN=2 FN=1, n=10.
//   po = (5+2)/10                        = 0.70
//   pe = (7/10)(6/10) + (3/10)(4/10)     = 0.42 + 0.12 = 0.54
//   κ  = (0.70 − 0.54) / (1 − 0.54)      = 0.16/0.46   = 0.347826…
//   MCC = (5·2 − 2·1) / √(7·6·4·3)       = 8/√504      = 0.356348…
const m = { tp: 5, fp: 2, tn: 2, fn: 1 };
check("Cohen's κ = 0.16/0.46", close(kappa(m), 0.16 / 0.46), kappa(m).toFixed(6));
check("MCC = 8/√504", close(mcc(m), 8 / Math.sqrt(504)), mcc(m).toFixed(6));

// A classifier that accepts everything, on a sample that is entirely correct:
// one row and one column of the matrix are empty, both statistics undefined.
// Zero is the conventional reading — no better than chance — and is exactly
// what a degenerate scorer deserves, so neither may return NaN.
const degenerate = { tp: 10, fp: 0, tn: 0, fn: 0 };
check("κ is 0, not NaN, when every reading is correct", kappa(degenerate) === 0);
check("MCC is 0, not NaN, when every reading is correct", mcc(degenerate) === 0);

/* ── 2. the sweep replays the real decision rule ───────────────────────── */
console.log("\n[2] the sweep replays the rule the app actually runs");

const reading = (
  target: string,
  transcript: string | null,
  specialistCorrect: boolean,
  variants: string[] = [],
  isPseudo = false,
  blind = true
): LabelledReading => ({ target, transcript, variants, specialistCorrect, isPseudo, blind });

const at = (cal: ReturnType<typeof calibrate>, t: number) =>
  cal.curve.find((row) => row.threshold === t)!;

// "buhay" for "bahay" is one substituted vowel: similarity 1 − 1/5 = 0.80, so
// it is accepted at 0.80 and refused at 0.81. This is the single case the
// threshold genuinely decides, and the one the study cares about.
const vowel = calibrate([reading("bahay", "buhay", true)], 0.95);
check("a one-vowel miss is accepted at 0.80", at(vowel, 0.8).tp === 1, `tp=${at(vowel, 0.8).tp}`);
check("and refused at 0.81", at(vowel, 0.81).fn === 1, `fn=${at(vowel, 0.81).fn}`);

// An approved ASR spelling is accepted outright — the live scorer matches
// variants before it ever looks at the threshold.
const variant = calibrate([reading("krus", "cross", true, ["cross"])], 0.95);
check(
  "an approved spelling is accepted at every threshold",
  variant.curve.every((row) => row.tp === 1),
  "krus → cross"
);

// Words of three letters or fewer require an exact match, whatever the
// threshold. "asa" against "aso" scores 0.667 and must still be refused.
const shortExact = calibrate([reading("aso", "aso", true)], 0.95);
const shortMiss = calibrate([reading("aso", "asa", false)], 0.95);
check(
  "a 3-letter word matched exactly is accepted everywhere",
  shortExact.curve.every((row) => row.tp === 1)
);
check(
  "a 3-letter near-miss is refused everywhere, despite scoring 0.67",
  shortMiss.curve.every((row) => row.tn === 1),
  "would pass a naive score >= t sweep at 0.50–0.66"
);

// No transcript at all: nothing to compare, refused throughout.
const silent = calibrate([reading("bahay", null, false)], 0.95);
check("a silent attempt is refused everywhere", silent.curve.every((row) => row.tn === 1));

/* ── 3. the honesty guards ─────────────────────────────────────────────── */
console.log("\n[3] the guards that stop a number being over-claimed");

const tiny = calibrate([reading("bahay", "bahay", true), reading("araw", "zzzz", false)], 0.95);
check("no recommendation below the minimum sample", tiny.bestByMcc === null, `n=${tiny.sampleSize}`);
check("and the shortfall is reported", tiny.enoughData === false && MIN_SAMPLE > 2);

// A sample large enough to fit, built so the answer is known: every reading is
// either an exact match judged correct or a total miss judged wrong, so any
// threshold separates them perfectly and the whole sweep is optimal.
const separable: LabelledReading[] = [];
for (let i = 0; i < 20; i++) separable.push(reading("bahay", "bahay", true));
for (let i = 0; i < 20; i++) separable.push(reading("bahay", "zzzzz", false));
const clean = calibrate(separable, 0.95);
check("a perfectly separable sample fits", clean.enoughData && clean.bestByMcc !== null);
check("with MCC 1.0", close(clean.bestByMcc!.mcc, 1), clean.bestByMcc!.mcc.toFixed(4));
check("and κ 1.0", close(clean.bestByMcc!.kappa, 1), clean.bestByMcc!.kappa.toFixed(4));
check(
  "the plateau spans the whole sweep, because no threshold is better than another",
  clean.plateau?.from === 0.5 && clean.plateau?.to === 1,
  `${clean.plateau?.from}–${clean.plateau?.to}`
);

/* ── 4. probe non-words are measured but never fitted to ───────────────── */
console.log("\n[4] probe non-words are held out of the fit");

const withProbes = calibrate(
  [...separable, ...Array.from({ length: 8 }, () => reading("bimo", "bimo", true, [], true))],
  0.95
);
check("the fit ignores them", withProbes.sampleSize === separable.length, `n=${withProbes.sampleSize}`);
check("but they are counted and reported", withProbes.pseudoSampleSize === 8 && withProbes.pseudo !== null);

/* ── 5. blind and anchored labels are kept apart ───────────────────────── */
console.log("\n[5] the two labelling conditions are reported separately");

// Twelve blind labels the machine agrees with, and twelve anchored ones where
// it does not — a deliberately extreme split, so if the two populations were
// pooled the difference between them would vanish into one middling figure.
const mixed: LabelledReading[] = [];
for (let i = 0; i < 12; i++) mixed.push(reading("bahay", "bahay", true, [], false, true));
for (let i = 0; i < 12; i++) mixed.push(reading("bahay", "zzzzz", true, [], false, false));
for (let i = 0; i < 12; i++) mixed.push(reading("araw", "zzzzz", false, [], false, true));
const split = calibrate(mixed, 0.95);

check("blind labels are counted on their own", split.byCondition.blind?.n === 24, `n=${split.byCondition.blind?.n}`);
check("anchored labels are counted on their own", split.byCondition.anchored?.n === 12, `n=${split.byCondition.anchored?.n}`);
check(
  "and they do not agree with the machine equally — which is the point",
  split.byCondition.blind !== null &&
    split.byCondition.anchored !== null &&
    split.byCondition.blind.atCurrent.accuracy !== split.byCondition.anchored.atCurrent.accuracy,
  `blind ${split.byCondition.blind?.atCurrent.accuracy.toFixed(2)} vs anchored ${split.byCondition.anchored?.atCurrent.accuracy.toFixed(2)}`
);

const allBlind = calibrate(separable, 0.95); // helper defaults blind = true
check("a condition with too few labels is withheld, not guessed", allBlind.byCondition.anchored === null);

/* ── 6. the current threshold is always on the curve ───────────────────── */
console.log("\n[6] the setting in force is always reported");

for (const t of [0.5, 0.85, 0.95, 1]) {
  const cal = calibrate(separable, t);
  check(`threshold ${t.toFixed(2)} is found on the sweep`, cal.current.threshold === t);
}

console.log(`\n${failures ? `${failures} failure(s).` : "All calibration checks passed."}`);
if (failures) process.exit(1);
