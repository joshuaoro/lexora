import Link from "next/link";
import { BookOpen, Mic, Target, Clock, Award, ListChecks, Star } from "lucide-react";
import { requireLearner } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { getLang } from "@/lib/lang";
import { getDict } from "@/lib/i18n";
import { learnerSummary, dailyAccuracy, practiceStreak } from "@/lib/stats";
import StatCard from "@/components/StatCard";
import AccuracyLine from "@/components/charts/AccuracyLine";
import SpeakButton from "@/components/SpeakButton";

/**
 * The learner's landing screen.
 *
 * Two audiences share it and they do not want the same thing. A child of seven
 * with dyslexia needs to know what to do next; percentages, a fourteen-day line
 * chart and a list reading "0/1 correct" are not that, and leading with a
 * failure tally is a poor thing to show a child about themselves first thing.
 *
 * So the top of the page is the child's: a greeting that can be read aloud,
 * a streak they can understand, and two large ways in. The analytics are still
 * here, in full, below — they are one of the study's objectives and the
 * specialist and family read them — but they no longer speak first.
 */
const STREAK_STARS = 5;

export default async function DashboardPage() {
  const { profile, ...session } = await requireLearner();
  const lang = await getLang();
  const dict = getDict(lang);
  const t = dict.dashboard;

  const [summary, series, tricky, recent, streak] = await Promise.all([
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
    practiceStreak(session.learnerId),
  ]);

  const greeting = t.hello(session.name);
  const streakLine = streak > 0 ? t.streak(streak) : t.streakNone;

  return (
    <div className="mx-auto max-w-6xl">
      {/* ── The child's half ─────────────────────────────────────────────── */}
      <section className="rounded-3xl border border-line bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">
              {greeting} <span aria-hidden>👋</span>
            </h1>
            <div
              className="mt-3 flex items-center gap-2"
              role="img"
              aria-label={streakLine}
            >
              {Array.from({ length: STREAK_STARS }, (_, i) => (
                <Star
                  key={i}
                  size={26}
                  className={i < Math.min(streak, STREAK_STARS) ? "fill-orange text-orange" : "text-line"}
                />
              ))}
              <span className="ml-1 text-sm font-bold text-ink-soft">{streakLine}</span>
            </div>
          </div>
          <SpeakButton
            text={`${greeting} ${streakLine}`}
            lang={lang}
            label={dict.session.listen}
          />
        </div>

        {/* Two ways in, sized for a child rather than a toolbar. */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Link
            href="/exercises/read-aloud"
            className="group flex items-center gap-4 rounded-3xl bg-primary p-6 text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-primary-dark"
          >
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/20">
              <Mic size={32} strokeWidth={2.4} />
            </span>
            <span className="min-w-0">
              <span className="block text-2xl font-extrabold">{t.bigRead}</span>
              <span className="block text-sm font-semibold text-white/85">{t.bigReadSub}</span>
            </span>
          </Link>

          <Link
            href="/reader"
            className="group flex items-center gap-4 rounded-3xl bg-peach p-6 text-peach-deep shadow-sm transition hover:-translate-y-0.5 hover:opacity-95"
          >
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/40">
              <BookOpen size={32} strokeWidth={2.4} />
            </span>
            <span className="min-w-0">
              <span className="block text-2xl font-extrabold">{t.bigListen}</span>
              {/* Not peach-deep at 80%: that measures 3.18:1 on this tile and
                  fails AA. Full peach-deep only reaches 4.51:1, which passes by
                  a hair — ink-soft gives 5.97:1 and room to spare, which is the
                  right side of the line to be on in an app for children who
                  find reading hard. */}
              <span className="block text-sm font-semibold text-ink-soft">{t.bigListenSub}</span>
            </span>
          </Link>
        </div>

        {/* Practice words, framed as work to do rather than a tally of misses. */}
        <div className="mt-6">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink">
            <ListChecks size={20} className="text-primary" /> {t.practiseTitle}
          </h2>
          <p className="text-sm font-semibold text-ink-muted">{t.practiseSub}</p>

          {tricky.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">{t.practiseEmpty}</p>
          ) : (
            <>
              <ul className="mt-3 flex flex-wrap gap-2">
                {tricky.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-2xl bg-cream px-4 py-2.5 text-xl font-bold text-ink"
                  >
                    {item.word.text}
                  </li>
                ))}
              </ul>
              <Link
                href="/practice"
                className="mt-3 inline-block text-sm font-bold text-primary hover:underline"
              >
                {t.openPractice}
              </Link>
            </>
          )}
        </div>
      </section>

      {/* ── The grown-ups' half ──────────────────────────────────────────── */}
      <section className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-extrabold text-ink">{t.yourProgress}</h2>
          <p className="text-sm font-semibold text-ink-muted">{t.yourProgressSub}</p>
        </div>
        <span className="mt-2 inline-block rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">
          {dict.common.levelChip(profile.level, profile.stage)}
        </span>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Target} tone="blue" value={`${summary.overallAccuracy}%`} label={t.overallAccuracy} />
          <StatCard icon={BookOpen} tone="peach" value={`${summary.wordsRead14}`} label={t.wordsRead} />
          <StatCard icon={Clock} tone="orange" value={`${summary.minutesPracticed}`} label={t.minutesPracticed} />
          <StatCard icon={Award} tone="green" value={`${summary.activitiesCompleted}`} label={t.activitiesCompleted} />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
          <div className="rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
            <h3 className="text-lg font-extrabold text-ink">{t.chartTitle}</h3>
            <p className="mb-4 text-sm font-semibold text-ink-muted">{t.chartSub}</p>
            <AccuracyLine data={series} />
          </div>

          <div className="rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
            <h3 className="text-lg font-extrabold text-ink">{t.recent}</h3>
            {recent.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">{t.recentEmpty}</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {recent.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
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
                        {t.wordsHeard(s.total)}
                      </span>
                    ) : (
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${
                          s.total > 0 && s.correct / s.total >= 0.7
                            ? "bg-green-soft text-green"
                            : "bg-orange-soft text-orange"
                        }`}
                      >
                        {t.scoreChip(s.correct, s.total)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
