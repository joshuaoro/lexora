import { GitCompareArrows, AlertTriangle } from "lucide-react";
import {
  type Divergence,
  MIN_REAL_REVIEWS,
  MIN_PROBE_REVIEWS,
  THIN_SAMPLE,
} from "@/lib/divergence";
import { getDict, type Lang } from "@/lib/i18n";

/**
 * Decoding against recall, drawn side by side.
 *
 * Both bars are specialist verdicts — see the note in src/lib/divergence.ts for
 * why mixing in the machine's real-word scoring would make the gap unreadable.
 *
 * The counts sit next to the percentages everywhere, and stay next to them.
 * Two large bars reading 90% and 40% are persuasive out of all proportion to
 * eighteen readings, and this panel exists to inform an intervention decision
 * about a specific child.
 */
function Bar({
  label,
  side,
  tone,
  caption,
}: {
  label: string;
  side: { n: number; correct: number; pct: number | null };
  tone: string;
  caption: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-extrabold text-ink">{label}</p>
        <p className="text-sm font-bold text-ink-muted">
          {side.pct === null ? "—" : `${side.pct}%`}{" "}
          <span className="font-semibold">
            ({side.correct}/{side.n})
          </span>
        </p>
      </div>
      <div className="mt-1 h-4 w-full overflow-hidden rounded-full bg-cream-dark">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${side.pct ?? 0}%` }} />
      </div>
      <p className="mt-1 text-xs font-semibold text-ink-muted">{caption}</p>
    </div>
  );
}

export default function DivergencePanel({ d, lang = "en" }: { d: Divergence; lang?: Lang }) {
  const t = getDict(lang).specialist;
  return (
    <section className="no-print mt-5 rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink">
        <GitCompareArrows size={20} className="text-primary" /> {t.divergenceTitle}
      </h2>
      <p className="mt-1 max-w-3xl text-sm font-semibold text-ink-muted">{t.divergenceSub}</p>

      {!d.enoughData ? (
        <div className="mt-4 rounded-2xl border border-line bg-cream/60 p-5">
          <p className="text-sm font-extrabold text-ink">{t.divergenceNotEnough}</p>
          <p className="mt-1.5 max-w-2xl text-sm font-semibold text-ink-soft">
            {t.divergenceNeeds(MIN_REAL_REVIEWS, MIN_PROBE_REVIEWS, d.real.n, d.pseudo.n)}
          </p>
          <p className="mt-2 max-w-2xl text-xs font-semibold text-ink-muted">
            {t.divergenceMinNote}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 space-y-4">
            <Bar
              label={t.divergenceRealWords}
              side={d.real}
              tone="bg-primary"
              caption={t.divergenceRealSub}
            />
            <Bar
              label={t.divergenceProbe}
              side={d.pseudo}
              tone="bg-peach-deep"
              caption={t.divergenceProbeSub}
            />
          </div>

          <div className="mt-5 rounded-2xl bg-cream/60 px-5 py-4">
            <p className="text-sm font-extrabold text-ink">
              {d.gapPoints === null
                ? "—"
                : d.gapPoints >= 25
                  ? t.divergenceGapReal(d.gapPoints)
                  : d.gapPoints <= -25
                    ? t.divergenceGapProbe(Math.abs(d.gapPoints))
                    : t.divergenceGapEven(Math.abs(d.gapPoints))}
            </p>
            <p className="mt-1 text-xs font-semibold text-ink-muted">{t.divergenceGapNote}</p>
          </div>

          {d.thin && (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-orange-soft px-4 py-3 text-xs font-bold text-orange">
              <AlertTriangle size={15} className="mt-px shrink-0" />
              {t.divergenceThin(THIN_SAMPLE)}
            </p>
          )}

          {/*
            Not a filter — this compares two sets of human verdicts, so blindness
            is not a term in the comparison. But anchoring pulls a judgement
            toward the machine, and the machine is comparatively reliable on real
            words and unreliable on non-words, so it could bias the two sides
            unequally. Stated rather than assumed away.
          */}
          <p className="mt-3 text-xs font-semibold text-ink-muted">
            {t.divergenceBlind(d.blindReal, d.real.n, d.blindPseudo, d.pseudo.n)}
            {(d.blindReal < d.real.n || d.blindPseudo < d.pseudo.n) && t.divergenceAnchored}
          </p>
        </>
      )}
    </section>
  );
}
