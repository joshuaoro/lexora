import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck, Download } from "lucide-react";
import { requireSpecialist } from "@/lib/guards";
import { prisma } from "@/lib/db";
import LearnerReport from "@/components/LearnerReport";
import PrintButton from "@/components/PrintButton";
import LearnerControls from "@/components/specialist/LearnerControls";
import LearnerDataControls from "@/components/specialist/LearnerDataControls";
import ReviewList, { type ReviewableAttempt } from "@/components/specialist/ReviewList";

export default async function LearnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSpecialist();
  const { id } = await params;

  const profile = await prisma.learnerProfile.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!profile) notFound();

  const [attempts, reviewStats, words, practiceItems, recordingCount] = await Promise.all([
    prisma.attempt.findMany({
      where: { learnerId: id, activityType: { in: ["READ_ALOUD", "PRACTICE"] } },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { review: { select: { agrees: true, note: true } } },
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
  ]);

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
    hasAudio: Boolean(a.audio),
    audio: a.audio,
    engine: a.engine,
    altTranscript: a.altTranscript,
    review: a.review,
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/specialist"
        className="no-print inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
      >
        <ArrowLeft size={16} /> All learners
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
            <Download size={16} /> Attempts CSV
          </a>
          <a
            href={`/api/export?what=sessions&learnerId=${profile.id}`}
            className="flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-cream-dark"
          >
            <Download size={16} /> Sessions CSV
          </a>
          <PrintButton />
        </div>
      </div>

      {/* Specialist controls */}
      <section className="no-print mt-5 rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-extrabold text-ink">Intervention controls</h2>
        <LearnerControls learnerId={profile.id} currentLevel={profile.level} words={words} />
        {practiceItems.length > 0 && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
              Current practice list
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {practiceItems.map((p) => (
                <span key={p.id} className="rounded-full bg-cream px-3 py-1 text-sm font-bold text-ink">
                  {p.word.text}
                  <span className="ml-1.5 text-xs font-semibold text-ink-muted">
                    {p.source === "SPECIALIST" ? "pinned" : `×${p.missCount}`}
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
              <ShieldCheck size={20} className="text-primary" /> Scoring reliability check
            </h2>
            <p className="text-sm font-semibold text-ink-muted">
              Replay recorded readings and confirm or dispute the system&apos;s scoring.
            </p>
          </div>
          <div className="rounded-2xl bg-primary-soft px-5 py-3 text-center">
            <p className="text-2xl font-extrabold text-primary">
              {agreementPct === null ? "—" : `${agreementPct}%`}
            </p>
            <p className="text-xs font-bold text-ink-soft">
              specialist–system agreement ({reviewed} reviewed)
            </p>
          </div>
        </div>
        <div className="mt-4">
          <ReviewList attempts={reviewable} />
        </div>
      </section>

      {/* Full progress report */}
      <div className="mt-5">
        <LearnerReport learnerId={profile.id} />
      </div>

      <LearnerDataControls
        learnerId={profile.id}
        learnerName={profile.user.name}
        recordingCount={recordingCount}
      />
    </div>
  );
}
