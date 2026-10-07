import { Route, CheckCircle2, CircleDashed, AlertTriangle } from "lucide-react";
import type { ProgressionStatus } from "@/lib/adaptive";
import { getDict, type Lang } from "@/lib/i18n";

/**
 * The skill-progression map for one learner at their current level.
 *
 * Built from `progressionStatus`, which reads the same tallies the level rule
 * does — so a level that has stopped moving is explained by the rule actually
 * holding it, not by a description of the rule that may have drifted from it.
 */
function Criterion({
  title,
  rule,
  tally,
  met,
  children,
  metLabel,
  notYetLabel,
}: {
  title: string;
  rule: string;
  tally: string;
  met: boolean;
  children?: React.ReactNode;
  metLabel: string;
  notYetLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-cream/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-extrabold text-ink">{title}</p>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
            met ? "bg-green-soft text-green" : "bg-card text-ink-muted"
          }`}
        >
          {met ? <CheckCircle2 size={13} /> : <CircleDashed size={13} />}
          {met ? metLabel : notYetLabel}
        </span>
      </div>
      <p className="mt-1 text-xs font-semibold text-ink-muted">{rule}</p>
      <p className="mt-2 text-sm font-bold text-ink-soft">{tally}</p>
      {children}
    </div>
  );
}

export default function SkillProgression({ s, lang = "en" }: { s: ProgressionStatus; lang?: Lang }) {
  const dict = getDict(lang);
  const t = dict.specialist;
  const pct = (x: number) => Math.round(x * 100);
  const tally = (c: { answered: number; correct: number }) =>
    c.answered === 0 ? t.progressionNone : t.progressionTally(c.correct, c.answered);

  return (
    <section className="mt-5 rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink">
        <Route size={20} className="text-primary" /> {t.progressionTitle}
      </h2>
      <p className="mt-1 max-w-3xl text-sm font-semibold text-ink-muted">
        {s.atMax ? t.progressionAtMax : t.progressionSub(s.level)}
      </p>

      {!s.atMax && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Criterion
            title={t.progressionPa}
            rule={t.progressionPaRule(s.rule.paMin, pct(s.rule.paThreshold), s.rule.paWindow)}
            tally={tally(s.pa)}
            met={s.pa.met}
            metLabel={t.progressionMet}
            notYetLabel={t.progressionNotYet}
          >
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-ink-muted">
              {t.progressionByType}
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {Object.entries(s.pa.byType).map(([type, c]) => (
                <li
                  key={type}
                  className="rounded-full bg-card px-2.5 py-0.5 text-xs font-bold text-ink-soft"
                >
                  {dict.activity[type] ?? type} · {c.correct}/{c.answered}
                </li>
              ))}
            </ul>
          </Criterion>

          <Criterion
            title={t.progressionDecoding}
            rule={t.progressionDecodingRule(
              s.rule.decodingMin,
              pct(s.rule.decodingThreshold),
              s.rule.window
            )}
            tally={tally(s.decoding)}
            met={s.decoding.met}
            metLabel={t.progressionMet}
            notYetLabel={t.progressionNotYet}
          >
            {s.decoding.slowing && (
              <p className="mt-2 flex items-start gap-1.5 text-xs font-bold text-orange">
                <AlertTriangle size={14} className="mt-px shrink-0" />
                {t.progressionSlowing}
              </p>
            )}
          </Criterion>
        </div>
      )}
    </section>
  );
}
