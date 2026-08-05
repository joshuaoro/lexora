"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { tryFetch } from "@/lib/net";
import { getDict, type Lang } from "@/lib/i18n";

type WordOption = { id: string; text: string };

/** Specialist controls: override the adaptive level and pin practice words. */
export default function LearnerControls({
  learnerId,
  currentLevel,
  words,
  lang = "en",
}: {
  learnerId: string;
  currentLevel: number;
  words: WordOption[];
  lang?: Lang;
}) {
  const router = useRouter();
  const t = getDict(lang).specialist;
  const [level, setLevel] = useState(currentLevel);
  const [wordQuery, setWordQuery] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * The level is saved the moment it is picked, which is the right interaction
   * — but it used to report success whichever way the request went. Offline,
   * the dropdown moved, "Level set to 4." appeared, and nothing had changed:
   * the specialist walks away believing they adjusted a child's difficulty.
   *
   * On failure the control is put back where it was, so what is on screen is
   * always what is in the database.
   */
  async function saveLevel(next: number) {
    const previous = level;
    setLevel(next);
    setBusy(true);
    setMessage(null);
    const res = await tryFetch(`/api/learners/${learnerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: next }),
    });
    setBusy(false);
    if (res?.ok) {
      setMessage({ tone: "ok", text: `Saved — level ${next}.` });
      router.refresh();
      return;
    }
    setLevel(previous);
    setMessage({
      tone: "bad",
      text: res
        ? "Could not change the level — it is unchanged."
        : "No internet connection — the level is unchanged.",
    });
  }

  async function addPracticeWord() {
    const match = words.find((w) => w.text === wordQuery.trim().toLowerCase());
    if (!match) {
      setMessage({ tone: "bad", text: "Pick a word from the word bank list." });
      return;
    }
    setBusy(true);
    setMessage(null);
    const res = await tryFetch(`/api/learners/${learnerId}/practice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wordId: match.id }),
    });
    setBusy(false);
    setMessage(
      res?.ok
        ? { tone: "ok", text: `Saved — “${match.text}” added to the practice list.` }
        : {
            tone: "bad",
            text: res ? "Could not add the word." : "No internet connection. Check it and try again.",
          }
    );
    if (res?.ok) {
      setWordQuery("");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-muted">
          {t.difficultyLevel}
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
          {t.addPracticeWord}
        </span>
        <div className="flex gap-2">
          <input
            list="word-bank-options"
            value={wordQuery}
            onChange={(e) => setWordQuery(e.target.value)}
            placeholder={t.typeAWord}
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
            <Plus size={16} /> {t.add}
          </button>
        </div>
      </div>

      {message && (
        <p
          role={message.tone === "bad" ? "alert" : "status"}
          className={`text-sm font-bold ${message.tone === "ok" ? "text-green" : "text-orange"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
