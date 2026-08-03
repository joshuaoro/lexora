import Link from "next/link";
import { Mic, Star } from "lucide-react";
import { requireLearner } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { getLang } from "@/lib/lang";
import { getDict } from "@/lib/i18n";

export default async function PracticePage() {
  const session = await requireLearner();
  const dict = getDict(await getLang());
  const t = dict.practice;

  const items = await prisma.practiceItem.findMany({
    where: { learnerId: session.learnerId },
    orderBy: [{ mastered: "asc" }, { missCount: "desc" }],
    include: { word: true },
  });

  const active = items.filter((i) => !i.mastered);
  const mastered = items.filter((i) => i.mastered);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-ink">{t.title}</h1>
          <p className="mt-1 text-sm font-semibold text-ink-muted">{t.sub}</p>
        </div>
        {active.length > 0 && (
          <Link
            href="/practice/session"
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-bold text-white shadow-sm transition hover:bg-primary-dark"
          >
            <Mic size={18} /> {t.practiceNow}
          </Link>
        )}
      </div>

      {items.length === 0 && (
        <div className="mt-8 rounded-3xl border border-line bg-card p-6 text-center shadow-sm sm:p-10">
          <p className="text-lg font-bold text-ink">{t.emptyTitle}</p>
          <p className="mt-2 text-sm font-semibold text-ink-muted">{t.emptySub}</p>
          <Link
            href="/exercises/read-aloud"
            className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 font-bold text-white transition hover:bg-primary-dark"
          >
            {t.tryReadAloud}
          </Link>
        </div>
      )}

      {active.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-extrabold text-ink">{t.toPractice(active.length)}</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {active.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-2xl border border-line bg-card px-5 py-4 shadow-sm"
              >
                <div>
                  <p className="text-xl font-extrabold text-ink">{item.word.text}</p>
                  <p className="text-xs font-semibold text-ink-muted">
                    {item.word.syllables} ·{" "}
                    {item.source === "SPECIALIST" ? t.fromTeacher : t.missed(item.missCount)}
                  </p>
                </div>
                {/* role="img" so the stars are announced as one label rather
                    than as decorative shapes a screen reader would skip */}
                <div className="flex gap-1" role="img" aria-label={t.streakAria(item.streak)}>
                  {[0, 1].map((i) => (
                    <Star
                      key={i}
                      size={20}
                      className={i < item.streak ? "fill-orange text-orange" : "text-line"}
                    />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {mastered.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-extrabold text-ink">{t.mastered(mastered.length)}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {mastered.map((item) => (
              <li
                key={item.id}
                className="rounded-full bg-green-soft px-4 py-1.5 font-bold text-green"
              >
                {item.word.text}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
