import Link from "next/link";
import { Mic, Ear, Puzzle, Music, AudioLines, Sparkles } from "lucide-react";
import { requireLearner } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { getLang } from "@/lib/lang";
import { getDict } from "@/lib/i18n";

/**
 * How long the decoding probe rests between runs.
 *
 * The probe works because its words are unfamiliar. A child who can open it
 * whenever they like will meet the same twenty-two non-words often enough to
 * learn them, and a learned non-word measures recall exactly like a real word
 * does — the instrument quietly turns into the thing it was built to rule out.
 *
 * A week is short enough not to obstruct a baseline or endline session and long
 * enough that nobody grinds it. It is a soft gate on the card, not a lock on
 * the route: a specialist who needs to re-run one can still reach it.
 */
const PROBE_COOLDOWN_DAYS = 7;

export default async function ExercisesPage() {
  const { profile, learnerId } = await requireLearner();
  const lang = await getLang();
  const dict = getDict(lang);

  const since = new Date();
  since.setDate(since.getDate() - PROBE_COOLDOWN_DAYS);
  const recentProbe = await prisma.activitySession.findFirst({
    where: { learnerId, type: "PSEUDO_PROBE", total: { gt: 0 }, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  // "Come back in a few days" told a child nothing they could act on, and told
  // a specialist planning an endline session even less. Say the date.
  const probeReturns = recentProbe
    ? new Date(recentProbe.createdAt.getTime() + PROBE_COOLDOWN_DAYS * 86_400_000)
    : null;

  const activities = [
    { type: "read-aloud", icon: Mic, tone: "bg-primary-soft text-primary", ...dict.exercises.readAloud },
    { type: "listen-choose", icon: Ear, tone: "bg-peach-soft text-peach-deep", ...dict.exercises.listen },
    { type: "syllables", icon: Puzzle, tone: "bg-green-soft text-green", ...dict.exercises.syllables },
    { type: "rhyme", icon: Music, tone: "bg-orange-soft text-orange", ...dict.exercises.rhyme },
    { type: "first-sound", icon: AudioLines, tone: "bg-primary-soft text-primary", ...dict.exercises.firstSound },
    { type: "silly-words", icon: Sparkles, tone: "bg-peach-soft text-peach-deep", ...dict.exercises.probe },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-extrabold text-ink">{dict.exercises.title}</h1>
      <p className="mt-1 text-sm font-semibold text-ink-muted">
        {dict.exercises.sub(profile.level)}
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {activities.map(({ type, icon: Icon, tone, title, desc, skill }) => {
          const resting = type === "silly-words" && recentProbe !== null;

          // Rendered as a plain card rather than a link while resting. A
          // disabled-looking link a child can still click is worse than no
          // link — they will click it.
          if (resting) {
            return (
              <div
                key={type}
                className="rounded-3xl border border-line bg-card p-6 opacity-60 shadow-sm"
              >
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${tone}`}>
                  <Icon size={26} strokeWidth={2.2} />
                </div>
                <h2 className="mt-4 text-xl font-extrabold text-ink">{title}</h2>
                <p className="mt-1 text-sm font-semibold text-ink-soft">
                  {dict.exercises.probeResting(
                    probeReturns!.toLocaleDateString(lang === "fil" ? "fil-PH" : "en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })
                  )}
                </p>
                <span className="mt-3 inline-block rounded-full bg-cream px-3 py-1 text-xs font-bold text-ink-muted">
                  {skill}
                </span>
              </div>
            );
          }

          return (
            <Link
              key={type}
              href={`/exercises/${type}`}
              className="group rounded-3xl border border-line bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${tone}`}>
                <Icon size={26} strokeWidth={2.2} />
              </div>
              <h2 className="mt-4 text-xl font-extrabold text-ink group-hover:text-primary">
                {title}
              </h2>
              <p className="mt-1 text-sm font-semibold text-ink-soft">{desc}</p>
              <span className="mt-3 inline-block rounded-full bg-cream px-3 py-1 text-xs font-bold text-ink-muted">
                {skill}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
