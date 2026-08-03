"use client";

import { Undo2, Play, Check, X } from "lucide-react";

export type CorrectionPair = {
  id: string;
  word: string;
  date: string;
  /** What the system heard on the first, unaided reading. */
  firstHeard: string | null;
  firstAudio: string | null;
  /** The re-read, taken after the correct pronunciation was played. */
  retryCorrect: boolean;
  retryHeard: string | null;
  retryAudio: string | null;
};

/**
 * Self-correction: a missed word, and the child's second go at it after hearing
 * it pronounced.
 *
 * These re-reads are excluded from accuracy, decoding time and the agreement
 * sample, because a reading taken straight after the answer was given measures
 * repetition rather than decoding. That is the right call for the statistics
 * and it left the recordings with nowhere to be heard.
 *
 * They are worth hearing. Whether a child can reproduce a word once it has been
 * modelled — and whether the two takes sound different at all — says something
 * about whether the miss was a decoding failure or a moment of hesitation, and
 * that distinction is invisible in an accuracy figure.
 */
export default function SelfCorrection({ pairs }: { pairs: CorrectionPair[] }) {
  const succeeded = pairs.filter((p) => p.retryCorrect).length;

  function play(audio: string | null) {
    if (audio) new Audio(audio).play().catch(() => {});
  }

  return (
    <section className="no-print mt-5 rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink">
            <Undo2 size={20} className="text-primary" /> Self-correction
          </h2>
          <p className="mt-1 max-w-2xl text-sm font-semibold text-ink-muted">
            A missed word, then the same word read again after the child heard it. Compare the two
            takes. These re-reads are deliberately kept out of accuracy and the reliability
            check — the child had just been told the answer — so nothing here affects the reported
            figures.
          </p>
        </div>
        {pairs.length > 0 && (
          <div className="rounded-2xl bg-primary-soft px-5 py-3 text-center">
            <p className="text-2xl font-extrabold text-primary">
              {Math.round((succeeded / pairs.length) * 100)}%
            </p>
            <p className="text-xs font-bold text-ink-soft">
              corrected ({succeeded} of {pairs.length})
            </p>
          </div>
        )}
      </div>

      {pairs.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">
          Nothing yet. A pair appears here each time the learner misses a word in a read-aloud
          activity and takes the &ldquo;Now you try it!&rdquo; turn that follows.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {pairs.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-36">
                <p className="text-lg font-extrabold text-ink">{p.word}</p>
                <p className="text-xs font-semibold text-ink-muted">{p.date}</p>
              </div>

              <div className="flex-1 min-w-56 space-y-1">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
                  <X size={14} className="shrink-0 text-red" />
                  First try:{" "}
                  <span className="font-bold text-ink">
                    {p.firstHeard ? `“${p.firstHeard}”` : "nothing heard"}
                  </span>
                  {p.firstAudio && (
                    <button
                      onClick={() => play(p.firstAudio)}
                      aria-label={`Play the first reading of ${p.word}`}
                      className="rounded-lg p-1 text-primary transition hover:bg-primary-soft"
                    >
                      <Play size={14} />
                    </button>
                  )}
                </p>
                <p className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
                  {p.retryCorrect ? (
                    <Check size={14} className="shrink-0 text-green" />
                  ) : (
                    <X size={14} className="shrink-0 text-red" />
                  )}
                  After hearing it:{" "}
                  <span className="font-bold text-ink">
                    {p.retryHeard ? `“${p.retryHeard}”` : "nothing heard"}
                  </span>
                  {p.retryAudio && (
                    <button
                      onClick={() => play(p.retryAudio)}
                      aria-label={`Play the re-read of ${p.word}`}
                      className="rounded-lg p-1 text-primary transition hover:bg-primary-soft"
                    >
                      <Play size={14} />
                    </button>
                  )}
                </p>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  p.retryCorrect ? "bg-green-soft text-green" : "bg-orange-soft text-orange"
                }`}
              >
                {p.retryCorrect ? "corrected" : "still tricky"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
