import { GitCompareArrows, AlertTriangle } from "lucide-react";
import {
  type Divergence,
  MIN_REAL_REVIEWS,
  MIN_PROBE_REVIEWS,
  THIN_SAMPLE,
} from "@/lib/divergence";

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

export default function DivergencePanel({ d }: { d: Divergence }) {
  return (
    <section className="no-print mt-5 rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink">
        <GitCompareArrows size={20} className="text-primary" /> Decoding or memorisation?
      </h2>
      <p className="mt-1 max-w-3xl text-sm font-semibold text-ink-muted">
        Real words can be read from memory; made-up words cannot. A learner who reads real
        words far better than non-words is recognising this word bank rather than decoding
        it — which needs a different intervention, not more of the same practice. Both
        figures are the specialist&apos;s own verdicts, so the two sides are marked the same
        way.
      </p>

      {!d.enoughData ? (
        <div className="mt-4 rounded-2xl border border-line bg-cream/60 p-5">
          <p className="text-sm font-extrabold text-ink">Not enough reviewed readings yet</p>
          <p className="mt-1.5 max-w-2xl text-sm font-semibold text-ink-soft">
            Needs {MIN_REAL_REVIEWS} reviewed real words and {MIN_PROBE_REVIEWS} reviewed probe
            words — one full probe run. So far: <strong>{d.real.n}</strong> real and{" "}
            <strong>{d.pseudo.n}</strong> probe.
          </p>
          <p className="mt-2 max-w-2xl text-xs font-semibold text-ink-muted">
            The probe minimum is lower than the calibration&apos;s 30 on purpose: a run is 8
            items behind a 7-day cooldown, so 30 would mean four sittings per child before
            this could ever be drawn.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 space-y-4">
            <Bar
              label="Real words"
              side={d.real}
              tone="bg-primary"
              caption="From the word bank — can be recognised on sight"
            />
            <Bar
              label="Probe non-words"
              side={d.pseudo}
              tone="bg-peach-deep"
              caption="Made up — can only be decoded"
            />
          </div>

          <div className="mt-5 rounded-2xl bg-cream/60 px-5 py-4">
            <p className="text-sm font-extrabold text-ink">
              {d.gapPoints === null
                ? "—"
                : d.gapPoints >= 25
                  ? `Real words ${d.gapPoints} points higher — consistent with sight-word recall`
                  : d.gapPoints <= -25
                    ? `Non-words ${Math.abs(d.gapPoints)} points higher — unusual; worth listening to both sets`
                    : `Within ${Math.abs(d.gapPoints)} points — decoding and recall are tracking together`}
            </p>
            <p className="mt-1 text-xs font-semibold text-ink-muted">
              A large gap in favour of real words suggests the word bank has been learned. A
              small gap suggests the accuracy reflects decoding that should transfer to words
              the child has not met.
            </p>
          </div>

          {d.thin && (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-orange-soft px-4 py-3 text-xs font-bold text-orange">
              <AlertTriangle size={15} className="mt-px shrink-0" />
              Fewer than {THIN_SAMPLE} readings on at least one side. At this size a single
              item moves the figure by several points, so read the direction rather than the
              number, and do not quote the gap on its own.
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
            Judged blind: {d.blindReal}/{d.real.n} real words, {d.blindPseudo}/{d.pseudo.n}{" "}
            probe words.
            {(d.blindReal < d.real.n || d.blindPseudo < d.pseudo.n) &&
              " Verdicts made with the system's answer visible may have been pulled toward it, and the system is more reliable on real words than on non-words — so anchoring could affect the two sides unequally. Worth naming as a limitation."}
          </p>
        </>
      )}
    </section>
  );
}
