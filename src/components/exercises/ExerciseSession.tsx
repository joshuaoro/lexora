"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Mic,
  Volume2,
  Check,
  X,
  Star,
  ArrowRight,
  RotateCcw,
  Home,
  Ear,
  PartyPopper,
} from "lucide-react";
import type { ExerciseItem, ExerciseType } from "@/lib/exercise-items";
import { FONT_STACKS, OVERLAY_COLORS, type ReaderSettings } from "@/lib/settings";
import { sayWord, playAudioUrl, speakOnce, stopSpeaking } from "@/lib/tts";
import { getDict, type Lang } from "@/lib/i18n";
import { useOralReading } from "./useOralReading";

type Phase = "intro" | "item" | "feedback" | "done";

// Module-scope clock wrapper: these reads happen in event handlers only.
const now = () => Date.now();

type Feedback = {
  correct: boolean;
  heard: string | null;
  chosen: string | null;
};

function playChime(good: boolean) {
  try {
    const ctx = new AudioContext();
    const notes = good ? [523.25, 659.25, 783.99] : [330, 262];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.3);
    });
  } catch {
    // audio is a nice-to-have
  }
}

/** Word display size that shrinks gracefully on small screens. */
function wordSize(base: number, factor: number) {
  return `clamp(26px, 11vw, ${Math.round(base * factor)}px)`;
}

export default function ExerciseSession({
  type,
  items,
  settings,
  lang,
}: {
  type: ExerciseType;
  items: ExerciseItem[];
  settings: ReaderSettings;
  lang: Lang;
}) {
  const router = useRouter();
  const dict = getDict(lang);
  const t = dict.session;

  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [leveledUp, setLeveledUp] = useState(false);
  const [posting, setPosting] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const sessionStartRef = useRef(0);
  const itemStartRef = useRef(0);

  const {
    state: micState,
    supported: micOk,
    micError,
    start: listen,
    stopListening,
  } = useOralReading();

  const item = items[index];
  const isOral = type === "READ_ALOUD" || type === "PRACTICE";
  const intro = t.intro[type];

  useEffect(() => () => stopSpeaking(), []);

  const beginItem = useCallback(
    (i: number) => {
      setIndex(i);
      setFeedback(null);
      setPhase("item");
      itemStartRef.current = now();
      const next = items[i];
      // Receptive activities speak the target automatically
      if (next && (type === "LISTEN_CHOOSE" || type === "RHYME" || type === "FIRST_SOUND")) {
        setTimeout(
          () =>
            sayWord({
              wordId: next.wordId,
              hasAudio: next.hasAudio,
              text: next.target,
              rate: settings.ttsRate,
              version: next.audioVersion,
            }),
          350
        );
      }
    },
    [items, type, settings.ttsRate]
  );

  async function startSession() {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    const data = await res.json().catch(() => ({}));
    sessionIdRef.current = data.id ?? null;
    sessionStartRef.current = now();
    setResults([]);
    setLeveledUp(false);
    beginItem(0);
  }

  async function submitAttempt(payload: {
    transcript?: string | null;
    browserTranscript?: string | null;
    choiceCorrect?: boolean;
    chosen?: string | null;
    audio?: string | null;
  }) {
    setPosting(true);
    setScoreError(null);
    const res = await fetch("/api/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sessionIdRef.current ?? undefined,
        wordId: item.wordId,
        activityType: type,
        target: item.target,
        transcript: payload.transcript ?? null,
        browserTranscript: payload.browserTranscript ?? null,
        choiceCorrect: payload.choiceCorrect,
        responseMs: Math.min(600000, now() - itemStartRef.current),
        audio: payload.audio ?? undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setPosting(false);

    // No recognizer could score the recording — nothing was saved, let them retry.
    if (!res.ok) {
      setScoreError(t.scoringUnavailable);
      return;
    }

    const correct: boolean = Boolean(data.correct);
    if (data.levelChanged === "up") setLeveledUp(true);
    setResults((r) => [...r, correct]);
    setFeedback({ correct, heard: data.heard || null, chosen: payload.chosen ?? null });
    setPhase("feedback");
    playChime(correct);
    if (!correct) {
      // Immediate corrective feedback: hear the right word
      setTimeout(() => sayTarget(), 700);
    }
  }

  async function onMicPress() {
    // Tapping while listening ends the take early; recording otherwise
    // stops itself after the child finishes speaking.
    if (micState === "listening") {
      stopListening();
      return;
    }
    if (micState !== "idle" || posting) return;
    setScoreError(null);
    const { audio, browserTranscript } = await listen(item.target);
    await submitAttempt({ audio, browserTranscript });
  }

  async function onSkip() {
    await submitAttempt({ transcript: null });
  }

  async function onChoose(option: string) {
    if (posting) return;
    stopSpeaking();
    await submitAttempt({ choiceCorrect: option === item.answer, chosen: option, transcript: option });
  }

  async function next() {
    stopSpeaking();
    if (index + 1 < items.length) {
      beginItem(index + 1);
      return;
    }
    // Finish: persist session totals
    const correct = results.filter(Boolean).length;
    if (sessionIdRef.current) {
      await fetch(`/api/sessions/${sessionIdRef.current}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          total: items.length,
          correct,
          durationMs: now() - sessionStartRef.current,
        }),
      });
    }
    setPhase("done");
    router.refresh();
  }

  /** Play the target word: stored Filipino clip when available, else browser TTS. */
  function sayTarget() {
    return sayWord({
      wordId: item.wordId,
      hasAudio: item.hasAudio,
      text: item.target,
      rate: settings.ttsRate,
      version: item.audioVersion,
    });
  }

  async function speakSyllables() {
    stopSpeaking();
    if (item.wordId && item.hasSyllAudio) {
      await playAudioUrl(
        `/api/word-audio/${item.wordId}?kind=syll&v=${item.audioVersion}`,
        Math.max(0.6, settings.ttsRate + 0.15)
      );
      return;
    }
    for (const part of (item.syllables ?? item.target).split("-")) {
      await speakOnce(part, Math.max(0.5, settings.ttsRate * 0.9));
    }
  }

  /* ————— render helpers ————— */

  const wordStyle: React.CSSProperties = {
    fontFamily: FONT_STACKS[settings.font],
    letterSpacing: `${settings.letterSpacing}em`,
    lineHeight: settings.lineHeight,
  };

  const surface = { backgroundColor: OVERLAY_COLORS[settings.overlay] };

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-line bg-card p-6 text-center shadow-sm sm:p-10">
        <h1 className="text-2xl font-extrabold text-ink">{intro.title}</h1>
        <p className="mt-3 text-ink-soft">
          {type === "PRACTICE" ? t.emptyPractice : t.emptyGeneric}
        </p>
        <Link
          href="/exercises"
          className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 font-bold text-white transition hover:bg-primary-dark"
        >
          {t.backToExercises}
        </Link>
      </div>
    );
  }

  if (phase === "intro") {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-line bg-card p-6 text-center shadow-sm sm:p-10">
        <h1 className="text-3xl font-extrabold text-ink">{intro.title}</h1>
        <p className="mt-3 text-lg text-ink-soft">{intro.blurb}</p>
        <p className="mt-2 text-sm font-semibold text-ink-muted">{intro.how}</p>
        {isOral && !micOk && (
          <p className="mt-4 rounded-xl bg-orange-soft px-4 py-3 text-sm font-bold text-orange">
            {dict.common.noMic}
          </p>
        )}
        <button
          onClick={startSession}
          disabled={isOral && !micOk}
          className="mt-8 rounded-2xl bg-primary px-10 py-4 text-xl font-extrabold text-white shadow-sm transition hover:bg-primary-dark disabled:opacity-50"
        >
          {t.start(items.length)}
        </button>
      </div>
    );
  }

  if (phase === "done") {
    const correct = results.filter(Boolean).length;
    const pct = Math.round((correct / items.length) * 100);
    const stars = pct >= 90 ? 3 : pct >= 70 ? 2 : pct >= 50 ? 1 : 0;
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-line bg-card p-6 text-center shadow-sm sm:p-10">
        <div className="flex justify-center gap-2" role="img" aria-label={`${stars}/3`}>
          {[0, 1, 2].map((i) => (
            <Star
              key={i}
              size={44}
              className={i < stars ? "fill-orange text-orange" : "text-line"}
            />
          ))}
        </div>
        <h1 className="mt-4 text-3xl font-extrabold text-ink">
          {stars === 3 ? t.stars3 : stars >= 1 ? t.stars1 : t.stars0}
        </h1>
        <p className="mt-2 text-lg font-semibold text-ink-soft">
          {t.score(correct, items.length, pct)}
        </p>
        {leveledUp && (
          <p className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-green-soft px-4 py-3 font-bold text-green">
            <PartyPopper size={20} /> {t.levelUp}
          </p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={startSession}
            className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-white transition hover:bg-primary-dark"
          >
            <RotateCcw size={18} /> {t.playAgain}
          </button>
          <Link
            href="/exercises"
            className="flex items-center gap-2 rounded-xl border border-line bg-card px-6 py-3 font-bold text-ink transition hover:bg-cream-dark"
          >
            {t.moreExercises}
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-xl border border-line bg-card px-6 py-3 font-bold text-ink transition hover:bg-cream-dark"
          >
            <Home size={18} /> {t.goDashboard}
          </Link>
        </div>
      </div>
    );
  }

  /* item + feedback phases */
  return (
    <div className="mx-auto max-w-3xl">
      {/* Progress */}
      <div className="mb-6 flex items-center gap-3">
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-cream-dark">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${((index + (phase === "feedback" ? 1 : 0)) / items.length) * 100}%` }}
          />
        </div>
        <span className="text-sm font-bold text-ink-muted">
          {Math.min(index + 1, items.length)}/{items.length}
        </span>
      </div>

      <div
        className="rounded-3xl border border-line p-5 text-center shadow-sm sm:p-10"
        style={surface}
      >
        {/* ——— Oral reading (READ_ALOUD / PRACTICE) ——— */}
        {isOral && (
          <>
            <p className="text-sm font-bold uppercase tracking-wide text-ink-muted">
              {t.readWordAloud}
            </p>
            <p
              className="wrap-break-word mt-6 font-bold text-ink"
              style={{ ...wordStyle, fontSize: wordSize(settings.fontSize, 1.6) }}
            >
              {item.target}
            </p>

            {phase === "item" && (
              <>
                <div className="mt-8 flex flex-col items-center gap-3">
                  <button
                    onClick={onMicPress}
                    disabled={micState === "processing" || posting}
                    aria-label={micState === "listening" ? t.tapWhenDone : t.micAria}
                    className={`flex h-24 w-24 items-center justify-center rounded-full text-white shadow-lg transition ${
                      micState === "listening"
                        ? "animate-pulse bg-red"
                        : "bg-primary hover:bg-primary-dark"
                    } disabled:opacity-70`}
                  >
                    <Mic size={40} />
                  </button>
                  <p className="text-sm font-bold text-ink-muted" aria-live="polite">
                    {micState === "listening"
                      ? t.listening
                      : micState === "processing" || posting
                        ? t.checking
                        : t.pressMic}
                  </p>
                  {micState === "listening" && (
                    <p className="text-xs font-semibold text-ink-muted">{t.tapWhenDone}</p>
                  )}
                  {micError && (
                    <p className="max-w-sm rounded-xl bg-red-soft px-4 py-2 text-sm font-bold text-red">
                      {micError}
                    </p>
                  )}
                  {scoreError && (
                    <p className="max-w-sm rounded-xl bg-orange-soft px-4 py-2 text-sm font-bold text-orange">
                      {scoreError}
                    </p>
                  )}
                </div>
                <button
                  onClick={onSkip}
                  disabled={micState !== "idle" || posting}
                  className="mt-6 text-sm font-bold text-ink-muted underline-offset-2 hover:underline"
                >
                  {t.skip}
                </button>
              </>
            )}
          </>
        )}

        {/* ——— Listen & choose ——— */}
        {type === "LISTEN_CHOOSE" && (
          <>
            <p className="text-sm font-bold uppercase tracking-wide text-ink-muted">
              {t.tapHeard}
            </p>
            <button
              onClick={sayTarget}
              aria-label={t.hearAgainAria}
              className="mt-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-peach text-peach-deep shadow-md transition hover:scale-105"
            >
              <Volume2 size={36} />
            </button>
            {phase === "item" && (
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {item.options!.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => onChoose(opt)}
                    disabled={posting}
                    className="rounded-2xl border-2 border-line bg-white px-4 py-5 font-bold text-ink transition hover:border-primary hover:bg-primary-soft"
                    style={{ ...wordStyle, fontSize: wordSize(settings.fontSize, 0.75) }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ——— Syllable counting ——— */}
        {type === "SYLLABLES" && (
          <>
            <p className="text-sm font-bold uppercase tracking-wide text-ink-muted">
              {t.howManyParts}
            </p>
            <p
              className="wrap-break-word mt-6 font-bold text-ink"
              style={{ ...wordStyle, fontSize: wordSize(settings.fontSize, 1.4) }}
            >
              {phase === "feedback" ? item.syllables : item.target}
            </p>
            <button
              onClick={speakSyllables}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-peach px-5 py-2.5 font-bold text-peach-deep transition hover:opacity-90"
            >
              <Ear size={18} /> {t.hearParts}
            </button>
            {phase === "item" && (
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {item.options!.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => onChoose(opt)}
                    disabled={posting}
                    className="h-20 w-20 rounded-2xl border-2 border-line bg-white text-3xl font-extrabold text-ink transition hover:border-primary hover:bg-primary-soft"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ——— Rhyme and sound isolation ———
             Same interaction: hear the prompt, pick the word that matches it.
             Only the question changes — rhyme asks about the ending sound,
             first-sound about the beginning. */}
        {(type === "RHYME" || type === "FIRST_SOUND") && (
          <>
            <p className="text-sm font-bold uppercase tracking-wide text-ink-muted">
              {type === "RHYME" ? t.whichRhymes : t.whichStartsSame}
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <p
                className="wrap-break-word font-bold text-ink"
                style={{ ...wordStyle, fontSize: wordSize(settings.fontSize, 1.3) }}
              >
                {item.target}
              </p>
              <button
                onClick={sayTarget}
                aria-label={t.hearAgainAria}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-peach text-peach-deep transition hover:scale-105"
              >
                <Volume2 size={22} />
              </button>
            </div>
            {phase === "item" && (
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {item.options!.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => onChoose(opt)}
                    disabled={posting}
                    className="rounded-2xl border-2 border-line bg-white px-4 py-5 font-bold text-ink transition hover:border-primary hover:bg-primary-soft"
                    style={{ ...wordStyle, fontSize: wordSize(settings.fontSize, 0.75) }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ——— Feedback ——— */}
        {phase === "feedback" && feedback && (
          <div className="mt-8" aria-live="assertive">
            {feedback.correct ? (
              <div className="mx-auto max-w-md rounded-2xl bg-green-soft px-6 py-5">
                <p className="flex items-center justify-center gap-2 text-2xl font-extrabold text-green">
                  <Check size={28} /> {t.correctFeedback}
                </p>
              </div>
            ) : (
              <div className="mx-auto max-w-md rounded-2xl bg-red-soft px-6 py-5">
                <p className="flex items-center justify-center gap-2 text-xl font-extrabold text-red">
                  <X size={24} /> {t.wrongFeedback}
                </p>
                {isOral && (
                  <p className="mt-2 text-sm font-semibold text-ink-soft">
                    {feedback.heard ? (
                      <>
                        {t.heard} <span className="font-extrabold">“{feedback.heard}”</span>
                      </>
                    ) : (
                      t.heardNothing
                    )}
                  </p>
                )}
                {type === "RHYME" && (
                  <p className="mt-2 text-sm font-semibold text-ink-soft">
                    {t.rhymeAnswer(item.answer ?? "")}
                  </p>
                )}
                {type === "FIRST_SOUND" && (
                  <p className="mt-2 text-sm font-semibold text-ink-soft">
                    {t.startsAnswer(item.answer ?? "")}
                  </p>
                )}
                {type === "LISTEN_CHOOSE" && (
                  <p className="mt-2 text-sm font-semibold text-ink-soft">
                    {t.listenAnswer(item.answer ?? "")}
                  </p>
                )}
                <p className="mt-3 text-lg font-extrabold text-ink" style={wordStyle}>
                  {item.syllables ?? item.target}
                </p>
                <button
                  onClick={sayTarget}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-ink shadow-sm transition hover:bg-cream"
                >
                  <Volume2 size={16} /> {t.hearItAgain}
                </button>
              </div>
            )}

            <button
              onClick={next}
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-8 py-3.5 text-lg font-extrabold text-white shadow-sm transition hover:bg-primary-dark"
            >
              {index + 1 < items.length ? t.next : t.finish} <ArrowRight size={20} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
