import Link from "next/link";
import { Mic, Ear, Puzzle, Music, AudioLines } from "lucide-react";
import { requireLearner } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { getLang } from "@/lib/lang";
import { getDict } from "@/lib/i18n";

export default async function ExercisesPage() {
  const session = await requireLearner();
  const dict = getDict(await getLang());
  const profile = await prisma.learnerProfile.findUniqueOrThrow({
    where: { id: session.learnerId },
  });

  const activities = [
    { type: "read-aloud", icon: Mic, tone: "bg-primary-soft text-primary", ...dict.exercises.readAloud },
    { type: "listen-choose", icon: Ear, tone: "bg-peach-soft text-peach-deep", ...dict.exercises.listen },
    { type: "syllables", icon: Puzzle, tone: "bg-green-soft text-green", ...dict.exercises.syllables },
    { type: "rhyme", icon: Music, tone: "bg-orange-soft text-orange", ...dict.exercises.rhyme },
    { type: "first-sound", icon: AudioLines, tone: "bg-primary-soft text-primary", ...dict.exercises.firstSound },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-extrabold text-ink">{dict.exercises.title}</h1>
      <p className="mt-1 text-sm font-semibold text-ink-muted">
        {dict.exercises.sub(profile.level)}
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {activities.map(({ type, icon: Icon, tone, title, desc, skill }) => (
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
        ))}
      </div>
    </div>
  );
}
