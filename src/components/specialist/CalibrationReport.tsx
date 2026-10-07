import { Scale, AlertTriangle, Download } from "lucide-react";
import type { Calibration, ThresholdMetrics } from "@/lib/calibration";
import { MIN_SAMPLE } from "@/lib/calibration";
import { getDict, type Dict, type Lang } from "@/lib/i18n";

type T = Dict["calibrationPage"];

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
  { key: "benchKappa", value: "0.54", note: "Frontiers in Education" },
  { key: "benchMcc", value: "0.63", note: "arXiv:2306.03444" },
] as const;

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

function Matrix({ m, title, t }: { m: ThresholdMetrics; title: string; t: T }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <p className="text-sm font-extrabold text-ink">{title}</p>
      <p className="mb-3 text-xs font-semibold text-ink-muted">
        {t.matrixThreshold} {m.threshold.toFixed(2)} · κ {m.kappa.toFixed(2)} · MCC {m.mcc.toFixed(2)}
      </p>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-ink-muted">
            <th className="pb-1" />
            <th className="pb-1 font-bold">{t.specCorrect}</th>
            <th className="pb-1 font-bold">{t.specMisread}</th>
          </tr>
        </thead>
        <tbody className="font-bold text-ink">
          <tr>
            <td className="py-1 pr-3 font-semibold text-ink-muted">{t.sysAccepted}</td>
            <td className="py-1 text-green">{m.tp}</td>
            <td className="py-1 text-red">{m.fp}</td>
          </tr>
          <tr>
            <td className="py-1 pr-3 font-semibold text-ink-muted">{t.sysRejected}</td>
            <td className="py-1 text-red">{m.fn}</td>
            <td className="py-1 text-green">{m.tn}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-3 text-xs font-semibold text-ink-soft">
        {t.matrixFoot(m.fp, m.fn)}
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
function Curve({ cal, t }: { cal: Calibration; t: T }) {
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
              title={t.barTitle(m.threshold.toFixed(2), m.mcc.toFixed(3), m.kappa.toFixed(3), m.fp, m.fn)}
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
          <span className="inline-block h-3 w-3 rounded-sm bg-primary" /> {t.legendBest}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-peach-deep" /> {t.legendCurrent}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-primary/45" /> {t.legendPlateau}
        </span>
      </p>
    </div>
  );
}

export default function CalibrationReport({ cal, lang = "en" }: { cal: Calibration; lang?: Lang }) {
  const t = getDict(lang).calibrationPage;
  const wideplateau = cal.plateau !== null && cal.plateau.to - cal.plateau.from >= 0.1;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <h1 className="flex items-center gap-2 text-3xl font-extrabold text-ink">
            <Scale size={26} className="text-primary" /> {t.title}
          </h1>
          <p className="mt-2 text-sm font-semibold text-ink-muted">{t.intro}</p>
          <p className="mt-2 text-sm font-semibold text-ink-muted">
            {t.measureBefore}
            <strong>{t.measureStrong}</strong>
            {t.measureAfter}
          </p>
          <p className="mt-2 text-sm font-semibold text-ink-muted">{t.notAdapted}</p>
        </div>
        <a
          href="/api/export?what=calibration"
          className="flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-cream-dark"
        >
          <Download size={16} /> {t.csv}
        </a>
      </div>

      {!cal.enoughData ? (
        <section className="rounded-2xl border border-orange/40 bg-orange-soft p-6">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-orange">
            <AlertTriangle size={20} /> {t.notEnoughTitle}
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold text-ink-soft">
            {t.notEnoughBody(cal.sampleSize, MIN_SAMPLE)}
          </p>
          <p className="mt-3 max-w-2xl text-sm font-semibold text-ink-soft">
            {t.notEnoughHintBefore}
            <strong>{t.notEnoughHintStrong}</strong>
            {t.notEnoughHintAfter}
          </p>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Stat label={t.statReviewed} value={`${cal.sampleSize}`} />
            {/* The proposal's Objective 2 figure, first: agreement as things stand. */}
            <Stat
              label={t.statAgreementNow}
              value={pct(cal.current.accuracy)}
              hint={`${t.atThreshold(cal.current.threshold.toFixed(2))} · κ ${cal.current.kappa.toFixed(2)} · MCC ${cal.current.mcc.toFixed(2)}`}
            />
            <Stat
              label={t.statBest}
              value={cal.bestByMcc!.threshold.toFixed(2)}
              hint={
                cal.interval
                  ? `95% CI ${cal.interval.low.toFixed(2)}–${cal.interval.high.toFixed(2)}`
                  : undefined
              }
            />
            <Stat
              label={t.statAgreementBest}
              value={pct(cal.bestByMcc!.accuracy)}
              hint={`κ ${cal.bestByMcc!.kappa.toFixed(2)} · MCC ${cal.bestByMcc!.mcc.toFixed(2)}`}
            />
          </div>

          {wideplateau && (
            <section className="rounded-2xl border border-orange/40 bg-orange-soft p-5">
              <h2 className="flex items-center gap-2 text-sm font-extrabold text-orange">
                <AlertTriangle size={18} /> {t.plateauTitle}
              </h2>
              <p className="mt-1.5 max-w-3xl text-sm font-semibold text-ink-soft">
                {t.plateauBody(
                  cal.plateau!.from.toFixed(2),
                  cal.plateau!.to.toFixed(2),
                  cal.bestByMcc!.threshold.toFixed(2)
                )}
              </p>
            </section>
          )}

          <section className="rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-extrabold text-ink">{t.sweepTitle}</h2>
            <p className="mb-4 text-sm font-semibold text-ink-muted">{t.sweepSub}</p>
            <Curve cal={cal} t={t} />
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <Matrix m={cal.current} title={t.matrixAtCurrent} t={t} />
            <Matrix m={cal.bestByMcc!} title={t.matrixAtBest} t={t} />
          </div>

          {cal.bestByYouden && cal.bestByYouden.threshold !== cal.bestByMcc!.threshold && (
            <p className="rounded-2xl border border-line bg-card px-5 py-4 text-sm font-semibold text-ink-soft shadow-sm">
              {t.youden(cal.bestByYouden.threshold.toFixed(2), cal.bestByMcc!.threshold.toFixed(2))}
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
              <h2 className="text-lg font-extrabold text-ink">{t.blindTitle}</h2>
              <p className="mb-4 max-w-3xl text-sm font-semibold text-ink-muted">{t.blindSub}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    [t.judgedBlind, cal.byCondition.blind],
                    [t.judgedAnchored, cal.byCondition.anchored],
                  ] as const
                ).map(([label, c]) => (
                  <div key={label} className="rounded-2xl border border-line bg-cream/50 px-5 py-4">
                    <p className="text-sm font-extrabold text-ink">{label}</p>
                    {c === null ? (
                      <p className="mt-1 text-sm font-semibold text-ink-muted">{t.tooFew}</p>
                    ) : (
                      <>
                        <p className="mt-1 text-2xl font-extrabold text-ink">
                          {pct(c.atCurrent.accuracy)}
                        </p>
                        <p className="text-sm font-semibold text-ink-muted">
                          {t.agreementOver(c.n)}
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
                    ? t.anchoredDiffers(
                        cal.byCondition.anchored.atCurrent.kappa > cal.byCondition.blind.atCurrent.kappa,
                        Math.abs(
                          cal.byCondition.anchored.atCurrent.kappa - cal.byCondition.blind.atCurrent.kappa
                        ).toFixed(2)
                      )
                    : t.anchoredSame}
                </p>
              )}
            </section>
          )}

          <section className="rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-extrabold text-ink">{t.compareTitle}</h2>
            <p className="mb-4 text-sm font-semibold text-ink-muted">{t.compareSub}</p>
            <ul className="space-y-2">
              {BENCHMARKS.map((b) => (
                <li key={b.key} className="flex flex-wrap items-baseline gap-2 text-sm">
                  <span className="font-extrabold text-ink">{b.value}</span>
                  <span className="font-semibold text-ink-soft">{t[b.key]}</span>
                  <span className="text-xs font-semibold text-ink-muted">({b.note})</span>
                </li>
              ))}
              <li className="flex flex-wrap items-baseline gap-2 border-t border-line pt-2 text-sm">
                <span className="font-extrabold text-primary">
                  {cal.bestByMcc!.mcc.toFixed(2)}
                </span>
                <span className="font-semibold text-ink-soft">
                  {t.lexoraMcc(cal.sampleSize)}
                </span>
              </li>
            </ul>
          </section>

          {cal.pseudo && (
            <section className="rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-extrabold text-ink">{t.probeTitle}</h2>
              <p className="mb-3 text-sm font-semibold text-ink-muted">
                {t.probeBody(cal.pseudoSampleSize)}
              </p>
              <div className="max-w-md">
                <Matrix m={cal.pseudo} title={t.probeMatrix} t={t} />
              </div>
            </section>
          )}
        </>
      )}

      <section className="rounded-2xl border border-line bg-cream/60 p-5 text-sm font-semibold text-ink-soft">
        <p className="font-extrabold text-ink">{t.whenTitle}</p>
        <p className="mt-1.5 max-w-3xl">
          {t.whenBefore}
          <code className="font-mono text-xs">SCORE_THRESHOLD</code>
          {t.whenAfter}
        </p>
      </section>
    </div>
  );
}
