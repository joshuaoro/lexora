import Link from "next/link";
import { ArrowLeft, Download, Users } from "lucide-react";
import { requireSpecialist } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { patternFamily } from "@/lib/stats";
import { getLang } from "@/lib/lang";
import { getDict } from "@/lib/i18n";
import { learnerScope, includeDemoFromParams } from "@/lib/demo";
import DemoToggle from "@/components/specialist/DemoToggle";
import { divergence } from "@/lib/divergence";
import DivergencePanel from "@/components/specialist/DivergencePanel";
import { phaseComparison } from "@/lib/phases";
import PhaseComparison from "@/components/specialist/PhaseComparison";

/**
 * Every learner on one screen.
 *
 * The per-learner pages answer "how is this child doing"; the study also has to
 * answer "what is this group finding hard", and reading that off five separate
 * pages invites the eye to average things it should not. Grouping the same
 * measures side by side makes the shared difficulty visible — if four of five
 * children fail on consonant clusters, that is a finding about the
 * intervention, not about any one child.
 *
 * Retries are excluded throughout, as everywhere else: a reading taken after
 * the word was modelled is repetition, not decoding.
 */

const MEASURED = { activityType: { in: ["READ_ALOUD", "PRACTICE"] }, isRetry: false };

function pct(correct: number, total: number) {
  return total ? Math.round((correct / total) * 100) : null;
}

function accuracyTone(value: number | null) {
  if (value === null) return "text-ink-muted";
  if (value >= 70) return "bg-green-soft text-green";
  if (value >= 50) return "bg-orange-soft text-orange";
  return "bg-red-soft text-red";
}

export default async function CohortPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSpecialist();
  const includeDemo = includeDemoFromParams(await searchParams);
  const lang = await getLang();
  const t = getDict(lang).specialist;

  // Filtering here is enough: every query below is scoped by `learnerId in ids`,
  // so excluding a learner from this list removes them from every figure on the
  // page. Demo learners carry fabricated readings — see src/lib/demo.ts.
  const learners = await prisma.learnerProfile.findMany({
    where: learnerScope(includeDemo),
    include: { user: { select: { name: true } } },
    orderBy: { user: { name: "asc" } },
  });
  const ids = learners.map((l) => l.id);
  // Shown on the toggle so a specialist knows how much is being held back.
  const demoCount = await prisma.learnerProfile.count({ where: { isDemo: true } });
  // Across the cohort: if four of five children read real words far better
  // than non-words, that is a finding about the intervention rather than
  // about any one learner.
  const [cohortDivergence, cohortPhases] = await Promise.all([
    divergence(undefined, { includeDemo }),
    phaseComparison(undefined, { includeDemo }),
  ]);

  const [accGroups, errorGroups, sessionGroups, patternRows, practiceGroups] = await Promise.all([
    prisma.attempt.groupBy({
      by: ["learnerId", "correct"],
      where: { learnerId: { in: ids }, ...MEASURED },
      _count: true,
    }),
    prisma.attempt.groupBy({
      by: ["learnerId", "errorType"],
      where: { learnerId: { in: ids }, correct: false, ...MEASURED },
      _count: true,
    }),
    prisma.activitySession.groupBy({
      by: ["learnerId"],
      where: { learnerId: { in: ids } },
      _sum: { durationMs: true },
      _count: true,
    }),
    prisma.attempt.findMany({
      where: { learnerId: { in: ids }, ...MEASURED, word: { isNot: null } },
      select: { learnerId: true, correct: true, word: { select: { pattern: true, syllables: true } } },
    }),
    prisma.practiceItem.groupBy({
      by: ["learnerId", "mastered"],
      where: { learnerId: { in: ids } },
      _count: true,
    }),
  ]);

  const completedCounts = await prisma.activitySession.groupBy({
    by: ["learnerId"],
    where: { learnerId: { in: ids }, completedAt: { not: null } },
    _count: true,
  });

  const get = <T,>(rows: T[], match: (r: T) => boolean) => rows.filter(match);

  const rows = learners.map((l) => {
    const acc = get(accGroups, (g) => g.learnerId === l.id);
    const total = acc.reduce((n, g) => n + g._count, 0);
    const correct = acc.find((g) => g.correct)?._count ?? 0;
    const errs = get(errorGroups, (g) => g.learnerId === l.id);
    const topError = [...errs].sort((a, b) => b._count - a._count)[0];
    const sess = sessionGroups.find((g) => g.learnerId === l.id);
    const done = completedCounts.find((g) => g.learnerId === l.id)?._count ?? 0;
    const practice = get(practiceGroups, (g) => g.learnerId === l.id);

    return {
      id: l.id,
      name: l.user.name,
      level: l.level,
      stage: l.stage,
      total,
      accuracy: pct(correct, total),
      topError: topError?.errorType ?? null,
      completed: done,
      minutes: Math.round((sess?._sum.durationMs ?? 0) / 60000),
      toPractice: practice.find((g) => !g.mastered)?._count ?? 0,
      mastered: practice.find((g) => g.mastered)?._count ?? 0,
    };
  });

  // Accuracy per syllable pattern, per learner — the grid that shows whether a
  // difficulty is shared or particular to one child.
  const families = new Map<string, Map<string, { correct: number; total: number }>>();
  for (const a of patternRows) {
    const family = patternFamily(a.word!.pattern, a.word!.syllables);
    const byLearner = families.get(family) ?? new Map();
    const cell = byLearner.get(a.learnerId) ?? { correct: 0, total: 0 };
    cell.total++;
    if (a.correct) cell.correct++;
    byLearner.set(a.learnerId, cell);
    families.set(family, byLearner);
  }

  const cohortTotal = rows.reduce((n, r) => n + r.total, 0);
  const cohortCorrect = rows.reduce(
    (n, r) => n + Math.round(((r.accuracy ?? 0) / 100) * r.total),
    0
  );

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/specialist"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-ink-muted hover:text-primary"
      >
        <ArrowLeft size={16} /> {t.allLearners}
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-extrabold text-ink">
            <Users size={26} className="text-primary" /> {t.cohortOverview}
          </h1>
          <p className="mt-1 max-w-2xl text-sm font-semibold text-ink-muted">
            All {learners.length} learners side by side, over {cohortTotal} scored readings.
            First readings only — re-reads taken after a word was modelled are excluded.
            {includeDemo
              ? " Demo learners are included: their reading history is fabricated and must not be reported."
              : demoCount > 0
                ? ` ${demoCount} demo learner${demoCount === 1 ? "" : "s"} excluded.`
                : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
        <DemoToggle count={demoCount} lang={lang} />
        <a
          href={`/api/export?what=summary${includeDemo ? "&includeDemo=true" : ""}`}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-primary-dark"
        >
          <Download size={16} /> {t.summaryCsv}
        </a>
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-6 py-4">
          <h2 className="text-lg font-extrabold text-ink">Progress</h2>
          <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">
            group accuracy {pct(cohortCorrect, cohortTotal) ?? "—"}%
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-200 text-left text-sm">
            <thead>
              <tr className="text-xs font-bold uppercase tracking-wide text-ink-muted">
                <th className="px-6 py-3">Learner</th>
                <th className="px-3 py-3">Level</th>
                <th className="px-3 py-3">Accuracy</th>
                <th className="px-3 py-3">Readings</th>
                <th className="px-3 py-3">Commonest error</th>
                <th className="px-3 py-3">Completed</th>
                <th className="px-3 py-3">Minutes</th>
                <th className="px-3 py-3">Practice / mastered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="transition hover:bg-cream/60">
                  <td className="px-6 py-4">
                    <Link
                      href={`/specialist/learner/${r.id}`}
                      className="font-extrabold text-ink hover:text-primary"
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-3 py-4 font-bold text-ink">
                    L{r.level} · S{r.stage}
                  </td>
                  <td className="px-3 py-4">
                    {r.accuracy === null ? (
                      <span className="text-ink-muted">—</span>
                    ) : (
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${accuracyTone(r.accuracy)}`}
                      >
                        {r.accuracy}%
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-4 font-semibold text-ink-soft">{r.total}</td>
                  <td className="px-3 py-4 font-semibold text-ink-soft">{r.topError ?? "—"}</td>
                  <td className="px-3 py-4 font-semibold text-ink-soft">{r.completed}</td>
                  <td className="px-3 py-4 font-semibold text-ink-soft">{r.minutes}</td>
                  <td className="px-3 py-4 font-semibold text-ink-soft">
                    {r.toPractice} / {r.mastered}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-line bg-card shadow-sm">
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-lg font-extrabold text-ink">Accuracy by syllable pattern</h2>
          <p className="mt-0.5 text-sm font-semibold text-ink-muted">
            A column that is weak across the row is a gap in the teaching, not in the child.
            Blank means the learner has not met that pattern yet.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-200 text-left text-sm">
            <thead>
              <tr className="text-xs font-bold uppercase tracking-wide text-ink-muted">
                <th className="px-6 py-3">Pattern</th>
                {rows.map((r) => (
                  <th key={r.id} className="px-3 py-3">
                    {r.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...families.entries()].map(([family, byLearner]) => (
                <tr key={family} className="transition hover:bg-cream/60">
                  <td className="px-6 py-3 font-bold text-ink">{family}</td>
                  {rows.map((r) => {
                    const cell = byLearner.get(r.id);
                    const value = cell ? pct(cell.correct, cell.total) : null;
                    return (
                      <td key={r.id} className="px-3 py-3">
                        {value === null ? (
                          <span className="text-ink-muted">—</span>
                        ) : (
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-bold ${accuracyTone(value)}`}
                            title={`${cell!.correct}/${cell!.total}`}
                          >
                            {value}%
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <PhaseComparison c={cohortPhases} scope="cohort" lang={lang} />

      <DivergencePanel d={cohortDivergence} lang={lang} />

    </div>
  );
}
