import { CalendarRange, AlertTriangle, Info } from "lucide-react";
import {
  type PhaseComparison as Comparison,
  MIN_PHASE_READINGS,
  MIN_PHASE_PROBES,
  THIN_PHASE,
} from "@/lib/phases";
import { getDict, type Lang } from "@/lib/i18n";

/**
 * Baseline against endline.
 *
 * Descriptives and counts, never a p-value — see the note in src/lib/phases.ts.
 * Whether a change is distinguishable from noise is a question for the analysis
 * with a method chosen for the design, not for a web page with five children in
 * the database.
 */

function seconds(ms: number) {
  return (ms / 1000).toFixed(1);
}

function Row({
  label,
  before,
  after,
  change,
  goodDirection,
  hint,
}: {
  label: string;
  before: string;
  after: string;
  change: string | null;
  /** Which way counts as improvement, so the colour is not guessed from sign. */
  goodDirection: "up" | "down" | null;
  hint: string;
}) {
  const tone =
    change === null || goodDirection === null
      ? "text-ink-muted"
      : change.startsWith("−") === (goodDirection === "down")
        ? "text-green"
        : "text-orange";

  return (
    <tr className="border-t border-line">
      <td className="py-3 pr-3">
        <p className="font-extrabold text-ink">{label}</p>
        <p className="text-xs font-semibold text-ink-muted">{hint}</p>
      </td>
      <td className="py-3 pr-3 text-right font-bold text-ink">{before}</td>
      <td className="py-3 pr-3 text-right font-bold text-ink">{after}</td>
      <td className={`py-3 text-right font-extrabold ${tone}`}>{change ?? "—"}</td>
    </tr>
  );
}

export default function PhaseComparison({
  c,
  scope,
  lang = "en",
}: {
  c: Comparison;
  scope: "learner" | "cohort";
  lang?: Lang;
}) {
  const t = getDict(lang).specialist;
  const signed = (n: number, unit = "") =>
    `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}${unit}`;

  return (
    <section className="no-print mt-5 rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink">
        <CalendarRange size={20} className="text-primary" /> {t.phaseTitle}
      </h2>
      <p className="mt-1 max-w-3xl text-sm font-semibold text-ink-muted">
        {scope === "cohort" ? t.phaseSubCohort : t.phaseSubLearner}{" "}
        {t.phaseTagHint}
      </p>

      {!c.enoughData ? (
        <div className="mt-4 rounded-2xl border border-line bg-cream/60 p-5">
          <p className="text-sm font-extrabold text-ink">Not enough tagged readings yet</p>
          <p className="mt-1.5 max-w-2xl text-sm font-semibold text-ink-soft">
            Each phase needs {MIN_PHASE_READINGS} readings before a comparison is drawn. So far:{" "}
            <strong>{c.baseline.readings}</strong> tagged baseline and{" "}
            <strong>{c.endline.readings}</strong> tagged endline.
            {c.missing === "both"
              ? " Neither phase has been tagged yet."
              : c.missing === "BASELINE"
                ? " The baseline is the one still short."
                : " The endline is the one still short."}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-120 text-left text-sm">
              <thead>
                <tr className="text-xs font-bold uppercase tracking-wide text-ink-muted">
                  <th className="pb-2">{t.phaseMeasure}</th>
                  <th className="pb-2 text-right">Baseline</th>
                  <th className="pb-2 text-right">Endline</th>
                  <th className="pb-2 text-right">{t.phaseChange}</th>
                </tr>
              </thead>
              <tbody>
                <Row
                  label={t.phaseAccuracy}
                  hint={`${c.baseline.correct}/${c.baseline.readings} → ${c.endline.correct}/${c.endline.readings} readings`}
                  before={c.baseline.accuracyPct === null ? "—" : `${c.baseline.accuracyPct}%`}
                  after={c.endline.accuracyPct === null ? "—" : `${c.endline.accuracyPct}%`}
                  change={c.accuracyChange === null ? null : signed(c.accuracyChange, " pts")}
                  goodDirection="up"
                />
                <Row
                  label={t.phaseDecodeTime}
                  hint="Faster is the improvement — in a transparent orthography, speed is the sensitive marker"
                  before={
                    c.baseline.medianDecodeMs === null
                      ? "—"
                      : `${seconds(c.baseline.medianDecodeMs)}s`
                  }
                  after={
                    c.endline.medianDecodeMs === null ? "—" : `${seconds(c.endline.medianDecodeMs)}s`
                  }
                  change={
                    c.decodeChangeMs === null
                      ? null
                      : signed(Number((c.decodeChangeMs / 1000).toFixed(1)), "s")
                  }
                  goodDirection="down"
                />
                <Row
                  label={t.phaseProbe}
                  hint={
                    c.baseline.probeReviewed >= MIN_PHASE_PROBES &&
                    c.endline.probeReviewed >= MIN_PHASE_PROBES
                      ? `${c.baseline.probeCorrect}/${c.baseline.probeReviewed} → ${c.endline.probeCorrect}/${c.endline.probeReviewed} scored by ear`
                      : `Needs ${MIN_PHASE_PROBES} reviewed probe readings per phase — one full run (${c.baseline.probeReviewed} and ${c.endline.probeReviewed} so far)`
                  }
                  before={c.baseline.probePct === null ? "—" : `${c.baseline.probePct}%`}
                  after={c.endline.probePct === null ? "—" : `${c.endline.probePct}%`}
                  change={c.probeChange === null ? null : signed(c.probeChange, " pts")}
                  goodDirection="up"
                />
              </tbody>
            </table>
          </div>

          {c.probeChange !== null && (
            <p className="mt-4 rounded-xl bg-cream px-4 py-3 text-sm font-semibold text-ink-soft">
              <strong className="text-ink">The probe is the one that answers the question.</strong>{" "}
              Real words can be learned by sight, so a rise there is ambiguous. Made-up words
              cannot, so a rise on the probe is evidence that decoding itself improved — and a
              flat probe alongside rising real-word accuracy suggests the word bank was learned
              rather than the skill.
            </p>
          )}

          {c.thin && (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-orange-soft px-4 py-3 text-xs font-bold text-orange">
              <AlertTriangle size={15} className="mt-px shrink-0" />
              Fewer than {THIN_PHASE} readings in at least one phase. Read the direction rather
              than the size of the change.
            </p>
          )}

          <p className="mt-3 text-xs font-semibold text-ink-muted">
            Descriptive figures only. Whether a change is distinguishable from chance is a
            question for the statistical analysis, using the exported data and a test chosen
            for this design — not something this page can answer for five learners.
          </p>
        </>
      )}

      {/*
        Neutral by design, and the wording is asserted in the audit.
        These readings are complete: score, transcript, timing and any
        specialist verdict all recorded, and all counted everywhere else in the
        app. The only thing they lack is a session to take a phase from, so they
        sit out of this one comparison. Calling them errors or failures would
        tell a specialist their child's session went wrong, which it did not.
      */}
      {c.untaggedReadings > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-cream/60 px-4 py-3 text-xs font-semibold text-ink-soft">
          <Info size={15} className="mt-px shrink-0 text-primary" />
          <span>
            {c.untaggedReadings} reading{c.untaggedReadings === 1 ? " is" : "s are"} not linked to
            a session, so {c.untaggedReadings === 1 ? "it has" : "they have"} no phase and{" "}
            {c.untaggedReadings === 1 ? "is" : "are"} left out of this comparison only. Nothing is
            wrong with {c.untaggedReadings === 1 ? "it" : "them"} — the score, the recording and
            the timing are all there, and {c.untaggedReadings === 1 ? "it is" : "they are"}{" "}
            included in every other figure on this page.
          </span>
        </p>
      )}
    </section>
  );
}
