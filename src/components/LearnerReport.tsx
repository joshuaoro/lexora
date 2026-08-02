import { prisma } from "@/lib/db";
import {
  learnerSummary,
  dailyAccuracy,
  errorPatterns,
  accuracyByLevel,
  accuracyByStage,
} from "@/lib/stats";
import { getDict, type Lang } from "@/lib/i18n";
import AccuracyLine from "@/components/charts/AccuracyLine";
import BarBlock from "@/components/charts/BarBlock";

/** Shared progress report — used by the learner's Reports page and the specialist's learner view. */
export default async function LearnerReport({
  learnerId,
  lang = "en",
}: {
  learnerId: string;
  lang?: Lang;
}) {
  const dict = getDict(lang);
  const t = dict.reports;

  const [summary, series, errors, byLevel, byStage, sessions] = await Promise.all([
    learnerSummary(learnerId),
    dailyAccuracy(learnerId, 14),
    errorPatterns(learnerId),
    accuracyByLevel(learnerId),
    accuracyByStage(learnerId),
    prisma.activitySession.findMany({
      where: { learnerId, total: { gt: 0 } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const chip = (label: string, value: string) => (
    <div className="rounded-2xl border border-line bg-card px-5 py-4 shadow-sm">
      <p className="text-2xl font-extrabold text-ink">{value}</p>
      <p className="text-sm font-semibold text-ink-muted">{label}</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {chip(dict.dashboard.overallAccuracy, `${summary.overallAccuracy}%`)}
        {chip(dict.dashboard.wordsRead, `${summary.wordsRead14}`)}
        {chip(dict.dashboard.minutesPracticed, `${summary.minutesPracticed}`)}
        {chip(dict.dashboard.activitiesCompleted, `${summary.activitiesCompleted}`)}
      </div>

      <section className="rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-extrabold text-ink">{t.accuracy14}</h2>
        <p className="mb-4 text-sm font-semibold text-ink-muted">{t.accuracy14Sub}</p>
        <AccuracyLine data={series} />
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-extrabold text-ink">{t.byLevel}</h2>
          <p className="mb-4 text-sm font-semibold text-ink-muted">{t.byLevelSub}</p>
          <BarBlock
            ariaLabel={t.byLevel}
            data={byLevel.map((d) => ({
              label: d.level,
              value: d.accuracy,
              hint: t.attempts(d.attempts),
            }))}
            suffix="%"
            max={100}
          />
        </section>

        <section className="rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-extrabold text-ink">{t.byStage}</h2>
          <p className="mb-4 text-sm font-semibold text-ink-muted">{t.byStageSub}</p>
          <BarBlock
            ariaLabel={t.byStage}
            data={byStage.map((d) => ({
              label: d.stage.replace("Stage ", "S"),
              value: d.accuracy,
              hint: t.attempts(d.attempts),
            }))}
            suffix="%"
            max={100}
          />
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-extrabold text-ink">{t.errors}</h2>
          <p className="mb-4 text-sm font-semibold text-ink-muted">{t.errorsSub}</p>
          <BarBlock
            ariaLabel={t.errors}
            data={errors.map((d) => ({ label: d.type, value: d.count }))}
          />
        </section>

        <section className="rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-extrabold text-ink">{t.recentActivities}</h2>
          {sessions.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">{t.noActivities}</p>
          ) : (
            <table className="mt-3 w-full text-left text-sm">
              <thead>
                <tr className="text-xs font-bold uppercase tracking-wide text-ink-muted">
                  <th className="pb-2">{t.date}</th>
                  <th className="pb-2">{t.activity}</th>
                  <th className="pb-2 text-right">{t.score}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2.5 font-semibold text-ink-soft">
                      {s.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                    <td className="py-2.5 font-bold text-ink">
                      {dict.activity[s.type] ?? s.type}
                    </td>
                    <td className="py-2.5 text-right font-bold text-ink">
                      {s.type === "READER" ? `${s.total} heard` : `${s.correct}/${s.total}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
