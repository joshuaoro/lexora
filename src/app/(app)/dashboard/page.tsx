import Link from "next/link";
import { BookOpen, Mic, Target, Clock, Award, ListChecks } from "lucide-react";
import { requireLearner } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { getLang } from "@/lib/lang";
import { getDict } from "@/lib/i18n";
import { learnerSummary, dailyAccuracy } from "@/lib/stats";
import StatCard from "@/components/StatCard";
import AccuracyLine from "@/components/charts/AccuracyLine";

export default async function DashboardPage() {
  const { profile, ...session } = await requireLearner();
  const dict = getDict(await getLang());

  const [summary, series, tricky, recent] = await Promise.all([
    learnerSummary(session.learnerId),
    dailyAccuracy(session.learnerId, 14),
    prisma.practiceItem.findMany({
      where: { learnerId: session.learnerId, mastered: false },
      orderBy: { missCount: "desc" },
      take: 5,
      include: { word: true },
    }),
    prisma.activitySession.findMany({
      where: { learnerId: session.learnerId, total: { gt: 0 } },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-ink-muted">{dict.common.welcomeBack}</p>
          <h1 className="text-3xl font-extrabold text-ink">
            {session.name} <span aria-hidden>👋</span>
          </h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full bg-peach-soft px-3 py-1 text-xs font-bold text-peach-deep">
              {dict.common.learnerBadge}
            </span>
            <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">
              {dict.common.levelChip(profile.level, profile.stage)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link
            href="/reader"
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-bold text-white shadow-sm transition hover:bg-primary-dark"
          >
            <BookOpen size={18} /> {dict.dashboard.startReading}
          </Link>
          <Link
            href="/exercises"
            className="flex items-center gap-2 rounded-xl border border-line bg-card px-5 py-2.5 font-bold text-ink transition hover:bg-cream-dark"
          >
            <Mic size={18} /> {dict.dashboard.practiceAloud}
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Target} tone="blue" value={`${summary.overallAccuracy}%`} label={dict.dashboard.overallAccuracy} />
        <StatCard icon={BookOpen} tone="peach" value={`${summary.wordsRead14}`} label={dict.dashboard.wordsRead} />
        <StatCard icon={Clock} tone="orange" value={`${summary.minutesPracticed}`} label={dict.dashboard.minutesPracticed} />
        <StatCard icon={Award} tone="green" value={`${summary.activitiesCompleted}`} label={dict.dashboard.activitiesCompleted} />
      </div>

      {/* Chart + trickiest words */}
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
        <section className="rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-extrabold text-ink">{dict.dashboard.chartTitle}</h2>
          <p className="mb-4 text-sm font-semibold text-ink-muted">{dict.dashboard.chartSub}</p>
          <AccuracyLine data={series} />
        </section>

        <section className="rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink">
            <ListChecks size={20} className="text-primary" /> {dict.dashboard.tricky}
          </h2>
          <p className="text-sm font-semibold text-ink-muted">{dict.dashboard.trickySub}</p>

          {tricky.length === 0 ? (
            <p className="mt-4 text-sm text-ink-soft">{dict.dashboard.trickyEmpty}</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {tricky.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between rounded-xl bg-cream px-4 py-2.5"
                >
                  <span className="text-lg font-bold text-ink">{item.word.text}</span>
                  <span className="rounded-full bg-red-soft px-2.5 py-0.5 text-xs font-bold text-red">
                    {dict.dashboard.missed(item.missCount)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/practice"
            className="mt-4 inline-block text-sm font-bold text-primary hover:underline"
          >
            {dict.dashboard.openPractice}
          </Link>
        </section>
      </div>

      {/* Recent activity */}
      <section className="mt-5 rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-extrabold text-ink">{dict.dashboard.recent}</h2>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">{dict.dashboard.recentEmpty}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {recent.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-bold text-ink">{dict.activity[s.type] ?? s.type}</p>
                  <p className="text-xs font-semibold text-ink-muted">
                    {s.createdAt.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                {/* The Reader is listening practice, so it has no score. */}
                {s.type === "READER" ? (
                  <span className="shrink-0 rounded-full bg-primary-soft px-3 py-1 text-sm font-bold text-primary">
                    {dict.dashboard.wordsHeard(s.total)}
                  </span>
                ) : (
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${
                      s.total > 0 && s.correct / s.total >= 0.7
                        ? "bg-green-soft text-green"
                        : "bg-orange-soft text-orange"
                    }`}
                  >
                    {dict.dashboard.scoreChip(s.correct, s.total)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
