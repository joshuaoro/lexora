"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, Play, StickyNote, AudioLines, Eye, EyeOff } from "lucide-react";
import { ERROR_TAGS } from "@/lib/error-tags";
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
  review: { agrees: boolean; note: string | null; tags?: string[] } | null;
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

  /**
   * Blind is the default, and the probe is blind by construction.
   *
   * The machine's verdict used to sit above the play button in green or red
   * with its similarity beside it, so a specialist met the answer before they
   * could hear the reading. Every one of those judgements feeds the agreement
   * percentage, Cohen's κ and the fitted threshold, and none of them was
   * independent of the thing it was measuring.
   */
  const [blind, setBlind] = useState(true);
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
  const [tags, setTags] = useState<Record<string, string[]>>(
    Object.fromEntries(attempts.filter((a) => a.review?.tags?.length).map((a) => [a.id, a.review!.tags!]))
  );
  const [noteOpen, setNoteOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  /** Rows the specialist has judged in this sitting, so the reveal is theirs. */
  const [justJudged, setJustJudged] = useState<Set<string>>(new Set());
  /**
   * Whether each verdict was formed blind, fixed at the moment it was formed.
   *
   * Recomputing this on every save was wrong in a way that only shows up in the
   * data: judging a row blind stored `blind = true`, then adding an observation
   * tag saved the row again — and by then the verdict was on screen, so the
   * recomputed value was false and quietly overwrote it. The provenance of the
   * label would have been rewritten by an action taken after the label existed,
   * turning blind judgements into anchored ones in the very comparison blind
   * review was built to make.
   *
   * A change of mind is different and does re-evaluate: pressing the other
   * button after the reveal really was decided with the answer visible.
   */
  const [judgedBlind, setJudgedBlind] = useState<Record<string, boolean>>({});

  /**
   * Whether this row may show the machine's verdict.
   *
   * In quick review, always. In blind review, only once the specialist has
   * committed a judgement — either now or in an earlier sitting, since a row
   * already carrying a review has nothing left to anchor.
   */
  function revealed(attemptId: string): boolean {
    return !blind || reviews[attemptId] !== undefined || justJudged.has(attemptId);
  }

  /**
   * Was the machine's verdict hidden when this row's verdict was formed?
   *
   * `verdictChange` distinguishes the two reasons this function is called. A new
   * or changed verdict is being formed now, so it is judged by what is on
   * screen now. A note or a tag is an annotation *of a verdict that already
   * exists*, and must carry that verdict's original provenance rather than
   * re-deriving it from a screen that has since revealed the answer.
   */
  function blindFor(attemptId: string, verdictChange: boolean): boolean {
    if (!verdictChange && judgedBlind[attemptId] !== undefined) return judgedBlind[attemptId];
    return blind && !justJudged.has(attemptId) && reviews[attemptId] === undefined;
  }

  async function review(
    attemptId: string,
    agrees: boolean,
    note?: string,
    nextTags?: string[],
    { verdictChange = true }: { verdictChange?: boolean } = {}
  ) {
    setBusy(attemptId);
    setFailed(null);
    const wasBlind = blindFor(attemptId, verdictChange);
    const res = await tryFetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attemptId,
        agrees,
        note: note ?? notes[attemptId] ?? undefined,
        blind: wasBlind,
        ...(nextTags !== undefined ? { tags: nextTags } : {}),
      }),
    });
    // A verdict that fails to save used to leave the button exactly as it was,
    // which is indistinguishable from not having pressed it. These verdicts are
    // the agreement metric and the probe score, so a lost one is not cosmetic.
    if (res?.ok) {
      setReviews((r) => ({ ...r, [attemptId]: agrees }));
      setJustJudged((s) => new Set(s).add(attemptId));
      if (verdictChange) setJudgedBlind((b) => ({ ...b, [attemptId]: wasBlind }));
    } else setFailed(attemptId);
    setBusy(null);
  }

  /** Toggle one observation chip and save immediately. */
  async function toggleTag(attemptId: string, tag: string) {
    const current = tags[attemptId] ?? [];
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    setTags((t) => ({ ...t, [attemptId]: next }));
    const agrees = reviews[attemptId];
    if (agrees !== undefined) {
      await review(attemptId, agrees, undefined, next, { verdictChange: false });
    }
  }

  /** Save a written observation alongside the verdict (kept for the audit trail). */
  async function saveNote(attemptId: string) {
    const agrees = reviews[attemptId];
    if (agrees === undefined) {
      // A note only makes sense with a verdict; default to agreeing.
      await review(attemptId, true, notes[attemptId]);
    } else {
      await review(attemptId, agrees, notes[attemptId], undefined, { verdictChange: false });
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
    <>
      {/*
        The mode, always on screen, and leaving it is a sentence rather than a
        switch. A specialist who has just recorded twenty verdicts should never
        have to remember which condition produced them, and stepping out of
        blind review should take a moment's thought — the friction is the point,
        but it is not a lock: there are real reasons to look first.
      */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-cream/60 px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm font-extrabold text-ink">
          {blind ? (
            <>
              <EyeOff size={16} className="text-primary" /> Blind review
              <span className="font-semibold text-ink-muted">
                — the system&apos;s verdict is hidden until you decide
              </span>
            </>
          ) : (
            <>
              <Eye size={16} className="text-orange" /> Quick review
              <span className="font-semibold text-orange">
                — verdicts recorded now are marked as not blind
              </span>
            </>
          )}
        </span>
        <button
          onClick={() => setBlind((b) => !b)}
          className="shrink-0 rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-bold text-ink-soft transition hover:bg-cream-dark"
        >
          {blind ? "Switch to quick review (shows AI verdict first)" : "Return to blind review"}
        </button>
      </div>

      <ul className="divide-y divide-line">
      {attempts.map((a) => {
        const reviewed = reviews[a.id];
        // The specialist's own verdict, recovered from the stored agreement:
        // they agreed with a "correct" verdict, or disagreed with a wrong one.
        const readCorrectly = reviewed === undefined ? undefined : reviewed === a.correct;
        const show = revealed(a.id);
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
              {/*
                Everything the machine concluded lives behind `revealed`. Not
                dimmed, not collapsed — absent from the markup, because a panel
                hidden with CSS is still on the page and still anchoring, and
                because a test that checks for it should be checking the
                response body rather than a class name.
              */}
              {!show ? (
                <p className="text-sm font-semibold text-ink-muted">
                  {/* Both gaps are explicit rather than relying on the literal
                      space after the tag, which was being dropped here: this
                      rendered "read talocorrectly". A visually identical
                      construction elsewhere in the specialist UI keeps its
                      space, so the precise trigger is not established — writing
                      the separator out removes the question either way, and it
                      is the same guard already used before the word. */}
                  Play the recording, then say whether the learner read{" "}
                  <span className="font-bold text-ink">{a.target}</span>{" "}
                  correctly. The system&apos;s reading is hidden until you decide.
                </p>
              ) : (
                <>
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
                </>
              )}
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                {/* On a probe the machine verdict is greyed rather than hidden.
                    It is real data — pairing it with a human verdict is how the
                    study learns how far it can be trusted — but showing it in
                    the usual green/red would invite the specialist to simply
                    ratify it, which would make the pair worthless. */}
                {show && (
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
                )}
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
                {show && a.engine && (
                  <span className="inline-block rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">
                    {ENGINE_LABELS[a.engine] ?? a.engine}
                  </span>
                )}
                {/* How close the reading was to the target — the number the
                    accept/reject decision was actually made on, and the single
                    most anchoring thing on the row. */}
                {show && (
                  <span
                    className="inline-block rounded-full bg-cream px-2 py-0.5 text-xs font-bold text-ink-muted"
                    title="Similarity to the target word"
                  >
                    {a.score.toFixed(2)}
                  </span>
                )}
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

            {/*
              Shown only once a verdict exists, and only for a misreading.
              Offering categories before the judgement would be a second way to
              anchor it, and a child who read the word correctly has nothing to
              categorise.

              "Observe" rather than "hear" because the list is not all errors:
              self-correction is a reading behaviour that ends in the right
              word. Never required — a specialist who is unsure leaves it, and a
              blank is honest missing data where a forced guess would be noise.
            */}
            {readCorrectly === false && (
              <div className="w-full border-t border-line pt-2.5 pl-1">
                <p className="text-xs font-bold text-ink-muted">
                  What did you observe?{" "}
                  <span className="font-semibold">optional — skip if unsure</span>
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {ERROR_TAGS.map((t) => {
                    const on = (tags[a.id] ?? []).includes(t.id);
                    return (
                      <li key={t.id}>
                        <button
                          onClick={() => toggleTag(a.id, t.id)}
                          disabled={busy === a.id}
                          aria-pressed={on}
                          title={t.hintEn}
                          className={`rounded-full border px-2.5 py-1 text-xs font-bold transition disabled:opacity-50 ${
                            on
                              ? t.kind === "behaviour"
                                ? "border-primary bg-primary-soft text-primary"
                                : "border-peach-deep bg-peach-soft text-peach-deep"
                              : "border-line bg-white text-ink-muted hover:border-ink-muted hover:text-ink"
                          }`}
                        >
                          {t.en}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
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
    </>
  );
}
