"use client";

import { Undo2, Play, Check, X } from "lucide-react";
import { getDict, type Lang } from "@/lib/i18n";

export type RereadPair = {
  id: string;
  word: string;
  date: string;
  /** What the system heard on the first, unaided reading. */
  firstHeard: string | null;
  /** Attempt ids, not the recordings: the clips are fetched when played. */
  firstAudioId: string | null;
  /** The re-read, taken after the correct pronunciation was played. */
  retryCorrect: boolean;
  retryHeard: string | null;
  retryAudioId: string | null;
};

/**
 * Re-reads after modelling: a missed word, and the child's second go at it
 * after hearing it pronounced.
 *
 * Not self-correction. In running-record practice a self-correction is a child
 * fixing their own error unprompted, and LEXORA records that separately, as the
 * "Self-corrected in the recording" observation on a review. This panel shows
 * the prompted kind: the app has just said the word. It was titled
 * "Self-correction" until the two were found sharing one name — the confusion
 * a reading specialist would raise first.
 *
 * These re-reads are excluded from accuracy, decoding time and the agreement
 * sample, because a reading taken straight after the answer was given measures
 * repetition rather than decoding. They are still worth hearing: whether a
 * child can reproduce a word once it has been modelled — and whether the two
 * takes sound different at all — says something about whether the miss was a
 * decoding failure or a moment of hesitation, which no accuracy figure shows.
 */
export default function Rereads({ pairs, lang = "en" }: { pairs: RereadPair[]; lang?: Lang }) {
  const t = getDict(lang).specialist;
  const succeeded = pairs.filter((p) => p.retryCorrect).length;

  function play(attemptId: string | null) {
    if (attemptId) new Audio(`/api/attempt-audio/${attemptId}`).play().catch(() => {});
  }

  return (
    <section className="no-print mt-5 rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink">
            <Undo2 size={20} className="text-primary" /> {t.rereadTitle}
          </h2>
          <p className="mt-1 max-w-2xl text-sm font-semibold text-ink-muted">{t.rereadSub}</p>
        </div>
        {pairs.length > 0 && (
          <div className="rounded-2xl bg-primary-soft px-5 py-3 text-center">
            <p className="text-2xl font-extrabold text-primary">
              {Math.round((succeeded / pairs.length) * 100)}%
            </p>
            <p className="text-xs font-bold text-ink-soft">{t.rereadChip(succeeded, pairs.length)}</p>
          </div>
        )}
      </div>

      {pairs.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">{t.rereadEmpty}</p>
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
                  {t.rereadFirst}:{" "}
                  <span className="font-bold text-ink">
                    {p.firstHeard ? `“${p.firstHeard}”` : t.rereadNothing}
                  </span>
                  {p.firstAudioId && (
                    <button
                      onClick={() => play(p.firstAudioId)}
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
                  {t.rereadAfter}:{" "}
                  <span className="font-bold text-ink">
                    {p.retryHeard ? `“${p.retryHeard}”` : t.rereadNothing}
                  </span>
                  {p.retryAudioId && (
                    <button
                      onClick={() => play(p.retryAudioId)}
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
                {p.retryCorrect ? t.rereadGot : t.rereadStill}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
