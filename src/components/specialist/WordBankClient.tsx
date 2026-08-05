"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Volume2, Mic, Square, Trash2, Sparkles, Play, Check, X } from "lucide-react";
import { STAGE_LETTERS } from "@/lib/marungko";
import { playAudioUrl, speakOnce, stopSpeaking } from "@/lib/tts";
import { tryFetch } from "@/lib/net";

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
  stage: 1,
  level: 1,
  meaningEn: "",
  isPseudo: false,
};
const MAX_RECORD_MS = 6000;

export default function WordBankClient({ words }: { words: WordRow[] }) {
  const router = useRouter();
  const [stageFilter, setStageFilter] = useState<number | 0>(0);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
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
      setMessage(res ? "Could not fetch suggestions." : "No internet connection. Check it and try again.");
      return;
    }
    setCandidates(data.candidates ?? []);
    if ((data.candidates ?? []).length === 0) {
      setMessage(`No new combinations left at stage ${suggestStage} — try a later stage.`);
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
        stage: Number(form.stage),
        level: Number(form.level),
        meaningEn: form.isPseudo ? undefined : form.meaningEn || undefined,
        isPseudo: form.isPseudo,
      }),
    });
    const data = (await res?.json().catch(() => ({}))) ?? {};
    if (!res?.ok) {
      setBusy(false);
      setMessage(res ? (data.error ?? "Could not add the word.") : "No internet connection. Check it and try again.");
      return;
    }

    // A probe word is deliberately left silent. Generating audio for it would
    // let a child press listen and be handed the answer, which is the one thing
    // that stops it being a probe.
    if (form.isPseudo) {
      setBusy(false);
      setMessage(`“${data.text}” added as a probe non-word — no audio, and it will never appear in practice.`);
      setForm(EMPTY_FORM);
      router.refresh();
      return;
    }

    // Give the new word a pronunciation immediately — otherwise learners would
    // hear it read with English phonics.
    setMessage(`“${data.text}” added — generating pronunciation…`);
    const gen = await tryFetch(`/api/words/${data.id}/audio/generate`, { method: "POST" });
    setBusy(false);
    setMessage(
      gen?.ok
        ? `“${data.text}” added with Filipino audio.`
        : `“${data.text}” added, but audio generation failed — use the ✨ button to retry.`
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
        ? `Generated audio for “${word.text}”.`
        : res
          ? (data.error ?? "Could not generate.")
          : "No internet connection. Check it and try again."
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
      setMessage("Microphone access was blocked. Allow the microphone and try again.");
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
        setMessage("Nothing was recorded — please try again.");
        return;
      }
      const audio = await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
      if (!audio) {
        setMessage("Could not read the recording — please try again.");
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
      setMessage(res ? (data.error ?? "Could not save the recording.") : "No internet connection. Check it and try again.");
      return;
    }
    URL.revokeObjectURL(draft.url);
    setDraft(null);
    setMessage(`Saved your voice for “${word.text}”. Learners will hear this recording.`);
    router.refresh();
  }

  function discardDraft() {
    if (draft) URL.revokeObjectURL(draft.url);
    setDraft(null);
  }

  async function removeRecording(word: WordRow) {
    setBusyId(word.id);
    await tryFetch(`/api/words/${word.id}/audio`, { method: "DELETE" });
    setBusyId(null);
    setMessage(`Removed your recording of “${word.text}” — the generated voice is back.`);
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
      setMessage(res ? (data.error ?? "Could not save.") : "No internet connection. Check it and try again.");
      return;
    }
    setEditingVariants(null);
    setMessage(`Updated accepted spellings for “${word.text}”.`);
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
          <h1 className="text-3xl font-extrabold text-ink">Word bank</h1>
          <p className="mt-1 max-w-3xl text-sm font-semibold text-ink-muted">
            {realWords.length} Filipino words, sequenced by the Marungko Approach and tagged by
            syllable pattern and difficulty
            {probeWords > 0 && `, plus ${probeWords} probe non-words`}.{" "}
            {missingAudio > 0 ? (
              <span className="text-orange">
                {missingAudio} still need pronunciation audio — use the ✨ button.
              </span>
            ) : (
              "All words have pronunciation audio."
            )}{" "}
            Record a word in your own voice with the mic; learners hear your recording instead of
            the generated voice.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-bold text-white shadow-sm transition hover:bg-primary-dark"
        >
          <Plus size={18} /> Add word
        </button>
      </div>

      {message && (
        <p className="mt-4 rounded-xl bg-primary-soft px-4 py-2.5 text-sm font-bold text-ink">
          {message}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={addWord}
          className="mt-5 grid gap-3 rounded-2xl border border-line bg-card p-6 shadow-sm sm:grid-cols-2 lg:grid-cols-3"
        >
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-muted">Word</span>
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
              Syllables (use “-”)
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
              Pattern
            </span>
            <input
              required
              value={form.pattern}
              onChange={(e) => setForm({ ...form, pattern: e.target.value })}
              placeholder="CVCVC"
              className={`${input} w-full`}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-muted">
              Marungko stage
            </span>
            <select
              value={form.stage}
              onChange={(e) => setForm({ ...form, stage: Number(e.target.value) })}
              className={`${input} w-full`}
            >
              {STAGE_LETTERS.map((letters, i) => (
                <option key={i} value={i + 1}>
                  Stage {i + 1} ({letters})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-muted">
              Difficulty level
            </span>
            <select
              value={form.level}
              onChange={(e) => setForm({ ...form, level: Number(e.target.value) })}
              className={`${input} w-full`}
            >
              {[1, 2, 3, 4, 5].map((l) => (
                <option key={l} value={l}>
                  Level {l}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-muted">
              English gloss {form.isPseudo ? "(not used for probe words)" : "(optional)"}
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
                  This is a probe non-word
                </span>
                <span className="mt-0.5 block text-xs font-semibold text-ink-muted">
                  A made-up word for the decoding probe. It gets no audio and no meaning, never
                  appears in practice, and never affects a learner&apos;s level or accuracy — it
                  exists only to check whether a child can decode letters they have not memorised.
                  It must not be a real word in <strong>Tagalog or Cebuano</strong>, or a local
                  name.
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
                    <Sparkles size={16} /> {suggesting ? "Thinking…" : "Suggest non-words"}
                  </button>
                  <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
                    for stage
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
                    Suggestions are only letter combinations — you decide which are genuinely not
                    words.
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
                              stage: suggestStage,
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
              {busy ? "Adding…" : "Add to word bank"}
            </button>
            <span className="text-xs font-semibold text-ink-muted">
              Filipino audio is generated automatically.
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
          All stages
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
          placeholder="Search…"
          className={`${input} ml-auto w-44`}
        />
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-card shadow-sm">
        <table className="w-full min-w-200 text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs font-bold uppercase tracking-wide text-ink-muted">
              <th className="px-5 py-3">Word</th>
              <th className="px-3 py-3">Syllables</th>
              <th className="px-3 py-3">Stage</th>
              <th className="px-3 py-3">Level</th>
              <th className="px-3 py-3">Meaning</th>
              <th
                className="px-3 py-3"
                title="Spellings the speech recognizer may return for a correct reading"
              >
                Accepted spellings
              </th>
              <th className="px-3 py-3">Pronunciation</th>
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
                        title="A made-up word used only in the decoding probe. Never appears in practice and never gets audio."
                      >
                        probe
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 font-semibold text-ink-soft">{w.syllables}</td>
                  <td className="px-3 py-3 font-semibold text-ink-soft">S{w.stage}</td>
                  <td className="px-3 py-3 font-semibold text-ink-soft">L{w.level}</td>
                  <td className="px-3 py-3 font-semibold text-ink-muted">
                    {w.meaningEn ?? "—"}
                    {w.stressNote && (
                      <span
                        className="mt-1 block text-xs font-bold text-orange"
                        title="Filipino does not write stress and the transcript does not capture it, so the app scores both readings the same. Judge this word by ear."
                      >
                        stress: {w.stressNote}
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
                          Save
                        </button>
                        <button
                          onClick={() => setEditingVariants(null)}
                          className="rounded-lg px-1.5 py-1 text-xs font-bold text-ink-muted hover:text-ink"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingVariants(w.id);
                          setVariantDraft(w.variants);
                        }}
                        title="Spellings the recognizer may return for a correct reading"
                        className="rounded-lg px-2 py-1 text-left text-xs font-semibold text-ink-muted transition hover:bg-cream-dark hover:text-ink"
                      >
                        {w.variants || <span className="text-ink-muted/70">+ add</span>}
                      </button>
                    )}
                  </td>

                  {/* Pronunciation: play, record, generate */}
                  <td className="px-3 py-3">
                    {rowDraft ? (
                      /* Preview the take before it replaces what learners hear */
                      <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-primary-soft/60 p-1.5">
                        <span className="px-1 text-xs font-bold text-ink">
                          New {rowDraft.kind === "syll" ? "syllables" : "word"} take:
                        </span>
                        <button
                          onClick={() => new Audio(rowDraft.url).play().catch(() => {})}
                          aria-label="Play the recording you just made"
                          className={`${iconBtn} bg-white text-primary hover:bg-cream`}
                        >
                          <Play size={15} />
                        </button>
                        <button
                          onClick={() => saveDraft(w)}
                          disabled={rowBusy}
                          className="flex items-center gap-1 rounded-lg bg-green px-2.5 py-1.5 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                        >
                          <Check size={14} /> Use this
                        </button>
                        <button
                          onClick={() => toggleRecord(w, rowDraft.kind)}
                          disabled={rowBusy}
                          className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-ink transition hover:bg-cream"
                        >
                          Redo
                        </button>
                        <button
                          onClick={discardDraft}
                          aria-label="Discard this recording"
                          className={`${iconBtn} text-ink-muted hover:bg-white hover:text-ink`}
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          onClick={() => preview(w)}
                          aria-label={`Hear ${w.text}`}
                          title="Hear what learners hear"
                          className={`${iconBtn} text-primary hover:bg-primary-soft`}
                        >
                          <Volume2 size={16} />
                        </button>
                        <button
                          onClick={() => preview(w, "syll")}
                          aria-label={`Hear ${w.text} by syllables`}
                          title="Hear the syllables"
                          className={`${iconBtn} text-primary hover:bg-primary-soft`}
                        >
                          <span className="text-[11px] font-extrabold">ba·hay</span>
                        </button>

                        <button
                          onClick={() => toggleRecord(w, "word")}
                          disabled={rowBusy || (recording !== null && !isRecording)}
                          aria-label={
                            isRecording ? `Stop recording ${w.text}` : `Record ${w.text} in your voice`
                          }
                          title={isRecording ? "Tap to stop" : "Record the word in your own voice"}
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
                            title="Generate Filipino pronunciation"
                            aria-label={`Generate audio for ${w.text}`}
                            className={`${iconBtn} text-orange hover:bg-orange-soft`}
                          >
                            <Sparkles size={16} />
                          </button>
                        )}

                        {w.hasHuman && (
                          <>
                            <span className="rounded-full bg-green-soft px-2 py-0.5 text-[10px] font-bold text-green">
                              your voice
                            </span>
                            <button
                              onClick={() => removeRecording(w)}
                              disabled={rowBusy}
                              title="Remove your recording (generated voice returns)"
                              aria-label={`Remove your recording of ${w.text}`}
                              className={`${iconBtn} text-ink-muted hover:bg-red-soft hover:text-red`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                        {!w.hasHuman && !w.hasTts && (
                          <span className="rounded-full bg-orange-soft px-2 py-0.5 text-[10px] font-bold text-orange">
                            no audio
                          </span>
                        )}
                        {rowBusy && (
                          <span className="text-[10px] font-bold text-ink-muted">working…</span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-ink-muted">
                  No words match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
