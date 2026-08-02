import { requireLearner } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { parseSettings } from "@/lib/settings";
import { getLang } from "@/lib/lang";
import { buildItems } from "@/lib/exercise-items";
import ExerciseSession from "@/components/exercises/ExerciseSession";

export default async function PracticeSessionPage() {
  const session = await requireLearner();
  const [profile, items, lang] = await Promise.all([
    prisma.learnerProfile.findUniqueOrThrow({ where: { id: session.learnerId } }),
    buildItems(session.learnerId, "PRACTICE"),
    getLang(),
  ]);

  return (
    <ExerciseSession
      type="PRACTICE"
      items={items}
      settings={parseSettings(profile.settings)}
      lang={lang}
    />
  );
}
