"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

type WordOption = { id: string; text: string };

/** Specialist controls: override the adaptive level and pin practice words. */
export default function LearnerControls({
  learnerId,
  currentLevel,
  words,
}: {
  learnerId: string;
  currentLevel: number;
  words: WordOption[];
}) {
  const router = useRouter();
  const [level, setLevel] = useState(currentLevel);
  const [wordQuery, setWordQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveLevel(next: number) {
    setLevel(next);
    setBusy(true);
    await fetch(`/api/learners/${learnerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: next }),
    });
    setBusy(false);
    setMessage(`Level set to ${next}.`);
    router.refresh();
  }

  async function addPracticeWord() {
    const match = words.find((w) => w.text === wordQuery.trim().toLowerCase());
    if (!match) {
      setMessage("Pick a word from the word bank list.");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/learners/${learnerId}/practice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wordId: match.id }),
    });
    setBusy(false);
    setMessage(res.ok ? `“${match.text}” added to the practice list.` : "Could not add the word.");
    if (res.ok) {
      setWordQuery("");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-muted">
          Difficulty level
        </span>
        <select
          value={level}
          disabled={busy}
          onChange={(e) => saveLevel(Number(e.target.value))}
          className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-bold text-ink outline-none focus:border-primary"
        >
          {[1, 2, 3, 4, 5].map((l) => (
            <option key={l} value={l}>
              Level {l}
            </option>
          ))}
        </select>
      </label>

      <div>
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-muted">
          Add a practice word
        </span>
        <div className="flex gap-2">
          <input
            list="word-bank-options"
            value={wordQuery}
            onChange={(e) => setWordQuery(e.target.value)}
            placeholder="Type a word…"
            className="w-44 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-primary"
          />
          <datalist id="word-bank-options">
            {words.map((w) => (
              <option key={w.id} value={w.text} />
            ))}
          </datalist>
          <button
            onClick={addPracticeWord}
            disabled={busy || !wordQuery.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-bold text-white transition hover:bg-primary-dark disabled:opacity-50"
          >
            <Plus size={16} /> Add
          </button>
        </div>
      </div>

      {message && <p className="text-sm font-bold text-green">{message}</p>}
    </div>
  );
}
