"use client";

import { BookOpenCheck, Play, Check, X } from "lucide-react";
import { getDict, type Lang } from "@/lib/i18n";

export type PracticeReading = {
  id: string;
  word: string;
  date: string;
  mode: "lesson" | "check" | null;
  isRetry: boolean;
  correct: boolean;
  heard: string | null;
  hasAudio: boolean;
};

/**
 * Practice readings, kept apart from the review list (spec 2026-10-16, §5).
 *
 * A lesson is read straight after LEXORA has said the word, and a check on a
 * word taught on an earlier day, so neither measures decoding: they are not in
 * the agreement sample, accuracy or the level. They are worth hearing all the
 * same — whether a taught word holds up alone a day later is the practice
 * list's own evidence. Readings saved before 16 October carry no mode.
 */
export default function PracticePanel({ readings, lang = "en" }: { readings: PracticeReading[]; lang?: Lang }) {
  const t = getDict(lang).specialist;
  const play = (id: string) => new Audio(`/api/attempt-audio/${id}`).play().catch(() => {});

  return (
    <section className="no-print mt-5 rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink">
        <BookOpenCheck size={20} className="text-primary" /> {t.practicePanelTitle}
      </h2>
      <p className="mt-1 max-w-3xl text-sm font-semibold text-ink-muted">{t.practicePanelSub}</p>
      {readings.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">{t.practicePanelEmpty}</p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {readings.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <div className="min-w-36">
                <p className="font-extrabold text-ink">{r.word}</p>
                <p className="text-xs font-semibold text-ink-muted">{r.date}</p>
              </div>
              {r.mode && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    r.mode === "check" ? "bg-primary-soft text-primary" : "bg-peach-soft text-peach-deep"
                  }`}
                >
                  {r.isRetry ? t.practiceReread : r.mode === "check" ? t.practiceCheck : t.practiceLesson}
                </span>
              )}
              <span className="flex flex-1 items-center gap-1.5 text-sm font-semibold text-ink-soft">
                {r.correct ? <Check size={14} className="text-green" /> : <X size={14} className="text-red" />}
                {r.heard ? `“${r.heard}”` : t.rereadNothing}
              </span>
              {r.hasAudio && (
                <button
                  onClick={() => play(r.id)}
                  aria-label={t.playRecordingOf(r.word)}
                  className="rounded-lg p-1.5 text-primary transition hover:bg-primary-soft"
                >
                  <Play size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
