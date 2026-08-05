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
import { sayWord, playAudioUrl, speakOnce, speakUi, stopSpeaking } from "@/lib/tts";
import { getDict, type Lang } from "@/lib/i18n";
import SpeakButton from "@/components/SpeakButton";
import LeaveGuard from "./LeaveGuard";
import { tryFetch } from "@/lib/net";
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
  items: serverItems,
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

  /**
   * The words for this run, taken once and then held.
   *
   * The server picks them at random on every request, and any router.refresh()
   * — switching the UI language mid-exercise is the obvious one — re-runs that
   * pick and hands this component a different set. React keeps the component
   * mounted, so the run's own state survives while the words underneath it
   * change: the child ends up staring at feedback for a word that is no longer
   * on screen, and the next answer is recorded against a word they never saw.
   *
   * Language is a property of the interface; the words are a property of the
   * run. Fresh ones are adopted only when a new run starts.
   */
  const [items, setItems] = useState(serverItems);

  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [leveledUp, setLeveledUp] = useState(false);
  const [posting, setPosting] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
  /**
   * The corrective re-read offered after a missed word: "offered" until the
   * child takes it, then the outcome. It is deliberately kept out of `results`
   * — the score for the item is the first reading, and a retry taken straight
   * after hearing the word is repetition rather than decoding.
   */
  const [retry, setRetry] = useState<"offered" | "correct" | "incorrect" | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const sessionStartRef = useRef(0);
  const itemStartRef = useRef(0);
  /**
   * Running tally, kept in a ref so the flush on the way out can read it
   * without the effect re-subscribing after every answer.
   */
  const answeredRef = useRef({ total: 0, correct: 0 });

  const {
    state: micState,
    supported: micOk,
    micError,
    start: listen,
    stopListening,
  } = useOralReading();

  const item = items[index];
  /**
   * The decoding probe is spoken like a read-aloud, and scored like nothing
   * else in the app.
   *
   * Its words are non-words, so there is no verdict to show the child: the
   * recogniser cannot spell a word that does not exist, and a reading
   * specialist marks the recording afterwards. Which also means no correction —
   * modelling the "right" pronunciation of a probe item would teach it, and a
   * probe item the child has been taught has stopped being one.
   *
   * The child is simply told they read it, and moved on. For a seven-year-old
   * being assessed, that is also kinder than eight rounds of ambiguous feedback.
   */
  const isProbe = type === "PSEUDO_PROBE";
  const isOral = type === "READ_ALOUD" || type === "PRACTICE" || isProbe;
  const intro = t.intro[type];

  /**
   * Save what the learner has done so far.
   *
   * Totals used to be written only on the final screen, so a child who did five
   * words and went back to the dashboard had their minutes discarded — the
   * words and accuracy survived, because attempts are saved one by one, but the
   * time did not. The Reader has always flushed on the way out; exercises now
   * do the same, and the activity is marked completed only when it really is.
   */
  const flushProgress = useCallback((completed: boolean) => {
    const id = sessionIdRef.current;
    const { total, correct } = answeredRef.current;
    if (!id || total === 0) return Promise.resolve();
    if (completed) sessionIdRef.current = null; // nothing more to send
    // keepalive lets the request outlive the page; sendBeacon only sends POST.
    // The caller awaits this when finishing, so the refresh that follows reads
    // the totals that were just written rather than the previous ones.
    return fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        total,
        correct,
        durationMs: Math.min(3_600_000, now() - sessionStartRef.current),
        completed,
      }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    // pagehide covers closing the tab; the cleanup covers navigating away
    // inside the app, which fires no page event at all.
    const onHide = () => flushProgress(false);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      stopSpeaking();
      flushProgress(false);
    };
  }, [flushProgress]);

  const beginItem = useCallback(
    // `list` is passed explicitly when a new run starts, because the state
    // holding the previous run's words has not been applied yet at that point.
    (i: number, list: ExerciseItem[] = items) => {
      setIndex(i);
      setFeedback(null);
      setRetry(null);
      setPhase("item");
      itemStartRef.current = now();
      const next = list[i];
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
    setScoreError(null);
    const res = await tryFetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    // No connection: stay on the intro so the Start button is still there.
    if (!res) {
      setScoreError(t.offline);
      return;
    }
    if (res.status === 401) {
      router.push("/login?expired=1");
      return;
    }
    const data = await res.json().catch(() => ({}));
    sessionIdRef.current = data.id ?? null;
    sessionStartRef.current = now();
    answeredRef.current = { total: 0, correct: 0 };
    setResults([]);
    setLeveledUp(false);
    // Adopt whatever the server last sent — a replay should not repeat the
    // same eight words — and start on those rather than the previous run's.
    setItems(serverItems);
    beginItem(0, serverItems);

    // Say what to do, once. This runs on the Start press, so the browser's
    // autoplay rules are satisfied — a child who cannot read the instruction
    // now hears it without having to know to ask for it. Only for the spoken
    // activities: the receptive ones play the target word by themselves, and
    // two voices at once helps nobody.
    if (isOral) speakUi(intro.how, lang, settings.ttsRate);
  }

  async function submitAttempt(payload: {
    transcript?: string | null;
    browserTranscript?: string | null;
    choiceCorrect?: boolean;
    chosen?: string | null;
    audio?: string | null;
    isRetry?: boolean;
  }) {
    setPosting(true);
    setScoreError(null);
    const res = await tryFetch("/api/attempts", {
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
        isRetry: payload.isRetry ?? false,
      }),
    });
    // The connection dropped. Nothing was recorded, so clear the busy state and
    // say so — the child can read the word again once the wifi is back. Leaving
    // this unhandled is what froze the screen on "Checking…".
    if (!res) {
      setPosting(false);
      setScoreError(t.offline);
      return;
    }

    const data = await res.json().catch(() => ({}));
    setPosting(false);

    // The record this session belongs to is gone — signing in again is the
    // only way forward, and it beats retrying a microphone that works.
    if (res.status === 401) {
      router.push("/login?expired=1");
      return;
    }
    // No recognizer could score the recording — nothing was saved, let them retry.
    if (!res.ok) {
      setScoreError(t.scoringUnavailable);
      return;
    }

    const correct: boolean = Boolean(data.correct);

    // A re-read never changes the item's score, the level, or the run of
    // results — it exists so the child's last go at the word is a correct one.
    if (payload.isRetry) {
      setRetry(correct ? "correct" : "incorrect");
      playChime(correct);
      return;
    }

    // The probe records the reading and acknowledges it. No verdict is shown
    // because none has been reached — the specialist reaches it later, from the
    // recording. `results` still gets an entry so the progress bar and the
    // item count stay honest about how many words were read.
    if (isProbe) {
      answeredRef.current = {
        total: answeredRef.current.total + 1,
        correct: answeredRef.current.correct,
      };
      setResults((r) => [...r, true]);
      setFeedback({ correct: true, heard: null, chosen: null });
      setPhase("feedback");
      playChime(true);
      return;
    }

    if (data.levelChanged === "up") setLeveledUp(true);
    answeredRef.current = {
      total: answeredRef.current.total + 1,
      correct: answeredRef.current.correct + (correct ? 1 : 0),
    };
    setResults((r) => [...r, correct]);
    setFeedback({ correct, heard: data.heard || null, chosen: payload.chosen ?? null });
    setPhase("feedback");
    playChime(correct);
    if (!correct) {
      // Immediate corrective feedback: hear the right word, then take a turn.
      setTimeout(() => sayTarget(), 700);
      if (isOral && micOk) setRetry("offered");
    }
  }

  /**
   * "Now you try" — the closing step of the corrective sequence. Without it the
   * child's last spoken version of a word they missed is the wrong one, which
   * is the production that sticks.
   */
  async function onRetryPress() {
    if (micState === "listening") {
      stopListening();
      return;
    }
    if (micState !== "idle" || posting) return;
    stopSpeaking();
    const { audio, browserTranscript } = await listen(item.target);
    await submitAttempt({ audio, browserTranscript, isRetry: true });
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
    await flushProgress(true);
    setPhase("done");
    // Refresh so the dashboard and the next run pick up what just happened —
    // the words for this run are already held in state and won't be disturbed.
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
        {/* The instructions above are text, aimed at children who struggle to
            decode text. This reads them out. */}
        <div className="mt-5 flex justify-center">
          <SpeakButton
            text={`${intro.blurb} ${intro.how}`}
            lang={lang}
            rate={settings.ttsRate}
            label={t.listen}
          />
        </div>

        {isOral && !micOk && (
          <p className="mt-4 rounded-xl bg-orange-soft px-4 py-3 text-sm font-bold text-orange">
            {dict.common.noMic}
          </p>
        )}
        {scoreError && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-orange-soft px-4 py-3 text-sm font-bold text-orange"
          >
            {scoreError}
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

  if (phase === "done" && isProbe) {
    // No stars and no score. Nothing has been marked yet, and inventing a
    // number the specialist may contradict tomorrow would be dishonest to the
    // child and useless to the study.
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-line bg-card p-6 text-center shadow-sm sm:p-10">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Check size={44} />
        </div>
        <h1 className="mt-4 text-3xl font-extrabold text-ink">{t.probeDoneTitle}</h1>
        <p className="mt-2 text-lg font-semibold text-ink-soft">
          {t.probeDoneBody(results.length)}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/exercises"
            className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-white transition hover:bg-primary-dark"
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
      {/* Only while a round is genuinely underway — not on the intro or the
          results screen, where leaving costs nothing. */}
      <LeaveGuard
        active={phase === "item" || phase === "feedback"}
        lang={lang}
        rate={settings.ttsRate}
        strings={{
          title: t.leaveTitle,
          body: t.leaveBody,
          stay: t.leaveStay,
          leave: t.leaveGo,
        }}
      />
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

      {/* A dropped connection can happen in any activity, not just the spoken
          ones, so the notice sits above the card rather than inside the oral
          branch. Nothing was recorded when this shows — answering again is safe. */}
      {scoreError && !isOral && (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-orange-soft px-4 py-3 text-center text-sm font-bold text-orange"
        >
          {scoreError}
        </p>
      )}

      <div
        className="rounded-3xl border border-line p-5 text-center shadow-sm sm:p-10"
        style={surface}
      >
        {/* ——— Oral reading (READ_ALOUD / PRACTICE) ——— */}
        {isOral && (
          <>
            <div className="flex items-center justify-center gap-2">
              <p className="text-sm font-bold uppercase tracking-wide text-ink-muted">
                {t.readWordAloud}
              </p>
              <SpeakButton text={intro.how} lang={lang} rate={settings.ttsRate} size="sm" />
            </div>
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
            <div className="flex items-center justify-center gap-2">
              <p className="text-sm font-bold uppercase tracking-wide text-ink-muted">
                {t.tapHeard}
              </p>
              <SpeakButton text={intro.how} lang={lang} rate={settings.ttsRate} size="sm" />
            </div>
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
            <div className="flex items-center justify-center gap-2">
              <p className="text-sm font-bold uppercase tracking-wide text-ink-muted">
                {t.howManyParts}
              </p>
              <SpeakButton text={intro.how} lang={lang} rate={settings.ttsRate} size="sm" />
            </div>
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
            <div className="flex items-center justify-center gap-2">
              <p className="text-sm font-bold uppercase tracking-wide text-ink-muted">
                {type === "RHYME" ? t.whichRhymes : t.whichStartsSame}
              </p>
              <SpeakButton text={intro.how} lang={lang} rate={settings.ttsRate} size="sm" />
            </div>
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
        {phase === "feedback" && feedback && isProbe && (
          <div className="mt-8" aria-live="polite">
            <div className="mx-auto max-w-md rounded-2xl bg-primary-soft px-6 py-5">
              <p className="flex items-center justify-center gap-2 text-2xl font-extrabold text-primary">
                <Check size={28} /> {t.probeRecorded}
              </p>
            </div>
            <button
              onClick={next}
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-8 py-3.5 text-lg font-extrabold text-white shadow-sm transition hover:bg-primary-dark"
            >
              {index + 1 < items.length ? t.next : t.finish} <ArrowRight size={20} />
            </button>
          </div>
        )}

        {phase === "feedback" && feedback && !isProbe && (
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

                {/* "Now you try" — closes the corrective sequence so the last
                    time the child says this word, they say it right. */}
                {retry === "offered" && (
                  <div className="mt-4 border-t border-red/20 pt-4">
                    <p className="text-sm font-extrabold text-ink">{t.nowYouTry}</p>
                    <button
                      onClick={onRetryPress}
                      disabled={posting}
                      className={`mt-2 inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-base font-extrabold text-white shadow-sm transition disabled:opacity-60 ${
                        micState === "listening"
                          ? "animate-pulse bg-red"
                          : "bg-primary hover:bg-primary-dark"
                      }`}
                    >
                      <Mic size={20} />
                      {micState === "listening" ? t.tapWhenDone : t.tryItNow}
                    </button>
                  </div>
                )}

                {retry === "correct" && (
                  <p className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-green-soft px-4 py-3 text-base font-extrabold text-green">
                    <Check size={20} /> {t.retryGood}
                  </p>
                )}

                {retry === "incorrect" && (
                  <p className="mt-4 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-ink-soft">
                    {t.retryKeepGoing}
                  </p>
                )}
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
