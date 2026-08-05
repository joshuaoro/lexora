import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { patternFamily as patternFamilyFor, PLAUSIBLE, median } from "@/lib/stats";

/**
 * CSV export of learner data for statistical treatment.
 *
 *   /api/export?what=attempts[&learnerId=...]  — raw word-level attempts
 *   /api/export?what=sessions[&learnerId=...]  — completed activity sessions
 *   /api/export?what=summary                   — per-learner aggregate summary
 *
 * Specialists can export everything; a learner may export only their own data.
 */

/**
 * An export at the end of the study walks every reading five children made.
 * The default budget is generous for that, but the whole point of the export is
 * that it works on the largest data set, not the smallest.
 */
export const maxDuration = 30;

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.join(","), ...rows.map((r) => r.map(csvCell).join(","))];
  // BOM so Excel opens UTF-8 correctly
  return "﻿" + lines.join("\r\n");
}

function csvResponse(csv: string, filename: string) {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

const stamp = () => new Date().toISOString().slice(0, 10);

/**
 * Build the download name.
 *
 * Every export used to be `lexora-attempts-2026-08-05.csv` regardless of who it
 * was for, so pulling one learner after another left a Downloads folder of
 * files with the same name and a string of "(1)", "(2)" suffixes — and no way
 * to tell whose data was in which. At the end of a study, with five children
 * and three export types, that is a genuine way to analyse the wrong file.
 *
 * The learner's name is slugified rather than interpolated: it comes from user
 * input and lands in a Content-Disposition header, where a quote or a newline
 * would let the filename break out of the header.
 */
function slug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .toLowerCase()
    .slice(0, 40);
}

function exportName(what: string, who: string | null): string {
  const scope = who ? slug(who) || "learner" : "all-learners";
  return `lexora-${what}-${scope}-${stamp()}.csv`;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const what = url.searchParams.get("what") ?? "attempts";
  let learnerId = url.searchParams.get("learnerId") ?? undefined;

  // Learners may only export their own records
  if (session.role !== "SPECIALIST") {
    if (!session.learnerId || what === "summary") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    learnerId = session.learnerId;
  }

  // Resolved once so every export type names its file the same way, including
  // the learner's own download of their own records.
  const scopedTo = learnerId
    ? (
        await prisma.learnerProfile.findUnique({
          where: { id: learnerId },
          select: { user: { select: { name: true } } },
        })
      )?.user.name ?? null
    : null;

  if (what === "attempts") {
    const scope = learnerId ? { learnerId } : {};

    // Every field is named rather than using `include`, which keeps all scalar
    // columns — and one of those columns is the base64 recording. The export
    // only needs to know whether audio exists, so loading it would drag every
    // recording in the study through a serverless function to compute a 1 or a
    // 0. At a thousand readings that is tens of megabytes, and it would fail
    // exactly when the data set is complete and the export matters most.
    const [attempts, withAudio] = await Promise.all([
      prisma.attempt.findMany({
        where: scope,
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          createdAt: true,
          activityType: true,
          target: true,
          transcript: true,
          engine: true,
          altTranscript: true,
          correct: true,
          score: true,
          errorType: true,
          responseMs: true,
          levelAtTime: true,
          isRetry: true,
          learner: { select: { user: { select: { name: true } } } },
          word: {
            select: {
              stage: true,
              level: true,
              pattern: true,
              syllables: true,
              isPseudo: true,
              stressNote: true,
            },
          },
          review: { select: { agrees: true } },
          session: { select: { phase: true } },
        },
      }),
      prisma.attempt.findMany({
        where: { ...scope, audio: { not: null } },
        select: { id: true },
      }),
    ]);
    const hasAudio = new Set(withAudio.map((a) => a.id));

    const rows = attempts.map((a) => [
      a.id,
      a.learner.user.name,
      a.createdAt.toISOString(),
      a.activityType,
      a.target,
      a.word?.syllables ?? "",
      a.word?.pattern ?? "",
      a.word ? patternFamilyFor(a.word.pattern, a.word.syllables) : "",
      a.word?.stage ?? "",
      a.word?.level ?? "",
      a.levelAtTime,
      a.transcript ?? "",
      a.engine ?? "",
      a.altTranscript ?? "",
      a.correct ? 1 : 0,
      a.score.toFixed(3),
      a.errorType ?? "",
      a.responseMs,
      hasAudio.has(a.id) ? 1 : 0,
      a.review ? (a.review.agrees ? "agree" : "disagree") : "",
      a.isRetry ? 1 : 0,
      a.session?.phase ?? "",
      a.word?.isPseudo ? 1 : 0,
      // The specialist's own verdict, recovered from their agreement with the
      // system. On probe items this is the only verdict worth analysing; the
      // machine's is recorded beside it in `correct` for the comparison.
      a.review ? (a.review.agrees === a.correct ? 1 : 0) : "",
      a.word?.stressNote ?? "",
    ]);

    return csvResponse(
      toCsv(
        [
          "attempt_id", "learner", "timestamp_iso", "activity_type", "target_word",
          "syllables", "pattern", "pattern_family", "word_stage", "word_level", "level_at_time",
          "transcript", "asr_engine", "alt_transcript", "correct", "similarity_score",
          "error_type", "response_ms", "has_audio", "specialist_review",
          // is_retry = 1 marks a second reading taken after the correct word was
          // modelled. Filter these out before computing accuracy: they measure
          // repetition, not decoding. study_phase tags the session as
          // BASELINE / REGULAR / ENDLINE for pre-post comparison.
          "is_retry", "study_phase",
          // is_pseudoword = 1 marks a made-up word from the decoding probe.
          // These carry no automatic verdict worth using — the recogniser
          // returns the nearest real word — so analyse them on
          // specialist_correct, which is blank until someone has listened.
          // Real-word rows carry it too, which is what makes human/machine
          // agreement comparable between the two kinds of item.
          "is_pseudoword", "specialist_correct",
          // Non-empty where the word's meaning depends on stress that Filipino
          // does not write. The transcript cannot distinguish the two readings,
          // so `correct` on these rows is not evidence about stress.
          "stress_pair",
        ],
        rows
      ),
      exportName("attempts", scopedTo)
    );
  }

  if (what === "sessions") {
    const sessions = await prisma.activitySession.findMany({
      where: { ...(learnerId ? { learnerId } : {}), total: { gt: 0 } },
      orderBy: { createdAt: "asc" },
      include: { learner: { include: { user: { select: { name: true } } } } },
    });

    const rows = sessions.map((s) => [
      s.id,
      s.learner.user.name,
      s.createdAt.toISOString(),
      s.type,
      s.total,
      s.correct,
      s.total ? ((s.correct / s.total) * 100).toFixed(1) : "",
      s.durationMs,
      s.levelAtTime,
      s.phase,
      s.completedAt ? 1 : 0,
    ]);

    return csvResponse(
      toCsv(
        // completed = 0 marks an activity the learner started and left partway.
        // The words they read are real data; the session is just not a finished
        // one, so exclude these when counting activities completed.
        ["session_id", "learner", "timestamp_iso", "activity_type", "items", "correct", "accuracy_pct", "duration_ms", "level_at_time", "study_phase", "completed"],
        rows
      ),
      exportName("sessions", scopedTo)
    );
  }

  if (what === "summary") {
    const learners = await prisma.learnerProfile.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { user: { name: "asc" } },
    });

    const rows = [];
    for (const l of learners) {
      // Every figure below is over first readings only; retries are counted
      // separately as self-correction so they can never inflate accuracy.
      const measured = { activityType: { in: ["READ_ALOUD", "PRACTICE"] }, isRetry: false };

      const [attempts, errorGroups, sessions, sessionsCompleted, practice, reviews, retries] =
        await Promise.all([
        prisma.attempt.groupBy({
          by: ["correct"],
          where: { learnerId: l.id, ...measured },
          _count: true,
        }),
        prisma.attempt.groupBy({
          by: ["errorType"],
          where: { learnerId: l.id, correct: false, ...measured },
          _count: true,
        }),
        // Minutes cover every session with work in it; the completed count only
        // those the learner reached the end of. Keeping them apart means time
        // on task is not lost to an activity that was abandoned partway.
        prisma.activitySession.aggregate({
          where: { learnerId: l.id, total: { gt: 0 } },
          _count: true,
          _sum: { durationMs: true },
        }),
        prisma.activitySession.count({
          where: { learnerId: l.id, completedAt: { not: null } },
        }),
        prisma.practiceItem.groupBy({ by: ["mastered"], where: { learnerId: l.id }, _count: true }),
        prisma.attemptReview.groupBy({
          by: ["agrees"],
          where: { attempt: { learnerId: l.id } },
          _count: true,
        }),
        prisma.attempt.groupBy({
          by: ["correct"],
          where: { learnerId: l.id, activityType: { in: ["READ_ALOUD", "PRACTICE"] }, isRetry: true },
          _count: true,
        }),
      ]);

      // Reported alongside accuracy rather than below it: Filipino is a
      // transparent orthography, and in transparent orthographies decoding
      // speed separates dyslexic from typical readers more reliably than
      // accuracy does. A summary that omits it omits half the outcome.
      const timed = await prisma.attempt.findMany({
        where: { learnerId: l.id, ...measured, correct: true, responseMs: PLAUSIBLE },
        select: { responseMs: true },
      });

      // Probe items, scored by the specialist. `agrees === correct` recovers
      // their verdict from the agreement that was stored.
      const probes = await prisma.attempt.findMany({
        where: { learnerId: l.id, activityType: "PSEUDO_PROBE", isRetry: false },
        select: { correct: true, review: { select: { agrees: true } } },
      });
      const probesScored = probes.filter((p) => p.review !== null);
      const probesCorrect = probesScored.filter((p) => p.review!.agrees === p.correct).length;

      const total = attempts.reduce((n, g) => n + g._count, 0);
      const correct = attempts.find((g) => g.correct)?._count ?? 0;
      const err = (type: string) => errorGroups.find((g) => g.errorType === type)?._count ?? 0;
      const reviewed = reviews.reduce((n, g) => n + g._count, 0);
      const agreed = reviews.find((g) => g.agrees)?._count ?? 0;
      const retriesTotal = retries.reduce((n, g) => n + g._count, 0);
      const retriesCorrect = retries.find((g) => g.correct)?._count ?? 0;

      rows.push([
        l.user.name,
        l.user.email,
        l.level,
        l.stage,
        total,
        correct,
        total ? ((correct / total) * 100).toFixed(1) : "",
        err("substitution"),
        err("omission"),
        err("insertion"),
        err("no_response"),
        sessionsCompleted,
        sessions._count - sessionsCompleted,
        Math.round((sessions._sum.durationMs ?? 0) / 60000),
        practice.find((g) => !g.mastered)?._count ?? 0,
        practice.find((g) => g.mastered)?._count ?? 0,
        reviewed,
        agreed,
        reviewed ? ((agreed / reviewed) * 100).toFixed(1) : "",
        retriesTotal,
        retriesCorrect,
        retriesTotal ? ((retriesCorrect / retriesTotal) * 100).toFixed(1) : "",
        median(timed.map((a) => a.responseMs)) ?? "",
        timed.length,
        probes.length,
        probesScored.length,
        probesCorrect,
        probesScored.length ? ((probesCorrect / probesScored.length) * 100).toFixed(1) : "",
      ]);
    }

    return csvResponse(
      toCsv(
        [
          "learner", "email", "level", "marungko_stage",
          "oral_attempts", "oral_correct", "oral_accuracy_pct",
          "substitution", "omission", "insertion", "no_response",
          "sessions_completed", "sessions_partial", "minutes_practiced",
          "practice_words_active", "practice_words_mastered",
          "attempts_reviewed", "reviews_agreed", "agreement_pct",
          // Self-correction: how often a second reading, taken after the word
          // was modelled, came out right. Reported apart from accuracy.
          "retries", "retries_correct", "retry_success_pct",
          // Decoding latency: the median milliseconds a correct single-word
          // reading takes, over `timed_readings` first attempts. Treat as a
          // co-primary outcome with accuracy, not a secondary one — see the
          // note above the query.
          "median_decode_ms", "timed_readings",
          // Non-word decoding probe, scored by ear by a reading specialist.
          // pseudo_scored is the denominator: unreviewed items are neither
          // correct nor incorrect and must not be counted as either.
          "pseudo_items", "pseudo_scored", "pseudo_correct", "pseudo_accuracy_pct",
        ],
        rows
      ),
      exportName("summary", scopedTo)
    );
  }

  return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
}
