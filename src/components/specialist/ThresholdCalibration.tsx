import Link from "next/link";
import { Scale } from "lucide-react";
import ReviewList, { type ReviewableAttempt } from "./ReviewList";
import { getDict, type Lang } from "@/lib/i18n";

/**
 * Borderline readings — the ones that decide whether the scoring threshold is
 * set correctly.
 *
 * The system accepts a reading when its similarity to the target reaches the
 * threshold. That line was calibrated against clear speech; real children bring
 * accents, hesitation and a noisy room, so it can only be validated against
 * actual recordings. Readings that land just below the line are exactly where
 * a wrong threshold shows up: if a specialist listens and judges several of
 * them correct, the system is too strict and is penalising children who read
 * the word properly — which would depress accuracy and distort the
 * specialist–system agreement the study reports.
 *
 * Surfacing them turns a hidden assumption into something the validation
 * chapter can evidence.
 */
export default function ThresholdCalibration({
  attempts,
  threshold,
  band,
  lang = "en",
}: {
  attempts: ReviewableAttempt[];
  threshold: number;
  band: number;
  lang?: Lang;
}) {
  const t = getDict(lang).specialist;
  const lower = threshold - band;

  return (
    <section className="no-print mt-5 rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink">
            <Scale size={20} className="text-primary" /> {t.borderlineTitle}
          </h2>
          <p className="mt-1 max-w-2xl text-sm font-semibold text-ink-muted">
            Readings that scored between {lower.toFixed(2)} and {threshold.toFixed(2)} — just
            below the line for being accepted. Play each one. If the child actually read the word
            correctly, the system is being too strict.
          </p>
        </div>
        <div className="rounded-2xl bg-primary-soft px-5 py-3 text-center">
          <p className="text-2xl font-extrabold text-primary">{threshold.toFixed(2)}</p>
          <p className="text-xs font-bold text-ink-soft">{t.borderlineThreshold}</p>
        </div>
      </div>

      <div className="mt-4">
        {attempts.length === 0 ? (
          <p className="text-sm text-ink-soft">
            No borderline readings yet. They appear once the learner has recorded readings that
            fall just short of the threshold — those are the ones worth listening to.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm font-bold text-ink">
              {attempts.length} reading{attempts.length === 1 ? "" : "s"} to check
            </p>
            <ReviewList attempts={attempts} />
            <p className="mt-4 rounded-xl bg-cream px-4 py-3 text-xs font-semibold text-ink-soft">
              Every verdict you record here becomes a labelled example. Once enough have been
              collected across all learners,{" "}
              <Link href="/specialist/calibration" className="font-bold text-primary hover:underline">
                Threshold calibration
              </Link>{" "}
              fits the acceptance line to those judgements and reports how far the current
              setting is from where the evidence puts it. These borderline readings are the most
              valuable ones to review, because they are the only ones whose verdict actually
              changes as the line moves.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
