"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Volume2, Mic, Square, Trash2, Sparkles, Play, Check, X } from "lucide-react";
import { STAGE_LETTERS, stageForWord } from "@/lib/marungko";
import { playAudioUrl, speakOnce, stopSpeaking } from "@/lib/tts";
import { tryFetch } from "@/lib/net";
import { getDict, type Lang } from "@/lib/i18n";

type WordRow = {
  id: string;
  text: string;
  syllables: string;
  pattern: string;
  stage: number;
  level: number;
  meaningEn: string | null;
  variants: string;
  audioVersion: number;
  hasTts: boolean;
  hasHuman: boolean;
  /** A probe non-word: never shown in practice, never given audio. */
  isPseudo: boolean;
  /** Set when the word's meaning turns on stress the spelling does not mark. */
  stressNote: string | null;
};

type Draft = { wordId: string; kind: "word" | "syll"; audio: string; url: string };

const EMPTY_FORM = {
  text: "",
  syllables: "",
  pattern: "",
  level: 1,
  meaningEn: "",
  isPseudo: false,
};
const MAX_RECORD_MS = 6000;

export default function WordBankClient({ words, lang = "en" }: { words: WordRow[]; lang?: Lang }) {
  const t = getDict(lang).wordBankPage;
  const router = useRouter();
  const [stageFilter, setStageFilter] = useState<number | 0>(0);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  // What the server will store, shown as the specialist types.
  const derivedStage = useMemo(() => {
    const text = form.text.trim().toLowerCase();
    if (!/^[a-zñ-]+$/.test(text)) return null;
    try {
      return stageForWord(text);
    } catch {
      return null;
    }
  }, [form.text]);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState<{ id: string; kind: "word" | "syll" } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingVariants, setEditingVariants] = useState<string | null>(null);
  const [variantDraft, setVariantDraft] = useState("");
  const [candidates, setCandidates] = useState<
    { text: string; syllables: string; pattern: string; level: number }[]
  >([]);
  const [suggestStage, setSuggestStage] = useState(4);
  const [suggesting, setSuggesting] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);

  /**
   * Ask the server for candidate non-words.
   *
   * These are letter combinations that obey Filipino syllable shape and the
   * Marungko sequence — nothing more. Whether a candidate is actually a
   * non-word is a judgement only a person who speaks Tagalog and Cebuano can
   * make, so nothing is saved until the specialist picks one and submits it.
   */
  async function suggest() {
    setSuggesting(true);
    setMessage(null);
    const res = await tryFetch(`/api/words/suggest?stage=${suggestStage}`);
    const data = (await res?.json().catch(() => ({}))) ?? {};
    setSuggesting(false);
    if (!res?.ok) {
      setMessage(res ? t.suggestFailed : t.offlineRetry);
      return;
    }
    setCandidates(data.candidates ?? []);
    if ((data.candidates ?? []).length === 0) {
      setMessage(t.noCombinations(suggestStage));
    }
  }

  const filtered = useMemo(
    () =>
      words.filter(
        (w) =>
          (stageFilter === 0 || w.stage === stageFilter) &&
          (query === "" || w.text.includes(query.toLowerCase()))
      ),
    [words, stageFilter, query]
  );

  // Probe non-words are excluded from both counts. They are deliberately left
  // without audio, so counting them as "still need pronunciation" would show a
  // warning that can never be cleared and would invite someone to clear it —
  // which would break the probe.
  const realWords = words.filter((w) => !w.isPseudo);
  const probeWords = words.length - realWords.length;
  const missingAudio = realWords.filter((w) => !w.hasTts && !w.hasHuman).length;

  /** Play the clip actually used by learners (specialist voice wins). */
  function preview(w: WordRow, kind: "word" | "syll" = "word") {
    stopSpeaking();
    if (!w.hasTts && !w.hasHuman) {
      speakOnce(kind === "syll" ? w.syllables.split("-").join(", ") : w.text, 0.85);
      return;
    }
    // audioVersion busts any cached copy after a re-record.
    playAudioUrl(`/api/word-audio/${w.id}?kind=${kind}&v=${w.audioVersion}`, 1);
  }

  async function addWord(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await tryFetch("/api/words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        level: Number(form.level),
        meaningEn: form.isPseudo ? undefined : form.meaningEn || undefined,
        isPseudo: form.isPseudo,
      }),
    });
    const data = (await res?.json().catch(() => ({}))) ?? {};
    if (!res?.ok) {
      setBusy(false);
      setMessage(res ? (data.error ?? t.addFailed) : t.offlineRetry);
      return;
    }

    // A probe word is deliberately left silent. Generating audio for it would
    // let a child press listen and be handed the answer, which is the one thing
    // that stops it being a probe.
    if (form.isPseudo) {
      setBusy(false);
      setMessage(t.addedProbe(data.text));
      setForm(EMPTY_FORM);
      router.refresh();
      return;
    }

    // Give the new word a pronunciation immediately — otherwise learners would
    // hear it read with English phonics.
    setMessage(t.addedGenerating(data.text));
    const gen = await tryFetch(`/api/words/${data.id}/audio/generate`, { method: "POST" });
    setBusy(false);
    setMessage(
      gen?.ok ? t.addedWithAudio(data.text) : t.addedAudioFailed(data.text)
    );
    setForm(EMPTY_FORM);
    router.refresh();
  }

  /** (Re)generate the neural Filipino clip for one word. */
  async function generateAudio(word: WordRow) {
    setBusyId(word.id);
    setMessage(null);
    const res = await tryFetch(`/api/words/${word.id}/audio/generate`, { method: "POST" });
    const data = (await res?.json().catch(() => ({}))) ?? {};
    setBusyId(null);
    setMessage(
      res?.ok
        ? t.generated(word.text)
        : res
          ? (data.error ?? t.generateFailed)
          : t.offlineRetry
    );
    if (res?.ok) router.refresh();
  }

  /** Start/stop recording the specialist's own voice. Result goes to a preview. */
  async function toggleRecord(word: WordRow, kind: "word" | "syll") {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    setMessage(null);
    setDraft(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMessage(t.micBlocked);
      return;
    }

    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      recorderRef.current = null;
      setRecording(null);

      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      if (blob.size === 0) {
        setMessage(t.nothingRecorded);
        return;
      }
      const audio = await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
      if (!audio) {
        setMessage(t.readFailed);
        return;
      }
      // Hold it for review instead of saving blind.
      setDraft({ wordId: word.id, kind, audio, url: URL.createObjectURL(blob) });
    };

    setRecording({ id: word.id, kind });
    recorder.start();
    setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
    }, MAX_RECORD_MS);
  }

  async function saveDraft(word: WordRow) {
    if (!draft) return;
    setBusyId(word.id);
    const res = await tryFetch(`/api/words/${word.id}/audio`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: draft.kind, audio: draft.audio }),
    });
    const data = (await res?.json().catch(() => ({}))) ?? {};
    setBusyId(null);
    if (!res?.ok) {
      setMessage(res ? (data.error ?? t.saveRecordingFailed) : t.offlineRetry);
      return;
    }
    URL.revokeObjectURL(draft.url);
    setDraft(null);
    setMessage(t.savedVoice(word.text));
    router.refresh();
  }

  function discardDraft() {
    if (draft) URL.revokeObjectURL(draft.url);
    setDraft(null);
  }

  async function removeRecording(word: WordRow) {
    setBusyId(word.id);
    const res = await tryFetch(`/api/words/${word.id}/audio`, { method: "DELETE" });
    setBusyId(null);
    // Reported the removal whether or not it happened. A specialist who deletes
    // a recording they are unhappy with, is told it is gone, and then hears it
    // played to a child has been lied to by the interface.
    if (!res?.ok) {
      setMessage(
        res ? t.removeFailed(word.text) : t.offlineRetry
      );
      return;
    }
    setMessage(t.removed(word.text));
    router.refresh();
  }

  async function saveVariants(word: WordRow) {
    setBusyId(word.id);
    const res = await tryFetch(`/api/words/${word.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variants: variantDraft }),
    });
    const data = (await res?.json().catch(() => ({}))) ?? {};
    setBusyId(null);
    if (!res?.ok) {
      setMessage(res ? (data.error ?? t.saveFailed) : t.offlineRetry);
      return;
    }
    setEditingVariants(null);
    setMessage(t.spellingsUpdated(word.text));
    router.refresh();
  }

  const input =
    "rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-primary";
  const iconBtn =
    "flex h-8 w-8 items-center justify-center rounded-lg transition disabled:opacity-40";

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-ink">{t.title}</h1>
          <p className="mt-1 max-w-3xl text-sm font-semibold text-ink-muted">
            {t.summary(realWords.length, probeWords)}{" "}
            {missingAudio > 0 ? (
              <span className="text-orange">{t.missingAudio(missingAudio)}</span>
            ) : (
              t.allAudio
            )}{" "}
            {t.recordHint}
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-bold text-white shadow-sm transition hover:bg-primary-dark"
        >
          <Plus size={18} /> {t.addWord}
        </button>
      </div>

      {message && (
        <p role="status" className="mt-4 rounded-xl bg-primary-soft px-4 py-2.5 text-sm font-bold text-ink">
          {message}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={addWord}
          className="mt-5 grid gap-3 rounded-2xl border border-line bg-card p-6 shadow-sm sm:grid-cols-2 lg:grid-cols-3"
        >
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-muted">
              {t.fieldWord}
            </span>
            <input
              required
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
              placeholder="bahay"
              className={`${input} w-full`}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-muted">
              {t.fieldSyllables}
            </span>
            <input
              required
              value={form.syllables}
              onChange={(e) => setForm({ ...form, syllables: e.target.value })}
              placeholder="ba-hay"
              className={`${input} w-full`}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-muted">
              {t.fieldPattern}
            </span>
            <input
              required
              value={form.pattern}
              onChange={(e) => setForm({ ...form, pattern: e.target.value })}
              placeholder="CVCVC"
              className={`${input} w-full`}
            />
          </label>
          {/* Shown, not chosen: the server derives it from the letters, so a
              word can never reach a child before its letters are taught. A div,
              not a label — there is no control here to label. */}
          <div>
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-muted">
              {t.fieldStage}
            </span>
            <p className={`${input} w-full bg-cream text-ink-soft`} aria-live="polite">
              {derivedStage === null
                ? t.stageFromLetters
                : t.stageLabel(derivedStage, STAGE_LETTERS[derivedStage - 1])}
            </p>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-muted">
              {t.fieldLevel}
            </span>
            <select
              value={form.level}
              onChange={(e) => setForm({ ...form, level: Number(e.target.value) })}
              className={`${input} w-full`}
            >
              {[1, 2, 3, 4, 5].map((l) => (
                <option key={l} value={l}>
                  {t.levelOption(l)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-muted">
              {t.fieldGloss(form.isPseudo)}
            </span>
            <input
              value={form.meaningEn}
              onChange={(e) => setForm({ ...form, meaningEn: e.target.value })}
              placeholder={form.isPseudo ? "—" : "house"}
              disabled={form.isPseudo}
              className={`${input} w-full disabled:opacity-50`}
            />
          </label>

          {/* ── Probe non-word ─────────────────────────────────────────── */}
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="flex items-start gap-3 rounded-2xl border border-line bg-cream/60 p-4">
              <input
                type="checkbox"
                checked={form.isPseudo}
                onChange={(e) => setForm({ ...form, isPseudo: e.target.checked })}
                className="mt-0.5 h-5 w-5 shrink-0 accent-peach-deep"
              />
              <span>
                <span className="block text-sm font-extrabold text-ink">
                  {t.probeCheckbox}
                </span>
                <span className="mt-0.5 block text-xs font-semibold text-ink-muted">
                  {t.probeExplainBefore}
                  <strong>{t.probeExplainLangs}</strong>
                  {t.probeExplainAfter}
                </span>
              </span>
            </label>

            {form.isPseudo && (
              <div className="mt-3 rounded-2xl border border-line bg-white p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={suggest}
                    disabled={suggesting}
                    className="flex items-center gap-2 rounded-xl bg-peach px-4 py-2 text-sm font-bold text-peach-deep transition hover:opacity-90 disabled:opacity-50"
                  >
                    <Sparkles size={16} /> {suggesting ? t.thinking : t.suggest}
                  </button>
                  <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
                    {t.forStage}
                    <select
                      value={suggestStage}
                      onChange={(e) => setSuggestStage(Number(e.target.value))}
                      className="rounded-lg border border-line bg-white px-2 py-1 text-sm font-bold text-ink outline-none focus:border-primary"
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="text-xs font-semibold text-ink-muted">
                    {t.suggestNote}
                  </span>
                </div>

                {candidates.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {candidates.map((c) => (
                      <li key={c.text}>
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              text: c.text,
                              syllables: c.syllables,
                              pattern: c.pattern,
                              level: c.level,
                              meaningEn: "",
                              isPseudo: true,
                            })
                          }
                          className="rounded-full border border-line bg-cream px-3 py-1.5 text-sm font-bold text-ink transition hover:border-peach-deep hover:bg-peach-soft"
                        >
                          {c.syllables}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-primary px-6 py-2.5 font-bold text-white transition hover:bg-primary-dark disabled:opacity-50"
            >
              {busy ? t.adding : t.addToBank}
            </button>
            <span className="text-xs font-semibold text-ink-muted">
              {t.audioAuto}
            </span>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="no-print mt-5 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setStageFilter(0)}
          className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${
            stageFilter === 0 ? "bg-primary text-white" : "bg-card text-ink-soft border border-line hover:bg-cream-dark"
          }`}
        >
          {t.allStages}
        </button>
        {STAGE_LETTERS.map((letters, i) => (
          <button
            key={i}
            onClick={() => setStageFilter(i + 1)}
            title={letters}
            className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${
              stageFilter === i + 1
                ? "bg-primary text-white"
                : "bg-card text-ink-soft border border-line hover:bg-cream-dark"
            }`}
          >
            S{i + 1}
          </button>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.search}
          className={`${input} ml-auto w-44`}
        />
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-card shadow-sm">
        <table className="w-full min-w-200 text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs font-bold uppercase tracking-wide text-ink-muted">
              <th className="px-5 py-3">{t.colWord}</th>
              <th className="px-3 py-3">{t.colSyllables}</th>
              {/* The proposal's data set tags every word with its syllable
                  pattern; it was stored but never shown. */}
              <th className="px-3 py-3">{t.colPattern}</th>
              <th className="px-3 py-3">{t.colStage}</th>
              <th className="px-3 py-3">{t.colLevel}</th>
              <th className="px-3 py-3">{t.colMeaning}</th>
              <th className="px-3 py-3" title={t.colSpellingsTitle}>
                {t.colSpellings}
              </th>
              <th className="px-3 py-3">{t.colPronunciation}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.map((w) => {
              const isRecording = recording?.id === w.id;
              const rowDraft = draft?.wordId === w.id ? draft : null;
              const rowBusy = busyId === w.id;
              return (
                <tr key={w.id} className="align-top transition hover:bg-cream/60">
                  <td className="px-5 py-3 text-base font-extrabold text-ink">
                    {w.text}
                    {w.isPseudo && (
                      <span
                        className="ml-2 inline-block rounded-full bg-peach-soft px-2 py-0.5 align-middle text-xs font-bold text-peach-deep"
                        title={t.probeBadgeTitle}
                      >
                        {t.probeBadge}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 font-semibold text-ink-soft">{w.syllables}</td>
                  <td className="px-3 py-3 font-mono text-xs font-semibold text-ink-soft">{w.pattern}</td>
                  <td className="px-3 py-3 font-semibold text-ink-soft">S{w.stage}</td>
                  <td className="px-3 py-3 font-semibold text-ink-soft">L{w.level}</td>
                  <td className="px-3 py-3 font-semibold text-ink-muted">
                    {w.meaningEn ?? "—"}
                    {w.stressNote && (
                      <span
                        className="mt-1 block text-xs font-bold text-orange"
                        title={t.stressTitle}
                      >
                        {t.stress(w.stressNote)}
                      </span>
                    )}
                  </td>

                  {/* Accepted ASR spellings */}
                  <td className="px-3 py-3">
                    {editingVariants === w.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          value={variantDraft}
                          onChange={(e) => setVariantDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveVariants(w);
                            if (e.key === "Escape") setEditingVariants(null);
                          }}
                          placeholder="cross, kurs"
                          className={`${input} w-36`}
                        />
                        <button
                          onClick={() => saveVariants(w)}
                          disabled={rowBusy}
                          className="rounded-lg bg-primary px-2 py-1 text-xs font-bold text-white transition hover:bg-primary-dark"
                        >
                          {t.save}
                        </button>
                        <button
                          onClick={() => setEditingVariants(null)}
                          className="rounded-lg px-1.5 py-1 text-xs font-bold text-ink-muted hover:text-ink"
                        >
                          {t.cancel}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingVariants(w.id);
                          setVariantDraft(w.variants);
                        }}
                        title={t.colSpellingsTitle}
                        className="rounded-lg px-2 py-1 text-left text-xs font-semibold text-ink-muted transition hover:bg-cream-dark hover:text-ink"
                      >
                        {/* Not dimmed. The palette's ink-muted is chosen to
                            clear 4.5:1 on this background; knocking it to 70%
                            opacity took it to 3.0:1 and failed AA on every word
                            in the bank at once — 256 nodes from one class. */}
                        {w.variants || <span className="text-ink-muted">{t.addSpelling}</span>}
                      </button>
                    )}
                  </td>

                  {/* Pronunciation: play, record, generate */}
                  <td className="px-3 py-3">
                    {w.isPseudo ? (
                      /* No record or generate on a probe item: the server
                         refuses both, because a non-word with a pronunciation
                         hands the child the answer. Saying so beats offering
                         buttons that fail. */
                      <span className="text-xs font-semibold text-ink-muted">
                        {t.neverVoiced}
                      </span>
                    ) : rowDraft ? (
                      /* Preview the take before it replaces what learners hear */
                      <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-primary-soft/60 p-1.5">
                        <span className="px-1 text-xs font-bold text-ink">
                          {t.newTake(rowDraft.kind === "syll")}
                        </span>
                        <button
                          onClick={() => new Audio(rowDraft.url).play().catch(() => {})}
                          aria-label={t.playTake}
                          className={`${iconBtn} bg-white text-primary hover:bg-cream`}
                        >
                          <Play size={15} />
                        </button>
                        <button
                          onClick={() => saveDraft(w)}
                          disabled={rowBusy}
                          className="flex items-center gap-1 rounded-lg bg-green px-2.5 py-1.5 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                        >
                          <Check size={14} /> {t.useThis}
                        </button>
                        <button
                          onClick={() => toggleRecord(w, rowDraft.kind)}
                          disabled={rowBusy}
                          className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-ink transition hover:bg-cream"
                        >
                          {t.redo}
                        </button>
                        <button
                          onClick={discardDraft}
                          aria-label={t.discardTake}
                          className={`${iconBtn} text-ink-muted hover:bg-white hover:text-ink`}
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          onClick={() => preview(w)}
                          aria-label={t.hearAria(w.text)}
                          title={t.hearTitle}
                          className={`${iconBtn} text-primary hover:bg-primary-soft`}
                        >
                          <Volume2 size={16} />
                        </button>
                        <button
                          onClick={() => preview(w, "syll")}
                          aria-label={t.hearSyllAria(w.text)}
                          title={t.hearSyllTitle}
                          className={`${iconBtn} text-primary hover:bg-primary-soft`}
                        >
                          <span className="text-[11px] font-extrabold">ba·hay</span>
                        </button>

                        <button
                          onClick={() => toggleRecord(w, "word")}
                          disabled={rowBusy || (recording !== null && !isRecording)}
                          aria-label={t.recordAria(w.text, isRecording)}
                          title={t.recordTitle(isRecording)}
                          className={`${iconBtn} ${
                            isRecording
                              ? "animate-pulse bg-red text-white"
                              : "text-ink-muted hover:bg-cream-dark hover:text-ink"
                          }`}
                        >
                          {isRecording ? <Square size={15} /> : <Mic size={16} />}
                        </button>

                        {!w.hasTts && (
                          <button
                            onClick={() => generateAudio(w)}
                            disabled={rowBusy}
                            title={t.generateTitle}
                            aria-label={t.generateAria(w.text)}
                            className={`${iconBtn} text-orange hover:bg-orange-soft`}
                          >
                            <Sparkles size={16} />
                          </button>
                        )}

                        {w.hasHuman && (
                          <>
                            <span className="rounded-full bg-green-soft px-2 py-0.5 text-[10px] font-bold text-green">
                              {t.yourVoice}
                            </span>
                            <button
                              onClick={() => removeRecording(w)}
                              disabled={rowBusy}
                              title={t.removeTitle}
                              aria-label={t.removeAria(w.text)}
                              className={`${iconBtn} text-ink-muted hover:bg-red-soft hover:text-red`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                        {!w.hasHuman && !w.hasTts && (
                          <span className="rounded-full bg-orange-soft px-2 py-0.5 text-[10px] font-bold text-orange">
                            {t.noAudio}
                          </span>
                        )}
                        {rowBusy && (
                          <span className="text-[10px] font-bold text-ink-muted">{t.working}</span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-ink-muted">
                  {t.noMatch}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
