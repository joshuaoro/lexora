"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Volume2,
  Square,
  Minus,
  Plus,
  AlignJustify,
  Settings as SettingsIcon,
} from "lucide-react";
import { FONT_STACKS, OVERLAY_COLORS, type ReaderSettings } from "@/lib/settings";
import { sayWord, stopSpeaking, ttsSupported } from "@/lib/tts";
import { getDict, type Lang } from "@/lib/i18n";
import type { ReaderSet, ReaderWord } from "@/lib/reader-sets";

/** Save the reading session this long after the last word is played. */
const IDLE_FLUSH_MS = 6000;

export default function ReaderClient({
  settings,
  sets: serverSets,
  lang,
}: {
  settings: ReaderSettings;
  sets: ReaderSet[];
  lang: Lang;
}) {
  const dict = getDict(lang);
  /**
   * The word sets are shuffled on the server for every request, so any
   * router.refresh() — switching the UI language is the one a learner will hit
   * — would deal a new set while this component stays mounted, changing the
   * words mid-read and leaving the highlight on a word that has moved. Held for
   * the life of the page; a new visit brings a new mix.
   */
  const [sets] = useState(serverSets);
  const [setIndex, setSetIndex] = useState(0);
  const [customText, setCustomText] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [fontSize, setFontSize] = useState(settings.fontSize);
  const [rate, setRate] = useState(settings.ttsRate);
  const [rulerOn, setRulerOn] = useState(settings.ruler);
  const [playing, setPlaying] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [rulerY, setRulerY] = useState<number | null>(null);

  const cancelRef = useRef(false);
  const surfaceRef = useRef<HTMLDivElement>(null);

  // Reader time counts towards "minutes practiced" on the dashboard. The
  // session is created lazily on first playback and closed when the learner
  // leaves the page, so simply opening the Reader records nothing.
  const sessionIdRef = useRef<string | null>(null);
  const startedAtRef = useRef(0);
  const wordsPlayedRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // SSR assumes TTS support; the client value takes over after hydration.
  const noTts = !useSyncExternalStore(() => () => {}, ttsSupported, () => true);

  const finishSession = useCallback(() => {
    const id = sessionIdRef.current;
    if (!id || wordsPlayedRef.current === 0) return;
    const body = JSON.stringify({
      total: wordsPlayedRef.current,
      correct: 0, // the Reader is listening practice — nothing is scored
      durationMs: Math.min(3_600_000, Date.now() - startedAtRef.current),
      // There is no end to reach in the Reader: any stretch of listening is a
      // whole activity, so a flushed Reader session is a completed one.
      completed: true,
    });
    sessionIdRef.current = null;
    wordsPlayedRef.current = 0;
    // keepalive lets the request outlive the page; sendBeacon can't be used
    // here because it only ever sends POST.
    fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  }, []);

  const countWordPlayed = useCallback(() => {
    wordsPlayedRef.current += 1;

    // Save a short while after the learner stops playing words, rather than
    // waiting for the page to close. Unmounting is too late when they sign out
    // from here: the session cookie is already gone and the save would 401.
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => finishSession(), IDLE_FLUSH_MS);

    if (sessionIdRef.current) return;
    startedAtRef.current = Date.now();
    fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "READER" }),
    })
      .then((r) => r.json())
      .then((d) => {
        sessionIdRef.current = d.id ?? null;
      })
      .catch(() => {});
  }, [finishSession]);

  useEffect(() => {
    const onHide = () => finishSession();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      stopSpeaking();
      finishSession(); // backstop for a quick exit before the idle timer fires
    };
  }, [finishSession]);

  // Typed words have no stored clip, so they fall back to browser speech.
  const words: ReaderWord[] = useCustom
    ? customText
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 120)
        .map((text) => ({ id: null, text, hasAudio: false }))
    : (sets[setIndex]?.words ?? []);

  function say(w: ReaderWord) {
    countWordPlayed();
    return sayWord({
      wordId: w.id,
      hasAudio: w.hasAudio,
      text: w.text,
      rate,
      version: w.version,
    });
  }

  async function playAll() {
    if (playing) return;
    cancelRef.current = false;
    setPlaying(true);
    for (let i = 0; i < words.length; i++) {
      if (cancelRef.current) break;
      setActiveIndex(i);
      await say(words[i]);
    }
    setActiveIndex(null);
    setPlaying(false);
  }

  function stop() {
    cancelRef.current = true;
    stopSpeaking();
    setPlaying(false);
    setActiveIndex(null);
  }

  async function speakWord(i: number) {
    if (playing) return;
    setActiveIndex(i);
    await say(words[i]);
    setActiveIndex(null);
  }

  // Pointer events cover mouse, touch and stylus, so the focus ruler works on
  // tablets and phones too — not just with a mouse.
  function trackRuler(e: React.PointerEvent) {
    if (!rulerOn || !surfaceRef.current) return;
    const rect = surfaceRef.current.getBoundingClientRect();
    setRulerY(e.clientY - rect.top);
  }

  /** On touch, park the band in the middle so it is visible before any drag. */
  function centreRuler() {
    const el = surfaceRef.current;
    if (!el) return;
    setRulerY(el.getBoundingClientRect().height / 2);
  }

  const RULER_BAND = 72; // px height of the clear reading band

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-extrabold text-ink">{dict.reader.title}</h1>
      <p className="mt-1 text-sm font-semibold text-ink-muted">{dict.reader.sub}</p>

      {noTts && (
        <p className="mt-4 rounded-xl bg-orange-soft px-4 py-3 text-sm font-bold text-orange">
          {dict.common.noTts}
        </p>
      )}

      {/* Controls */}
      <div className="no-print mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm">
        <select
          aria-label={dict.reader.chooseSet}
          value={useCustom ? "custom" : String(setIndex)}
          onChange={(e) => {
            stop();
            if (e.target.value === "custom") setUseCustom(true);
            else {
              setUseCustom(false);
              setSetIndex(Number(e.target.value));
            }
          }}
          className="max-w-full rounded-xl border border-line bg-cream/60 px-3 py-2 text-sm font-bold text-ink outline-none focus:border-primary"
        >
          {sets.map((s, i) => (
            <option key={s.label} value={i}>
              {s.label}
            </option>
          ))}
          <option value="custom">{dict.reader.custom}</option>
        </select>

        {playing ? (
          <button
            onClick={stop}
            className="flex items-center gap-2 rounded-xl bg-red px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
          >
            <Square size={16} /> {dict.reader.stop}
          </button>
        ) : (
          <button
            onClick={playAll}
            disabled={words.length === 0 || noTts}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary-dark disabled:opacity-50"
          >
            <Volume2 size={16} /> {dict.reader.readToMe}
          </button>
        )}

        <label className="flex items-center gap-2 text-sm font-bold text-ink-soft">
          {dict.reader.speed}
          <input
            type="range"
            min={0.5}
            max={1.2}
            step={0.05}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="w-24 accent-primary sm:w-28"
          />
          {rate.toFixed(2)}×
        </label>

        <div className="flex items-center gap-1" role="group" aria-label={dict.settingsPage.textSize}>
          <button
            onClick={() => setFontSize((s) => Math.max(20, s - 4))}
            aria-label={dict.reader.smaller}
            className="rounded-lg border border-line bg-card p-2 text-ink transition hover:bg-cream-dark"
          >
            <Minus size={16} />
          </button>
          <span className="w-10 text-center text-sm font-bold text-ink-soft">{fontSize}px</span>
          <button
            onClick={() => setFontSize((s) => Math.min(56, s + 4))}
            aria-label={dict.reader.bigger}
            className="rounded-lg border border-line bg-card p-2 text-ink transition hover:bg-cream-dark"
          >
            <Plus size={16} />
          </button>
        </div>

        <button
          onClick={() => {
            const next = !rulerOn;
            setRulerOn(next);
            // Show the band immediately — on touch there is no hover to reveal it.
            if (next) centreRuler();
            else setRulerY(null);
          }}
          aria-pressed={rulerOn}
          className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition ${
            rulerOn
              ? "border-primary bg-primary-soft text-ink"
              : "border-line bg-card text-ink-soft hover:bg-cream-dark"
          }`}
        >
          <AlignJustify size={16} /> {dict.reader.focusRuler}
        </button>

        <Link
          href="/settings"
          className="ml-auto flex items-center gap-2 text-sm font-bold text-primary hover:underline"
        >
          <SettingsIcon size={16} /> {dict.reader.displaySettings}
        </Link>
      </div>

      {useCustom && (
        <textarea
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder={dict.reader.customPlaceholder}
          rows={3}
          className="no-print mt-4 w-full rounded-2xl border border-line bg-card p-4 text-ink outline-none focus:border-primary"
        />
      )}

      {/* Reading surface */}
      <div
        ref={surfaceRef}
        onPointerMove={trackRuler}
        onPointerDown={trackRuler}
        onPointerLeave={(e) => {
          // Keep the band in place after a touch drag; only a mouse leaving clears it.
          if (e.pointerType === "mouse") setRulerY(null);
        }}
        className={`relative mt-5 overflow-hidden rounded-3xl border border-line p-5 shadow-sm sm:p-10 ${
          rulerOn ? "touch-none" : ""
        }`}
        style={{ backgroundColor: OVERLAY_COLORS[settings.overlay] }}
      >
        {words.length === 0 ? (
          <p className="text-center text-ink-muted">{dict.reader.empty}</p>
        ) : (
          <p
            style={{
              fontFamily: FONT_STACKS[settings.font],
              fontSize: `${fontSize}px`,
              letterSpacing: `${settings.letterSpacing}em`,
              wordSpacing: `${settings.wordSpacing}em`,
              lineHeight: settings.lineHeight,
            }}
            className="wrap-break-word text-center text-ink"
          >
            {words.map((w, i) => (
              <button
                key={`${w.text}-${i}`}
                onClick={() => speakWord(i)}
                className={`mx-1 inline-block rounded-xl px-2 transition ${
                  activeIndex === i ? "bg-primary text-white" : "hover:bg-primary-soft"
                }`}
              >
                {w.text}
              </button>
            ))}
          </p>
        )}

        {/* Focus ruler overlay: dims everything except a band at the pointer */}
        {rulerOn && rulerY !== null && (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0"
              style={{ height: Math.max(0, rulerY - RULER_BAND / 2), background: "rgba(34,48,74,0.22)" }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0"
              style={{
                top: rulerY + RULER_BAND / 2,
                background: "rgba(34,48,74,0.22)",
              }}
            />
          </>
        )}
      </div>

      <p className="mt-3 text-sm font-semibold text-ink-muted">{dict.reader.tip}</p>
    </div>
  );
}
