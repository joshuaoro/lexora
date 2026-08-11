import { Scale, AlertTriangle, Download } from "lucide-react";
import type { Calibration, ThresholdMetrics } from "@/lib/calibration";
import { MIN_SAMPLE } from "@/lib/calibration";

/**
 * What the acceptance threshold should be, according to the specialists.
 *
 * Published figures to read the results against, all for automatic scoring of
 * children's oral reading:
 *
 *   κ = .54, human 92% / ASR 88% classification accuracy   (Frontiers in Education)
 *   MCC = 0.63, best of six systems on Dutch oral reading  (arXiv:2306.03444)
 *
 * The same work found agreement was significantly *lower* for students with
 * disabilities — which is every participant in this study — so these are a
 * generous bar rather than a target, and coming in under them is a result worth
 * reporting rather than a failure to hide.
 */
const BENCHMARKS = [
  { label: "Cohen's κ, children's oral reading", value: "0.54", note: "Frontiers in Education" },
  { label: "MCC, best of six ASR systems (Dutch)", value: "0.63", note: "arXiv:2306.03444" },
];

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-5 py-4 shadow-sm">
      <p className="text-2xl font-extrabold text-ink">{value}</p>
      <p className="text-sm font-semibold text-ink-muted">{label}</p>
      {hint && <p className="mt-0.5 text-xs font-semibold text-ink-soft">{hint}</p>}
    </div>
  );
}

function Matrix({ m, title }: { m: ThresholdMetrics; title: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <p className="text-sm font-extrabold text-ink">{title}</p>
      <p className="mb-3 text-xs font-semibold text-ink-muted">
        threshold {m.threshold.toFixed(2)} · κ {m.kappa.toFixed(2)} · MCC {m.mcc.toFixed(2)}
      </p>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-ink-muted">
            <th className="pb-1" />
            <th className="pb-1 font-bold">Specialist: correct</th>
            <th className="pb-1 font-bold">Specialist: misread</th>
          </tr>
        </thead>
        <tbody className="font-bold text-ink">
          <tr>
            <td className="py-1 pr-3 font-semibold text-ink-muted">System accepted</td>
            <td className="py-1 text-green">{m.tp}</td>
            <td className="py-1 text-red">{m.fp}</td>
          </tr>
          <tr>
            <td className="py-1 pr-3 font-semibold text-ink-muted">System rejected</td>
            <td className="py-1 text-red">{m.fn}</td>
            <td className="py-1 text-green">{m.tn}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-3 text-xs font-semibold text-ink-soft">
        {m.fp} reading{m.fp === 1 ? "" : "s"} wrongly accepted · {m.fn} wrongly rejected
      </p>
    </div>
  );
}

/**
 * The sweep, drawn as bars rather than a line chart.
 *
 * The shape that matters is where the peak is and how flat it is around there,
 * and a plateau is easier to see as a run of equal-height bars than as a nearly
 * horizontal line.
 */
function Curve({ cal }: { cal: Calibration }) {
  const peak = Math.max(...cal.curve.map((m) => Math.max(m.mcc, 0)), 0.01);

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-160 items-end gap-px" style={{ height: 160 }}>
        {cal.curve.map((m) => {
          const inPlateau =
            cal.plateau && m.threshold >= cal.plateau.from && m.threshold <= cal.plateau.to;
          const isCurrent = m.threshold === cal.current.threshold;
          const isBest = cal.bestByMcc?.threshold === m.threshold;
          return (
            <div
              key={m.threshold}
              className="group relative flex-1"
              style={{ height: "100%" }}
              title={`threshold ${m.threshold.toFixed(2)} — MCC ${m.mcc.toFixed(3)}, κ ${m.kappa.toFixed(3)}, ${m.fp} wrongly accepted, ${m.fn} wrongly rejected`}
            >
              <div
                className={`absolute bottom-0 w-full rounded-t-sm ${
                  isBest
                    ? "bg-primary"
                    : isCurrent
                      ? "bg-peach-deep"
                      : inPlateau
                        ? "bg-primary/45"
                        : "bg-line"
                }`}
                style={{ height: `${Math.max(1, (Math.max(m.mcc, 0) / peak) * 100)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex min-w-160 justify-between text-xs font-bold text-ink-muted">
        <span>0.50</span>
        <span>0.75</span>
        <span>1.00</span>
      </div>
      <p className="mt-3 flex flex-wrap gap-4 text-xs font-bold text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-primary" /> best by MCC
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-peach-deep" /> in force now
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-primary/45" /> as good as the best
        </span>
      </p>
    </div>
  );
}

export default function CalibrationReport({ cal }: { cal: Calibration }) {
  const wideplateau = cal.plateau !== null && cal.plateau.to - cal.plateau.from >= 0.1;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <h1 className="flex items-center gap-2 text-3xl font-extrabold text-ink">
            <Scale size={26} className="text-primary" /> Scoring threshold calibration
          </h1>
          <p className="mt-2 text-sm font-semibold text-ink-muted">
            LEXORA accepts a reading when the recogniser&apos;s transcript is similar enough to
            the target word. That cut-point began as a reasoned default chosen against clear
            synthesized speech; every reading a specialist has reviewed is a labelled example
            of whether it was set right. This fits the cut-point to those judgements and shows
            the evidence.
          </p>
          <p className="mt-2 text-sm font-semibold text-ink-muted">
            The acoustic model is not changed by any of this — Whisper is pre-trained, nothing
            is fine-tuned, and no recording is ever used as training data. What is calibrated
            is the decision made on top of it.
          </p>
        </div>
        <a
          href="/api/export?what=calibration"
          className="flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-cream-dark"
        >
          <Download size={16} /> Calibration CSV
        </a>
      </div>

      {!cal.enoughData ? (
        <section className="rounded-2xl border border-orange/40 bg-orange-soft p-6">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-orange">
            <AlertTriangle size={20} /> Not enough reviewed readings yet
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold text-ink-soft">
            {cal.sampleSize} of {MIN_SAMPLE} needed. A threshold fitted to fewer than this is a
            number with a decimal point and very little behind it — it would move with the next
            handful of readings, and it would be quoted in a paper as though it were settled.
          </p>
          <p className="mt-3 max-w-2xl text-sm font-semibold text-ink-soft">
            Review more readings on each learner&apos;s page — the <strong>Borderline
            readings</strong> panel is the most useful place to start, because those are the
            ones whose verdict actually depends on where the line sits.
          </p>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Stat label="Reviewed readings" value={`${cal.sampleSize}`} />
            <Stat
              label="Threshold in force"
              value={cal.current.threshold.toFixed(2)}
              hint={`κ ${cal.current.kappa.toFixed(2)} · MCC ${cal.current.mcc.toFixed(2)}`}
            />
            <Stat
              label="Best by MCC"
              value={cal.bestByMcc!.threshold.toFixed(2)}
              hint={
                cal.interval
                  ? `95% CI ${cal.interval.low.toFixed(2)}–${cal.interval.high.toFixed(2)}`
                  : undefined
              }
            />
            <Stat
              label="Agreement at that point"
              value={pct(cal.bestByMcc!.accuracy)}
              hint={`κ ${cal.bestByMcc!.kappa.toFixed(2)} · MCC ${cal.bestByMcc!.mcc.toFixed(2)}`}
            />
          </div>

          {wideplateau && (
            <section className="rounded-2xl border border-orange/40 bg-orange-soft p-5">
              <h2 className="flex items-center gap-2 text-sm font-extrabold text-orange">
                <AlertTriangle size={18} /> The optimum is weakly identified
              </h2>
              <p className="mt-1.5 max-w-3xl text-sm font-semibold text-ink-soft">
                Every threshold from {cal.plateau!.from.toFixed(2)} to {cal.plateau!.to.toFixed(2)}{" "}
                scores within 0.01 MCC of the best. On this sample the data cannot distinguish
                between them, so report the range rather than the single value —
                quoting {cal.bestByMcc!.threshold.toFixed(2)} on its own would claim a precision
                the evidence does not support.
              </p>
            </section>
          )}

          <section className="rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-extrabold text-ink">Agreement across the sweep</h2>
            <p className="mb-4 text-sm font-semibold text-ink-muted">
              Matthews correlation at each candidate threshold. MCC rather than plain accuracy,
              because most readings are correct: a scorer that accepted everything would post a
              high accuracy and be useless.
            </p>
            <Curve cal={cal} />
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <Matrix m={cal.current} title="At the threshold in force" />
            <Matrix m={cal.bestByMcc!} title="At the best-fitting threshold" />
          </div>

          {cal.bestByYouden && cal.bestByYouden.threshold !== cal.bestByMcc!.threshold && (
            <p className="rounded-2xl border border-line bg-card px-5 py-4 text-sm font-semibold text-ink-soft shadow-sm">
              Youden&apos;s J peaks at {cal.bestByYouden.threshold.toFixed(2)} rather than{" "}
              {cal.bestByMcc!.threshold.toFixed(2)}. J weights missing a correct reading and
              accepting a wrong one equally; MCC also accounts for how lopsided the sample is.
              Where they disagree, say which you chose and why.
            </p>
          )}

          {/*
            The comparison blind review exists to make.
            Until it was introduced, a specialist saw the machine's verdict — in
            colour, with its similarity — above the play button, so their
            judgement was not independent of the thing it judged. Agreement
            measured that way is inflated by an unknown amount, and the only way
            to find out by how much is to keep the two populations apart. A
            visible difference here is a result about anchoring; no difference is
            evidence the earlier labels were sound. Either is worth reporting,
            and neither can be claimed without this table.
          */}
          {(cal.byCondition.blind || cal.byCondition.anchored) && (
            <section className="rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-extrabold text-ink">
                Blind versus anchored judgements
              </h2>
              <p className="mb-4 max-w-3xl text-sm font-semibold text-ink-muted">
                Agreement at the threshold in force, split by whether the machine&apos;s verdict
                was hidden when the specialist decided. Reviews recorded before blind review
                existed are all anchored: the verdict, the transcript and the similarity were on
                screen above the play button.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ["Judged blind", cal.byCondition.blind],
                    ["Judged with the verdict visible", cal.byCondition.anchored],
                  ] as const
                ).map(([label, c]) => (
                  <div key={label} className="rounded-2xl border border-line bg-cream/50 px-5 py-4">
                    <p className="text-sm font-extrabold text-ink">{label}</p>
                    {c === null ? (
                      <p className="mt-1 text-sm font-semibold text-ink-muted">
                        Too few to report yet.
                      </p>
                    ) : (
                      <>
                        <p className="mt-1 text-2xl font-extrabold text-ink">
                          {pct(c.atCurrent.accuracy)}
                        </p>
                        <p className="text-sm font-semibold text-ink-muted">
                          agreement over {c.n} reading{c.n === 1 ? "" : "s"}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-ink-soft">
                          κ {c.atCurrent.kappa.toFixed(2)} · MCC {c.atCurrent.mcc.toFixed(2)}
                        </p>
                      </>
                    )}
                  </div>
                ))}
              </div>
              {cal.byCondition.blind && cal.byCondition.anchored && (
                <p className="mt-4 rounded-xl bg-cream px-4 py-3 text-xs font-semibold text-ink-soft">
                  {Math.abs(
                    cal.byCondition.anchored.atCurrent.kappa - cal.byCondition.blind.atCurrent.kappa
                  ) >= 0.1
                    ? `Anchored judgements agree with the system ${
                        cal.byCondition.anchored.atCurrent.kappa > cal.byCondition.blind.atCurrent.kappa
                          ? "more"
                          : "less"
                      } than blind ones — a difference of ${Math.abs(
                        cal.byCondition.anchored.atCurrent.kappa - cal.byCondition.blind.atCurrent.kappa
                      ).toFixed(2)} in κ. Report both figures and say which condition each came from.`
                    : "The two conditions agree closely, which is evidence that seeing the verdict first did not pull the judgements. Worth stating explicitly rather than leaving implied."}
                </p>
              )}
            </section>
          )}

          <section className="rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-extrabold text-ink">How this compares</h2>
            <p className="mb-4 text-sm font-semibold text-ink-muted">
              Published figures for automatic scoring of children&apos;s oral reading. Both were
              measured on typically-developing readers in other languages, and agreement is
              known to fall for readers with disabilities — so treat these as context, not as a
              target to hit.
            </p>
            <ul className="space-y-2">
              {BENCHMARKS.map((b) => (
                <li key={b.label} className="flex flex-wrap items-baseline gap-2 text-sm">
                  <span className="font-extrabold text-ink">{b.value}</span>
                  <span className="font-semibold text-ink-soft">{b.label}</span>
                  <span className="text-xs font-semibold text-ink-muted">({b.note})</span>
                </li>
              ))}
              <li className="flex flex-wrap items-baseline gap-2 border-t border-line pt-2 text-sm">
                <span className="font-extrabold text-primary">
                  {cal.bestByMcc!.mcc.toFixed(2)}
                </span>
                <span className="font-semibold text-ink-soft">
                  MCC — LEXORA at its best-fitting threshold, {cal.sampleSize} reviewed readings
                </span>
              </li>
            </ul>
          </section>

          {cal.pseudo && (
            <section className="rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-extrabold text-ink">Probe non-words, separately</h2>
              <p className="mb-3 text-sm font-semibold text-ink-muted">
                {cal.pseudoSampleSize} reviewed probe readings. These are excluded from the fit
                above and shown on their own: they are scored by ear precisely because the
                recogniser is transcribing words that exist in no language, so its verdict on
                them is a measurement of the recogniser rather than a basis for tuning it.
                Comparing this agreement against the figure for real words is itself a finding.
              </p>
              <div className="max-w-md">
                <Matrix m={cal.pseudo} title="Machine vs specialist on non-words" />
              </div>
            </section>
          )}
        </>
      )}

      <section className="rounded-2xl border border-line bg-cream/60 p-5 text-sm font-semibold text-ink-soft">
        <p className="font-extrabold text-ink">Changing the threshold mid-study</p>
        <p className="mt-1.5 max-w-3xl">
          This page recommends; it never changes the setting. Moving{" "}
          <code className="font-mono text-xs">SCORE_THRESHOLD</code> partway through would mean
          the baseline and the endline were scored by different rules, and the comparison
          between them would no longer be sound. The similarity is stored on every attempt, so
          the safe order is to leave it fixed for the study, then re-score the exported data at
          analysis time if the calibration warrants it — and report both figures.
        </p>
      </section>
    </div>
  );
}
