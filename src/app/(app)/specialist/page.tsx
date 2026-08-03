import Link from "next/link";
import { ChevronRight, Users, Download } from "lucide-react";
import { requireSpecialist } from "@/lib/guards";
import { prisma } from "@/lib/db";

export default async function SpecialistPage() {
  const session = await requireSpecialist();

  const learners = await prisma.learnerProfile.findMany({
    include: {
      user: true,
      _count: { select: { practiceItems: { where: { mastered: false } } } },
    },
    orderBy: { user: { name: "asc" } },
  });

  // Per-learner accuracy and last activity in two grouped queries
  const [accGroups, lastAttempts] = await Promise.all([
    prisma.attempt.groupBy({
      by: ["learnerId", "correct"],
      // First readings only — retries follow the word being modelled.
      where: { activityType: { in: ["READ_ALOUD", "PRACTICE"] }, isRetry: false },
      _count: true,
    }),
    prisma.attempt.groupBy({
      by: ["learnerId"],
      _max: { createdAt: true },
    }),
  ]);

  const stats = new Map<string, { correct: number; total: number; last: Date | null }>();
  for (const l of learners) stats.set(l.id, { correct: 0, total: 0, last: null });
  for (const g of accGroups) {
    const s = stats.get(g.learnerId);
    if (!s) continue;
    s.total += g._count;
    if (g.correct) s.correct += g._count;
  }
  for (const g of lastAttempts) {
    const s = stats.get(g.learnerId);
    if (s) s.last = g._max.createdAt;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-ink-muted">Welcome back</p>
          <h1 className="text-3xl font-extrabold text-ink">
            {session.name} <span aria-hidden>👋</span>
          </h1>
          <span className="mt-2 inline-block rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">
            Reading specialist
          </span>
        </div>
        {/* CSV exports for statistical treatment */}
        <div className="flex flex-wrap gap-2.5">
          <a
            href="/api/export?what=summary"
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-primary-dark"
          >
            <Download size={16} /> Summary CSV
          </a>
          <a
            href="/api/export?what=attempts"
            className="flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-cream-dark"
          >
            <Download size={16} /> All attempts CSV
          </a>
          <a
            href="/api/export?what=sessions"
            className="flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-cream-dark"
          >
            <Download size={16} /> All sessions CSV
          </a>
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-line px-6 py-4">
          <Users size={20} className="text-primary" />
          <h2 className="text-lg font-extrabold text-ink">My learners ({learners.length})</h2>
        </div>

        {learners.length === 0 ? (
          <p className="px-6 py-8 text-sm text-ink-soft">
            No learners yet. Learners appear here as soon as they register.
          </p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-160 text-left text-sm">
            <thead>
              <tr className="text-xs font-bold uppercase tracking-wide text-ink-muted">
                <th className="px-6 py-3">Learner</th>
                <th className="px-3 py-3">Level</th>
                <th className="px-3 py-3">Accuracy</th>
                <th className="px-3 py-3">Words attempted</th>
                <th className="px-3 py-3">Practice words</th>
                <th className="px-3 py-3">Last active</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {learners.map((l) => {
                const s = stats.get(l.id)!;
                const acc = s.total ? Math.round((s.correct / s.total) * 100) : null;
                return (
                  <tr key={l.id} className="transition hover:bg-cream/60">
                    <td className="px-6 py-4">
                      <Link
                        href={`/specialist/learner/${l.id}`}
                        className="font-extrabold text-ink hover:text-primary"
                      >
                        {l.user.name}
                      </Link>
                      <p className="text-xs font-semibold text-ink-muted">{l.user.email}</p>
                    </td>
                    <td className="px-3 py-4 font-bold text-ink">
                      L{l.level} · S{l.stage}
                    </td>
                    <td className="px-3 py-4">
                      {acc === null ? (
                        <span className="text-ink-muted">—</span>
                      ) : (
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                            acc >= 70
                              ? "bg-green-soft text-green"
                              : acc >= 50
                                ? "bg-orange-soft text-orange"
                                : "bg-red-soft text-red"
                          }`}
                        >
                          {acc}%
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-4 font-semibold text-ink-soft">{s.total}</td>
                    <td className="px-3 py-4 font-semibold text-ink-soft">
                      {l._count.practiceItems}
                    </td>
                    <td className="px-3 py-4 font-semibold text-ink-soft">
                      {s.last
                        ? s.last.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                        : "never"}
                    </td>
                    <td className="px-3 py-4">
                      <Link
                        href={`/specialist/learner/${l.id}`}
                        aria-label={`Open ${l.user.name}'s progress`}
                        className="inline-flex rounded-lg p-1.5 text-primary transition hover:bg-primary-soft"
                      >
                        <ChevronRight size={18} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </section>
    </div>
  );
}
