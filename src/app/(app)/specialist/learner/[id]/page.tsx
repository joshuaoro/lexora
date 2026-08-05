import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck, Download, Sparkles } from "lucide-react";
import { requireSpecialist } from "@/lib/guards";
import { prisma } from "@/lib/db";
import LearnerReport from "@/components/LearnerReport";
import PrintButton from "@/components/PrintButton";
import LearnerControls from "@/components/specialist/LearnerControls";
import LearnerDataControls from "@/components/specialist/LearnerDataControls";
import ThresholdCalibration from "@/components/specialist/ThresholdCalibration";
import SessionPhases, { type PhaseSession } from "@/components/specialist/SessionPhases";
import SelfCorrection, { type CorrectionPair } from "@/components/specialist/SelfCorrection";
import ReviewList, { type ReviewableAttempt } from "@/components/specialist/ReviewList";
import { activeScoreThreshold } from "@/lib/scoring";
import { isScoredActivity } from "@/lib/activity";
import { getLang } from "@/lib/lang";
import { getDict } from "@/lib/i18n";
import { retentionDays } from "@/lib/retention-policy";

/** How far below the threshold still counts as a borderline reading. */
const BORDERLINE_BAND = 0.15;

export default async function LearnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSpecialist();
  const { id } = await params;
  const lang = await getLang();
  const t = getDict(lang).specialist;

  const profile = await prisma.learnerProfile.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!profile) notFound();

  const [
    attempts,
    withRecording,
    reviewStats,
    words,
    practiceItems,
    recordingCount,
    borderline,
    retryRows,
    sessionRows,
    probeRows,
  ] = await Promise.all([
    // First readings only. A retry is taken seconds after the child heard the
    // word pronounced, so it skews clear and correct; including retries would
    // bias the agreement sample toward easy cases and overstate how well the
    // scorer performs on the readings the study actually measures.
    prisma.attempt.findMany({
      where: {
        learnerId: id,
        activityType: { in: ["READ_ALOUD", "PRACTICE"] },
        isRetry: false,
      },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        target: true,
        transcript: true,
        correct: true,
        errorType: true,
        activityType: true,
        createdAt: true,
        engine: true,
        altTranscript: true,
        score: true,
        review: { select: { agrees: true, note: true } },
        word: { select: { stressNote: true } },
      },
    }),
    // Which of them have a recording, without carrying the recordings.
    prisma.attempt.findMany({
      where: { learnerId: id, audio: { not: null } },
      select: { id: true },
    }),
    prisma.attemptReview.groupBy({
      by: ["agrees"],
      where: { attempt: { learnerId: id } },
      _count: true,
    }),
    prisma.word.findMany({ orderBy: { text: "asc" }, select: { id: true, text: true } }),
    prisma.practiceItem.findMany({
      where: { learnerId: id, mastered: false },
      orderBy: { missCount: "desc" },
      include: { word: true },
      take: 12,
    }),
    prisma.attempt.count({ where: { learnerId: id, audio: { not: null } } }),
    // Readings that fell just short of being accepted — the evidence for
    // whether the threshold sits in the right place.
    prisma.attempt.findMany({
      where: {
        learnerId: id,
        activityType: { in: ["READ_ALOUD", "PRACTICE"] },
        isRetry: false,
        correct: false,
        score: { gte: activeScoreThreshold() - BORDERLINE_BAND, lt: activeScoreThreshold() },
      },
      orderBy: { score: "desc" },
      take: 15,
      select: {
        id: true,
        target: true,
        transcript: true,
        correct: true,
        errorType: true,
        activityType: true,
        createdAt: true,
        engine: true,
        altTranscript: true,
        score: true,
        review: { select: { agrees: true, note: true } },
        word: { select: { stressNote: true } },
      },
    }),
    // Re-reads, newest first. Each is paired below with the miss it followed.
    prisma.attempt.findMany({
      where: { learnerId: id, isRetry: true },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        target: true,
        correct: true,
        transcript: true,
        createdAt: true,
        sessionId: true,
        // No audio column: the clip is streamed by /api/attempt-audio on play.
      },
    }),
    // Completed sessions only — an abandoned one is not a data point to tag.
    prisma.activitySession.findMany({
      where: { learnerId: id, total: { gt: 0 } },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { id: true, createdAt: true, type: true, total: true, correct: true, phase: true },
    }),
    // Probe readings, awaiting or carrying a specialist verdict. Ordered oldest
    // first within the page so a baseline sitting is reviewed in the order the
    // child read it.
    prisma.attempt.findMany({
      where: { learnerId: id, activityType: "PSEUDO_PROBE", isRetry: false },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        target: true,
        transcript: true,
        correct: true,
        errorType: true,
        activityType: true,
        createdAt: true,
        engine: true,
        altTranscript: true,
        score: true,
        review: { select: { agrees: true, note: true } },
        session: { select: { phase: true } },
      },
    }),
  ]);

  // Pair each re-read with the failed reading it followed: the same word, in
  // the same session, immediately before it. Matching on the word rather than
  // on an explicit link keeps the schema simple and is unambiguous in practice,
  // because the re-read is offered the instant the word is missed.
  const firstReadings = retryRows.length
    ? await prisma.attempt.findMany({
        where: {
          learnerId: id,
          isRetry: false,
          correct: false,
          target: { in: [...new Set(retryRows.map((r) => r.target))] },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, target: true, transcript: true, createdAt: true, sessionId: true },
      })
    : [];

  const corrections: CorrectionPair[] = retryRows.map((r) => {
    const first = firstReadings.find(
      (f) => f.target === r.target && f.sessionId === r.sessionId && f.createdAt <= r.createdAt
    );
    return {
      id: r.id,
      word: r.target,
      date: r.createdAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
      firstHeard: first?.transcript ?? null,
      firstAudioId: first?.id ?? null,
      retryCorrect: r.correct,
      retryHeard: r.transcript,
      retryAudioId: r.id,
    };
  });

  const phaseSessions: PhaseSession[] = sessionRows.map((s) => ({
    id: s.id,
    date: s.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    type: s.type.replace(/_/g, " ").toLowerCase(),
    total: s.total,
    correct: s.correct,
    phase: s.phase,
    scored: isScoredActivity(s.type),
  }));

  const recorded = new Set(withRecording.map((a) => a.id));

  const reviewed = reviewStats.reduce((n, g) => n + g._count, 0);
  const agreed = reviewStats.find((g) => g.agrees)?._count ?? 0;
  const agreementPct = reviewed ? Math.round((agreed / reviewed) * 100) : null;

  const reviewable: ReviewableAttempt[] = attempts.map((a) => ({
    id: a.id,
    target: a.target,
    transcript: a.transcript,
    correct: a.correct,
    errorType: a.errorType,
    activityType: a.activityType,
    createdAt: a.createdAt.toISOString(),
    hasAudio: recorded.has(a.id),
    engine: a.engine,
    altTranscript: a.altTranscript,
    score: a.score,
    review: a.review,
    stressNote: a.word?.stressNote ?? null,
  }));

  const borderlineAttempts: ReviewableAttempt[] = borderline.map((a) => ({
    id: a.id,
    target: a.target,
    transcript: a.transcript,
    correct: a.correct,
    errorType: a.errorType,
    activityType: a.activityType,
    createdAt: a.createdAt.toISOString(),
    hasAudio: recorded.has(a.id),
    engine: a.engine,
    altTranscript: a.altTranscript,
    score: a.score,
    review: a.review,
    stressNote: a.word?.stressNote ?? null,
  }));

  const probeAttempts: ReviewableAttempt[] = probeRows.map((a) => ({
    id: a.id,
    target: a.target,
    transcript: a.transcript,
    correct: a.correct,
    errorType: a.errorType,
    activityType: a.activityType,
    createdAt: a.createdAt.toISOString(),
    hasAudio: recorded.has(a.id),
    engine: a.engine,
    altTranscript: a.altTranscript,
    score: a.score,
    review: a.review,
  }));

  // The probe result is the specialist's count, not the system's — and it is
  // only meaningful once they have listened. Unreviewed items are reported as
  // outstanding rather than folded in as either correct or incorrect.
  const probeReviewed = probeRows.filter((a) => a.review !== null);
  const probeCorrect = probeReviewed.filter((a) => a.review!.agrees === a.correct).length;
  const probeAccuracy = probeReviewed.length
    ? Math.round((probeCorrect / probeReviewed.length) * 100)
    : null;
  const probePending = probeRows.length - probeReviewed.length;

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/specialist"
        className="no-print inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
      >
        <ArrowLeft size={16} /> {t.allLearners}
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-ink">{profile.user.name}</h1>
          <p className="mt-1 text-sm font-semibold text-ink-muted">
            {profile.user.email} · Level {profile.level} · Marungko stage {profile.stage}
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2.5">
          <a
            href={`/api/export?what=attempts&learnerId=${profile.id}`}
            className="flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-cream-dark"
          >
            <Download size={16} /> {t.attemptsCsv}
          </a>
          <a
            href={`/api/export?what=sessions&learnerId=${profile.id}`}
            className="flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-cream-dark"
          >
            <Download size={16} /> {t.sessionsCsv}
          </a>
          <PrintButton />
        </div>
      </div>

      {/* Specialist controls */}
      <section className="no-print mt-5 rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-extrabold text-ink">{t.interventionControls}</h2>
        <LearnerControls learnerId={profile.id} currentLevel={profile.level} words={words} lang={lang} />
        {practiceItems.length > 0 && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
              {t.currentPracticeList}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {practiceItems.map((p) => (
                <span key={p.id} className="rounded-full bg-cream px-3 py-1 text-sm font-bold text-ink">
                  {p.word.text}
                  <span className="ml-1.5 text-xs font-semibold text-ink-muted">
                    {p.source === "SPECIALIST" ? t.pinned : `×${p.missCount}`}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Scoring reliability check */}
      <section className="no-print mt-5 rounded-2xl border border-line bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink">
              <ShieldCheck size={20} className="text-primary" /> {t.reliabilityCheck}
            </h2>
            <p className="text-sm font-semibold text-ink-muted">
              {t.reliabilitySub}
            </p>
          </div>
          <div className="rounded-2xl bg-primary-soft px-5 py-3 text-center">
            <p className="text-2xl font-extrabold text-primary">
              {agreementPct === null ? "—" : `${agreementPct}%`}
            </p>
            <p className="text-xs font-bold text-ink-soft">
              {t.agreementChip(reviewed)}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <ReviewList attempts={reviewable} />
        </div>
      </section>

      {/* Decoding probe — non-word reading, scored by ear */}
      <section className="no-print mt-5 rounded-2xl border border-line bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-2xl">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink">
              <Sparkles size={20} className="text-peach-deep" /> {t.probeTitle}
            </h2>
            <p className="text-sm font-semibold text-ink-muted">
              {t.probeSub}
            </p>
          </div>
          <div className="rounded-2xl bg-peach-soft px-5 py-3 text-center">
            <p className="text-2xl font-extrabold text-peach-deep">
              {probeAccuracy === null ? "—" : `${probeAccuracy}%`}
            </p>
            <p className="text-xs font-bold text-ink-soft">
              {t.probeChip(probeReviewed.length, probePending)}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <ReviewList attempts={probeAttempts} mode="probe" />
        </div>
      </section>

      <ThresholdCalibration
        attempts={borderlineAttempts}
        threshold={activeScoreThreshold()}
        band={BORDERLINE_BAND}
      />

      <SelfCorrection pairs={corrections} />

      <SessionPhases sessions={phaseSessions} />

      {/* Full progress report */}
      <div className="mt-5">
        <LearnerReport learnerId={profile.id} lang={lang} />
      </div>

      <LearnerDataControls
        learnerId={profile.id}
        learnerName={profile.user.name}
        recordingCount={recordingCount}
        retentionNote={
          retentionDays() === 0
            ? "Automatic deletion is switched off, so recordings are kept until you clear them."
            : `Recordings are also deleted automatically once they are ${retentionDays()} days old.`
        }
      />
    </div>
  );
}
