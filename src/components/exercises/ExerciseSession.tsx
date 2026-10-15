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
import {
  sayWord,
  playAudioUrl,
  speakSyllables as speakParts,
  speakSwap,
  speakModel,
  speakUi,
  stopSpeaking,
} from "@/lib/tts";
import { getDict, type Lang } from "@/lib/i18n";
import SpeakButton from "@/components/SpeakButton";
import LeaveGuard from "./LeaveGuard";
import SyllableCount from "./SyllableCount";
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

/**
 * Play a word in parts.
 *
 * A specialist's own recording of the parts is played as recorded — they pause
 * the way they teach. Otherwise each syllable is its own neural clip with a
 * real pause between them (see speakSyllables in src/lib/tts.ts for why the
 * single generated clip is no longer used).
 *
 * Module scope, and handed the item, because starting an item has to play the
 * parts of the item about to be shown — not the one still in state.
 */
async function playParts(it: ExerciseItem, rate: number) {
  if (it.wordId && it.hasSyllHuman) {
    await playAudioUrl(`/api/word-audio/${it.wordId}?kind=syll&v=${it.audioVersion}`, Math.max(0.6, rate + 0.15));
    return;
  }
  // A lone vowel comes from the specialist's recording of it (partClips).
  await speakParts((it.syllables ?? it.target).split("-"), rate, it.partClips);
}

/** The Change the sound prompt: the word, then the sound out, then the sound in. */
function playSwapPrompt(swap: NonNullable<ExerciseItem["swap"]>, rate: number) {
  return speakSwap(
    {
      wordId: swap.fromWordId,
      hasAudio: swap.fromHasAudio,
      text: swap.fromText,
      version: swap.fromVersion,
    },
    swap.fromSound,
    swap.toSound,
    rate
  );
}

/** The longest the mic waits for a model to finish playing (spec 2026-10-16). */
const MODEL_CAP_MS = 8000;

/** The longest a Practice run's first prompt waits for the spoken instruction, should its clip stall. */
const INSTRUCTION_WAIT_MS = 15000;

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
  /**
   * True while LEXORA is modeling a word. The mic waits for it, so a child who
   * presses early does not record the app's own voice, and never waits longer
   * than MODEL_CAP_MS, so a clip that fails to load cannot trap them.
   */
  const [modelPlaying, setModelPlaying] = useState(false);
  const modelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Advanced by every prompt scheduled or played, every new item and every mic
   * press. A model releases the mic, and a waiting prompt starts, only if
   * nothing has advanced it since: a model cut by a newer one would otherwise
   * free the mic while the newer one is still speaking.
   */
  const modelGen = useRef(0);
  /** Practice: what the server recorded for this reading (lesson, or a check's progress). */
  const [practiceResult, setPracticeResult] = useState<{
    mode: "lesson" | "check";
    streak: number;
    mastered: boolean;
  } | null>(null);

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

  /**
   * Model a word: a lesson ends with "Ikaw naman!", a correction ends on the
   * word, a confirmation starts "Tama!". `tail` replaces the closing phrase.
   */
  const playModel = useCallback(
    async (it: ExerciseItem, kind: "lesson" | "correction" | "confirm", tail?: string) => {
      const mine = ++modelGen.current;
      setModelPlaying(true);
      await Promise.race([
        speakModel(
          { wordId: it.wordId, hasAudio: it.hasAudio, text: it.target, version: it.audioVersion },
          kind === "confirm" ? t.modelConfirm : t.modelLead,
          lang,
          settings.ttsRate,
          tail ?? (kind === "lesson" ? t.modelYourTurn : undefined)
        ),
        new Promise((r) => setTimeout(r, MODEL_CAP_MS)),
      ]);
      // Cut short by a newer model, the next item or the mic: the hold is theirs now.
      if (modelGen.current === mine) setModelPlaying(false);
    },
    [t, lang, settings.ttsRate]
  );

  /**
   * Run a spoken prompt after `delayMs`, counted from the end of `after` (the
   * instruction spoken on Start) when given — unless the child or a newer
   * prompt has moved on by then.
   */
  const schedulePrompt = useCallback((run: () => void, delayMs: number, after?: Promise<unknown>) => {
    if (modelTimer.current) clearTimeout(modelTimer.current);
    const mine = ++modelGen.current;
    const start = () => {
      if (modelGen.current === mine) modelTimer.current = setTimeout(run, delayMs);
    };
    if (after) void Promise.race([after, new Promise((r) => setTimeout(r, INSTRUCTION_WAIT_MS))]).then(start);
    else start();
  }, []);

  /** Start a model after `delayMs`, holding the mic from now so it cannot be pressed in the gap. */
  const scheduleModel = useCallback(
    (
      it: ExerciseItem,
      kind: "lesson" | "correction" | "confirm",
      delayMs: number,
      tail?: string,
      after?: Promise<unknown>
    ) => {
      setModelPlaying(true);
      schedulePrompt(() => void playModel(it, kind, tail), delayMs, after);
    },
    [playModel, schedulePrompt]
  );

  const beginItem = useCallback(
    // `list` is passed explicitly when a new run starts, because the state
    // holding the previous run's words has not been applied yet at that point.
    // `after` is the instruction spoken on Start, which Practice's first prompt
    // waits for: started together, the model cut the instruction short.
    (i: number, list: ExerciseItem[] = items, after?: Promise<unknown>) => {
      setIndex(i);
      setFeedback(null);
      setRetry(null);
      setPracticeResult(null);
      if (modelTimer.current) clearTimeout(modelTimer.current);
      modelGen.current++;
      setModelPlaying(false);
      setPhase("item");
      itemStartRef.current = now();
      const next = list[i];
      // Blending plays the word in parts and never whole — hearing it whole
      // first would leave nothing to blend.
      if (next && type === "BLEND") {
        setTimeout(() => void playParts(next, settings.ttsRate), 350);
      }
      // Change the sound plays its whole prompt: the word, then the two sounds.
      if (next?.swap && type === "CHANGE_SOUND") {
        const swap = next.swap;
        setTimeout(() => void playSwapPrompt(swap, settings.ttsRate), 350);
      }
      // Receptive activities speak the target automatically. Count the
      // syllables too: its word is heard, never shown, while the question is
      // open (the reading specialist's consultation, 16 October).
      if (
        next &&
        (type === "LISTEN_CHOOSE" || type === "RHYME" || type === "FIRST_SOUND" || type === "SYLLABLES")
      ) {
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
      // Practice: a lesson models the word first; a check asks the child to
      // read it alone (spec 2026-10-16, §3).
      if (next?.practice && type === "PRACTICE") {
        if (next.practice.mode === "lesson") scheduleModel(next, "lesson", 350, undefined, after);
        else schedulePrompt(() => void speakUi(t.checkFirst, lang, settings.ttsRate), 350, after);
      }
    },
    [items, type, settings.ttsRate, scheduleModel, schedulePrompt, lang, t.checkFirst]
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

    // Say what to do, once. This runs on the Start press, so the browser's
    // autoplay rules are satisfied — a child who cannot read the instruction
    // now hears it without having to know to ask for it. Only for the spoken
    // activities: the receptive ones play the target word by themselves, and
    // two voices at once helps nobody. Practice's first model or prompt waits
    // for it to finish.
    const instruction = isOral ? speakUi(intro.how, lang, settings.ttsRate) : undefined;
    beginItem(0, serverItems, instruction);
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
      void flushProgress(false);
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
    // Saved after every answer, not only on the way out. The exit flush cannot
    // cover every exit: signing out from the sidebar clears the session cookie
    // before this screen unmounts, so its last save was refused and the
    // activity's minutes were lost — on a tablet shared by several children,
    // the ordinary way a turn ends. The server ignores a save older than the
    // one it already holds, so these may arrive in any order.
    void flushProgress(false);
    setResults((r) => [...r, correct]);
    setFeedback({ correct, heard: data.heard || null, chosen: payload.chosen ?? null });
    if (data.practice) setPracticeResult(data.practice);
    setPhase("feedback");
    playChime(correct);
    if (isOral) {
      // The model always follows the child's own reading (spec 2026-10-16):
      // "Ang salitang ito ay bahay" after a miss, "Tama! bahay" after a correct
      // Read aloud reading or a correct practice check.
      if (!correct) {
        scheduleModel(item, "correction", 700);
        if (micOk) setRetry("offered");
      } else if (type === "READ_ALOUD" || data.practice?.mode === "check") {
        // The second correct check ends with "Natutunan mo na!".
        scheduleModel(item, "confirm", 700, data.practice?.mastered ? t.learnedIt : undefined);
      }
    } else if (!correct && type !== "SYLLABLES") {
      // Count the syllables plays its parts instead (SyllableCount).
      setTimeout(() => sayTarget(), 700);
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
    if (micState !== "idle" || posting || modelPlaying) return;
    stopSpeaking();
    const { audio, browserTranscript } = await listen();
    await submitAttempt({ audio, browserTranscript, isRetry: true });
  }

  async function onMicPress() {
    // Tapping while listening ends the take early; recording otherwise
    // stops itself after the child finishes speaking.
    if (micState === "listening") {
      stopListening();
      return;
    }
    if (micState !== "idle" || posting || modelPlaying) return;
    setScoreError(null);
    // Silence the app before the take, and cancel a prompt still waiting to
    // start, so its voice is never recorded into the child's reading.
    if (modelTimer.current) clearTimeout(modelTimer.current);
    modelGen.current++;
    stopSpeaking();
    const { audio, browserTranscript } = await listen();
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
    if (modelTimer.current) clearTimeout(modelTimer.current);
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

  function speakSyllables() {
    return playParts(item, settings.ttsRate);
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
          {type === "PRACTICE"
            ? t.emptyPractice
            : type === "CHANGE_SOUND"
              ? t.emptyChangeSound
              : t.emptyGeneric}
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
        {type === "PRACTICE" && items.length > 0 && items.every((i) => i.practice?.seenToday) && (
          <p className="mt-3 rounded-xl bg-primary-soft px-4 py-2.5 text-sm font-bold text-primary">
            {t.tomorrowAlone}
          </p>
        )}
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
            {/* Practice says which kind of turn this is (spec 2026-10-16):
                listen to LEXORA first, or read it on your own first. */}
            {type === "PRACTICE" && item.practice && (
              <p
                className={`mx-auto mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-extrabold ${
                  item.practice.mode === "lesson" ? "bg-peach-soft text-peach-deep" : "bg-primary-soft text-primary"
                }`}
              >
                {item.practice.mode === "lesson" ? <Ear size={16} /> : <Mic size={16} />}
                {item.practice.mode === "lesson" ? t.listenFirst : t.youFirst}
              </p>
            )}
            <div className="flex items-center justify-center gap-2">
              <p className="text-sm font-bold uppercase tracking-wide text-ink-muted">
                {type === "PRACTICE" && item.practice?.mode === "check" ? t.checkFirst : t.readWordAloud}
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
                    disabled={micState === "processing" || posting || modelPlaying}
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

        {/* ——— Syllable blending ———
             The parts are heard, never printed: shown "ba-ta", the child could
             read the answer off the screen instead of putting the sounds
             together. The split appears in the feedback, after the answer. */}
        {type === "BLEND" && (
          <>
            <div className="flex items-center justify-center gap-2">
              <p className="text-sm font-bold uppercase tracking-wide text-ink-muted">
                {t.whichWordParts}
              </p>
              <SpeakButton text={intro.how} lang={lang} rate={settings.ttsRate} size="sm" />
            </div>
            <button
              onClick={speakSyllables}
              aria-label={t.hearPartsAgainAria}
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

        {/* ——— Change the sound ———
             Heard, not read: the word and both sounds are speakers, never
             letters. Shown "bata" and "b → m", a child could swap letters on the
             screen — phonics, which Read aloud already practises — instead of
             swapping sounds. */}
        {type === "CHANGE_SOUND" && item.swap && (
          <>
            <div className="flex items-center justify-center gap-2">
              <p className="text-sm font-bold uppercase tracking-wide text-ink-muted">
                {t.changeQuestion}
              </p>
              <SpeakButton text={intro.how} lang={lang} rate={settings.ttsRate} size="sm" />
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-5">
              <button
                onClick={() => playSwapPrompt(item.swap!, settings.ttsRate)}
                aria-label={t.hearWordAria}
                className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-peach text-peach-deep shadow-md transition hover:scale-105"
              >
                <Volume2 size={36} />
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void playAudioUrl(item.swap!.fromSound, settings.ttsRate)}
                  aria-label={t.hearFromSoundAria}
                  className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-soft text-red transition hover:scale-105"
                >
                  <Volume2 size={24} />
                </button>
                <ArrowRight size={24} className="text-ink-muted" aria-hidden />
                <button
                  onClick={() => void playAudioUrl(item.swap!.toSound, settings.ttsRate)}
                  aria-label={t.hearToSoundAria}
                  className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-soft text-green transition hover:scale-105"
                >
                  <Volume2 size={24} />
                </button>
              </div>
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

        {/* ——— Syllable counting ———
             Heard, not read, while the question is open (the reading
             specialist's consultation, 16 October): a printed word turns a
             listening task into a reading one, and hearing it in parts would
             give the count away. Once answered, SyllableCount counts it with
             the child, clap by clap. */}
        {type === "SYLLABLES" && (
          <>
            <div className="flex items-center justify-center gap-2">
              <p className="text-sm font-bold uppercase tracking-wide text-ink-muted">
                {t.howManyParts}
              </p>
              <SpeakButton text={intro.how} lang={lang} rate={settings.ttsRate} size="sm" />
            </div>
            {phase === "item" ? (
              <button
                onClick={sayTarget}
                aria-label={t.hearAgainAria}
                className="mt-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-peach text-peach-deep shadow-md transition hover:scale-105"
              >
                <Volume2 size={36} />
              </button>
            ) : (
              <SyllableCount
                key={index}
                syllables={item.syllables ?? item.target}
                clips={item.partClips}
                rate={settings.ttsRate}
                wordStyle={wordStyle}
                labels={{ total: t.partsCount, again: t.countAgain, groupAria: t.countingAria }}
              />
            )}
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
             first-sound about the beginning. The prompt word is heard, not
             shown, until it is answered (the reading specialist's
             consultation, 16 October); the choices stay printed. */}
        {(type === "RHYME" || type === "FIRST_SOUND") && (
          <>
            <div className="flex items-center justify-center gap-2">
              <p className="text-sm font-bold uppercase tracking-wide text-ink-muted">
                {type === "RHYME" ? t.whichRhymes : t.whichStartsSame}
              </p>
              <SpeakButton text={intro.how} lang={lang} rate={settings.ttsRate} size="sm" />
            </div>
            {phase === "item" ? (
              <button
                onClick={sayTarget}
                aria-label={t.hearAgainAria}
                className="mt-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-peach text-peach-deep shadow-md transition hover:scale-105"
              >
                <Volume2 size={36} />
              </button>
            ) : (
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
            )}
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
                {practiceResult?.mode === "check" && (
                  <p className="mt-2 text-base font-extrabold text-ink">
                    {practiceResult.mastered ? `${t.learnedIt} 🎉` : t.checkProgress(practiceResult.streak)}
                  </p>
                )}
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
                {type === "BLEND" && (
                  <p className="mt-2 text-sm font-semibold text-ink-soft">
                    {t.blendAnswer(item.answer ?? "")}
                  </p>
                )}
                {type === "CHANGE_SOUND" && item.swap && (
                  <p className="mt-2 text-sm font-semibold text-ink-soft">
                    {t.changeAnswer(item.swap.fromText, item.answer ?? "")}
                  </p>
                )}
                {/* The listening activities reveal the word above once it is
                    answered, with its own speaker (or, for syllables, the count
                    and its replay), so it is not repeated here. */}
                {type !== "SYLLABLES" && type !== "RHYME" && type !== "FIRST_SOUND" && (
                  <>
                    <p className="mt-3 text-lg font-extrabold text-ink" style={wordStyle}>
                      {item.syllables ?? item.target}
                    </p>
                    {/* Held while the re-read records or is being scored: the
                        model would be spoken into the child's take. */}
                    <button
                      onClick={isOral ? () => void playModel(item, "correction") : sayTarget}
                      disabled={isOral && (micState !== "idle" || posting)}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-ink shadow-sm transition hover:bg-cream disabled:opacity-60"
                    >
                      <Volume2 size={16} /> {t.hearItAgain}
                    </button>
                  </>
                )}

                {/* "Ikaw naman!" — closes the corrective sequence so the last
                    time the child says this word, they say it right. Held while
                    the model plays, so the take cannot record the app's voice. */}
                {retry === "offered" && (
                  <div className="mt-4 border-t border-red/20 pt-4">
                    <p className="text-sm font-extrabold text-ink">{t.nowYouTry}</p>
                    <button
                      onClick={onRetryPress}
                      disabled={posting || modelPlaying}
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
