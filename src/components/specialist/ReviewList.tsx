"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, Play, StickyNote, AudioLines } from "lucide-react";
import { tryFetch } from "@/lib/net";

export type ReviewableAttempt = {
  id: string;
  target: string;
  transcript: string | null;
  correct: boolean;
  errorType: string | null;
  activityType: string;
  createdAt: string;
  hasAudio: boolean;
  engine: string | null; // "server" (Whisper) | "browser" (Web Speech)
  altTranscript: string | null;
  score: number; // similarity to the target, 0–1
  review: { agrees: boolean; note: string | null } | null;
  /** Set when the word's meaning depends on stress the spelling does not mark. */
  stressNote?: string | null;
};

const ENGINE_LABELS: Record<string, string> = {
  server: "Whisper",
  browser: "Browser",
};

/**
 * Reliability check (Validation section): the specialist replays recorded oral
 * readings and confirms or disputes the system's verdict. The agreement rate
 * between specialist and system is computed from these reviews.
 *
 * Two modes, one stored column
 * ----------------------------
 * In `agreement` mode the specialist answers "was the system right?" directly.
 *
 * In `probe` mode they answer a different question — "did the child read this
 * non-word correctly?" — because on a made-up word the machine verdict is not
 * something to ratify. It is a language model transcribing a word that has no
 * entry in any language, and how often it guesses right is precisely what is
 * unknown; the first real probe run had it write seven of eight correctly and
 * garble the eighth, which is neither reliable enough to trust nor bad enough
 * to discard. So a person decides, and the transcript is kept beside them.
 *
 * Both still store `agrees`, and it keeps its single meaning: whether the human
 * and the machine reached the same conclusion. The probe verdict is folded into
 * it here rather than stored separately, and reads back out as
 * `agrees ? attempt.correct : !attempt.correct`. One column, one definition,
 * and the agreement rate stays comparable across both kinds of item — which is
 * the interesting comparison, since machine–human agreement is known to be
 * worse for readers with disabilities and worse again on unfamiliar words.
 */
export default function ReviewList({
  attempts,
  mode = "agreement",
}: {
  attempts: ReviewableAttempt[];
  mode?: "agreement" | "probe";
}) {
  const isProbe = mode === "probe";
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
  const [failed, setFailed] = useState<string | null>(null);

  async function review(attemptId: string, agrees: boolean, note?: string) {
    setBusy(attemptId);
    setFailed(null);
    const res = await tryFetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId, agrees, note: note ?? notes[attemptId] ?? undefined }),
    });
    // A verdict that fails to save used to leave the button exactly as it was,
    // which is indistinguishable from not having pressed it. These verdicts are
    // the agreement metric and the probe score, so a lost one is not cosmetic.
    if (res?.ok) setReviews((r) => ({ ...r, [attemptId]: agrees }));
    else setFailed(attemptId);
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

  /** Fetched on demand — the page no longer carries the recordings. */
  function playAudio(attemptId: string) {
    new Audio(`/api/attempt-audio/${attemptId}`).play().catch(() => {});
  }

  if (attempts.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        {isProbe
          ? "No probe readings yet. They appear here after the learner runs the Silly words activity."
          : "No oral readings recorded yet. Readings appear here after the learner does Read-aloud or Practice exercises."}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line">
      {attempts.map((a) => {
        const reviewed = reviews[a.id];
        // The specialist's own verdict, recovered from the stored agreement:
        // they agreed with a "correct" verdict, or disagreed with a wrong one.
        const readCorrectly = reviewed === undefined ? undefined : reviewed === a.correct;
        return (
          <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-32">
              <p className="font-extrabold text-ink">{a.target}</p>
              <p className="text-xs font-semibold text-ink-muted">
                {new Date(a.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}{" "}
                · {isProbe ? "non-word" : a.activityType === "PRACTICE" ? "practice" : "read aloud"}
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
                {/* On a probe the machine verdict is greyed rather than hidden.
                    It is real data — pairing it with a human verdict is how the
                    study learns how far it can be trusted — but showing it in
                    the usual green/red would invite the specialist to simply
                    ratify it, which would make the pair worthless. */}
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                    isProbe
                      ? "bg-cream text-ink-muted"
                      : a.correct
                        ? "bg-green-soft text-green"
                        : "bg-red-soft text-red"
                  }`}
                  title={
                    isProbe
                      ? "The recogniser is transcribing a word that exists in no language. Decide from the recording, not from this."
                      : undefined
                  }
                >
                  system: {a.correct ? "correct" : (a.errorType ?? "incorrect")}
                  {isProbe && " (decide by ear)"}
                </span>
                {/* The app scores letters; this word's meaning is carried by
                    stress, which the transcript does not record. Both readings
                    look identical to the scorer, so this one has to be heard. */}
                {a.stressNote && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-orange-soft px-2 py-0.5 text-xs font-bold text-orange"
                    title="Stress is not written in Filipino and not captured by the transcript — check this reading by ear."
                  >
                    <AudioLines size={12} /> {a.stressNote}
                  </span>
                )}
                {a.engine && (
                  <span className="inline-block rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">
                    {ENGINE_LABELS[a.engine] ?? a.engine}
                  </span>
                )}
                {/* How close the reading was to the target — the number the
                    accept/reject decision was actually made on. */}
                <span
                  className="inline-block rounded-full bg-cream px-2 py-0.5 text-xs font-bold text-ink-muted"
                  title="Similarity to the target word"
                >
                  {a.score.toFixed(2)}
                </span>
              </div>
            </div>

            {a.hasAudio && (
              <button
                onClick={() => playAudio(a.id)}
                aria-label={`Play recording of ${a.target}`}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-peach text-peach-deep transition hover:opacity-90"
              >
                <Play size={16} />
              </button>
            )}

            <div
              className="flex items-center gap-1.5"
              role="group"
              aria-label={
                isProbe
                  ? "Did the learner read this non-word correctly?"
                  : "Do you agree with the system's scoring?"
              }
            >
              {/*
                In probe mode the buttons ask about the child, not the machine,
                so the verdict is converted to an agreement before it is stored:
                saying "read it correctly" agrees with the system only when the
                system also said correct. `readCorrectly` reverses the same
                mapping for display, so the button that lights up is the one the
                specialist actually pressed.
              */}
              <button
                onClick={() => review(a.id, isProbe ? a.correct === true : true)}
                disabled={busy === a.id}
                aria-pressed={isProbe ? readCorrectly === true : reviewed === true}
                title={isProbe ? "The learner read this non-word correctly" : "I agree with the system's scoring"}
                className={`flex h-9 items-center justify-center gap-1.5 rounded-lg border px-2.5 transition ${
                  (isProbe ? readCorrectly === true : reviewed === true)
                    ? "border-green bg-green-soft text-green"
                    : "border-line bg-white text-ink-muted hover:border-green hover:text-green"
                } ${isProbe ? "" : "w-9 px-0"}`}
              >
                <ThumbsUp size={16} />
                {isProbe && <span className="text-xs font-bold">Read it</span>}
              </button>
              <button
                onClick={() => review(a.id, isProbe ? a.correct === false : false)}
                disabled={busy === a.id}
                aria-pressed={isProbe ? readCorrectly === false : reviewed === false}
                title={isProbe ? "The learner did not read this non-word correctly" : "I disagree with the system's scoring"}
                className={`flex h-9 items-center justify-center gap-1.5 rounded-lg border px-2.5 transition ${
                  (isProbe ? readCorrectly === false : reviewed === false)
                    ? "border-red bg-red-soft text-red"
                    : "border-line bg-white text-ink-muted hover:border-red hover:text-red"
                } ${isProbe ? "" : "w-9 px-0"}`}
              >
                <ThumbsDown size={16} />
                {isProbe && <span className="text-xs font-bold">Misread</span>}
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
            {failed === a.id && (
              <p role="alert" className="w-full pl-1 text-xs font-bold text-orange">
                That verdict was not saved — check the connection and press it again.
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
