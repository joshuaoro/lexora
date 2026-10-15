"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { speakSyllables, stopSpeaking } from "@/lib/tts";

/**
 * Count the syllables, answered: the app counts the word with the child.
 *
 * The reading specialist's consultation (16 October) asked for the word to be
 * heard, not read, and for the app to teach rather than only mark. Telling a
 * seven-year-old to "clap along if it helps" in plain text did neither, so the
 * clapping is shown instead: the parts play one at a time, each card lights up
 * as its part is heard, a clap pops above it, and a number counts under it,
 * ending on the total. By the next word the child has seen what counting
 * syllables looks like.
 *
 * It runs only after the answer. During the question the word is played whole,
 * because hearing it in parts, or watching claps keep time, would give the
 * count away.
 *
 * The parts always play one clip at a time, even for a word whose syllables a
 * specialist has recorded as one take: one take carries no timing to keep the
 * claps in step with. Lone vowels still come from the specialists' recordings
 * (`clips`). Under reduced motion the pop is suppressed by the global
 * stylesheet; the highlight and the count still step along.
 */
export default function SyllableCount({
  syllables,
  clips,
  rate,
  wordStyle,
  labels,
  startDelayMs = 700,
}: {
  /** Hyphenated, as stored: "ba-hay". */
  syllables: string;
  /** Per part, a specialist's recording to play instead of the voice. */
  clips?: (string | null)[];
  rate: number;
  wordStyle: React.CSSProperties;
  labels: {
    total: (n: number) => string;
    again: string;
    groupAria: (word: string) => string;
  };
  /** Leaves room for the answer chime before the first part. */
  startDelayMs?: number;
}) {
  const parts = useMemo(() => syllables.split("-").filter(Boolean), [syllables]);
  const [active, setActive] = useState(-1);
  const [counted, setCounted] = useState(0);
  const [done, setDone] = useState(false);
  /** Each run's number; a run that is no longer the latest stops touching state. */
  const runRef = useRef(0);

  const play = useCallback(async () => {
    const run = ++runRef.current;
    let reached = 0;
    setActive(-1);
    setCounted(0);
    setDone(false);
    await speakSyllables(parts, rate, clips, (i) => {
      if (runRef.current !== run) return;
      reached = i + 1;
      setActive(i);
      setCounted(i + 1);
    });
    if (runRef.current !== run) return;
    setActive(-1);
    // Cut short (another sound started): leave the partial count and offer a replay.
    setDone(reached === parts.length);
  }, [parts, rate, clips]);

  useEffect(() => {
    // The run counter, not a DOM node: bumping it on the way out is how a run
    // still awaiting its last clip learns it no longer owns the state.
    const runs = runRef;
    const timer = setTimeout(() => void play(), startDelayMs);
    return () => {
      clearTimeout(timer);
      runs.current++;
      stopSpeaking();
    };
  }, [play, startDelayMs]);

  return (
    <div className="mt-6" role="group" aria-label={labels.groupAria(parts.join(""))}>
      <ol className="flex flex-wrap items-end justify-center gap-3 sm:gap-4">
        {parts.map((part, i) => {
          const heard = i < counted;
          return (
            <li key={`${part}-${i}`} className="flex flex-col items-center">
              {/* Remounted each time its part is heard, so the pop replays. */}
              <span aria-hidden className="h-10 text-3xl leading-none">
                {active === i && (
                  <span className="inline-block animate-[clap_0.45s_ease-out]">👏</span>
                )}
              </span>
              <span
                className={`mt-1 rounded-2xl border-2 px-4 py-2.5 font-extrabold transition duration-200 sm:px-5 ${
                  heard
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-line bg-white text-ink-muted"
                } ${active === i ? "scale-110 shadow-md" : ""}`}
                style={{ ...wordStyle, fontSize: "clamp(26px, 9vw, 40px)" }}
              >
                {part}
              </span>
              <span aria-hidden className="mt-1.5 h-6 text-lg font-extrabold text-primary">
                {heard ? i + 1 : ""}
              </span>
            </li>
          );
        })}
      </ol>
      <p aria-live="polite" className="mt-2 min-h-8 text-xl font-extrabold text-ink">
        {done ? labels.total(parts.length) : ""}
      </p>
      {(done || (counted > 0 && active === -1)) && (
        <button
          onClick={() => void play()}
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-ink shadow-sm transition hover:bg-cream"
        >
          <RotateCcw size={16} /> {labels.again}
        </button>
      )}
    </div>
  );
}
