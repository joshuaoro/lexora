"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, Play, StickyNote } from "lucide-react";

export type ReviewableAttempt = {
  id: string;
  target: string;
  transcript: string | null;
  correct: boolean;
  errorType: string | null;
  activityType: string;
  createdAt: string;
  hasAudio: boolean;
  audio: string | null;
  engine: string | null; // "server" (Whisper) | "browser" (Web Speech)
  altTranscript: string | null;
  review: { agrees: boolean; note: string | null } | null;
};

const ENGINE_LABELS: Record<string, string> = {
  server: "Whisper",
  browser: "Browser",
};

/**
 * Reliability check (Validation section): the specialist replays recorded oral
 * readings and confirms or disputes the system's verdict. The agreement rate
 * between specialist and system is computed from these reviews.
 */
export default function ReviewList({ attempts }: { attempts: ReviewableAttempt[] }) {
  const [reviews, setReviews] = useState<Record<string, boolean>>(
    Object.fromEntries(
      attempts.filter((a) => a.review).map((a) => [a.id, a.review!.agrees])
    )
  );
  const [notes, setNotes] = useState<Record<string, string>>(
    Object.fromEntries(
      attempts.filter((a) => a.review?.note).map((a) => [a.id, a.review!.note!])
    )
  );
  const [noteOpen, setNoteOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function review(attemptId: string, agrees: boolean, note?: string) {
    setBusy(attemptId);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId, agrees, note: note ?? notes[attemptId] ?? undefined }),
    });
    if (res.ok) setReviews((r) => ({ ...r, [attemptId]: agrees }));
    setBusy(null);
  }

  /** Save a written observation alongside the verdict (kept for the audit trail). */
  async function saveNote(attemptId: string) {
    const agrees = reviews[attemptId];
    if (agrees === undefined) {
      // A note only makes sense with a verdict; default to agreeing.
      await review(attemptId, true, notes[attemptId]);
    } else {
      await review(attemptId, agrees, notes[attemptId]);
    }
    setNoteOpen(null);
  }

  function playAudio(audio: string) {
    new Audio(audio).play().catch(() => {});
  }

  if (attempts.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        No oral readings recorded yet. Readings appear here after the learner does Read-aloud or
        Practice exercises.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line">
      {attempts.map((a) => {
        const reviewed = reviews[a.id];
        return (
          <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-32">
              <p className="font-extrabold text-ink">{a.target}</p>
              <p className="text-xs font-semibold text-ink-muted">
                {new Date(a.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}{" "}
                · {a.activityType === "PRACTICE" ? "practice" : "read aloud"}
              </p>
            </div>

            <div className="flex-1">
              <p className="text-sm font-semibold text-ink-soft">
                Heard:{" "}
                <span className="font-bold text-ink">
                  {a.transcript ? `“${a.transcript}”` : "(nothing)"}
                </span>
              </p>
              {a.altTranscript && (
                <p className="text-xs font-semibold text-ink-muted">
                  Browser heard: “{a.altTranscript}”
                </p>
              )}
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                    a.correct ? "bg-green-soft text-green" : "bg-red-soft text-red"
                  }`}
                >
                  system: {a.correct ? "correct" : (a.errorType ?? "incorrect")}
                </span>
                {a.engine && (
                  <span className="inline-block rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">
                    {ENGINE_LABELS[a.engine] ?? a.engine}
                  </span>
                )}
              </div>
            </div>

            {a.hasAudio && a.audio && (
              <button
                onClick={() => playAudio(a.audio!)}
                aria-label={`Play recording of ${a.target}`}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-peach text-peach-deep transition hover:opacity-90"
              >
                <Play size={16} />
              </button>
            )}

            <div className="flex items-center gap-1.5" role="group" aria-label="Do you agree with the system's scoring?">
              <button
                onClick={() => review(a.id, true)}
                disabled={busy === a.id}
                aria-pressed={reviewed === true}
                title="I agree with the system's scoring"
                className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                  reviewed === true
                    ? "border-green bg-green-soft text-green"
                    : "border-line bg-white text-ink-muted hover:border-green hover:text-green"
                }`}
              >
                <ThumbsUp size={16} />
              </button>
              <button
                onClick={() => review(a.id, false)}
                disabled={busy === a.id}
                aria-pressed={reviewed === false}
                title="I disagree with the system's scoring"
                className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                  reviewed === false
                    ? "border-red bg-red-soft text-red"
                    : "border-line bg-white text-ink-muted hover:border-red hover:text-red"
                }`}
              >
                <ThumbsDown size={16} />
              </button>
              <button
                onClick={() => setNoteOpen(noteOpen === a.id ? null : a.id)}
                aria-pressed={noteOpen === a.id}
                title="Add an observation about this reading"
                className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                  notes[a.id]
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-line bg-white text-ink-muted hover:border-primary hover:text-primary"
                }`}
              >
                <StickyNote size={16} />
              </button>
            </div>

            {noteOpen === a.id && (
              <div className="flex w-full items-center gap-2 pl-1">
                <input
                  autoFocus
                  value={notes[a.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveNote(a.id);
                    if (e.key === "Escape") setNoteOpen(null);
                  }}
                  maxLength={300}
                  placeholder="e.g. self-corrected after two tries; b/d reversal"
                  className="flex-1 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-primary"
                />
                <button
                  onClick={() => saveNote(a.id)}
                  disabled={busy === a.id}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary-dark disabled:opacity-50"
                >
                  Save note
                </button>
              </div>
            )}
            {noteOpen !== a.id && notes[a.id] && (
              <p className="w-full pl-1 text-xs font-semibold italic text-ink-muted">
                “{notes[a.id]}”
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
