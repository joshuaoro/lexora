import { notFound } from "next/navigation";
import { requireLearner } from "@/lib/guards";
import { parseSettings } from "@/lib/settings";
import { getLang } from "@/lib/lang";
import { buildItems, type ExerciseType } from "@/lib/exercise-items";
import ExerciseSession from "@/components/exercises/ExerciseSession";

const SLUGS: Record<string, ExerciseType> = {
  "read-aloud": "READ_ALOUD",
  "listen-choose": "LISTEN_CHOOSE",
  syllables: "SYLLABLES",
  rhyme: "RHYME",
  "first-sound": "FIRST_SOUND",
  "silly-words": "PSEUDO_PROBE",
};

export default async function ExerciseTypePage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type: slug } = await params;
  const type = SLUGS[slug];
  if (!type) notFound();

  const { profile, learnerId } = await requireLearner();
  const [items, lang] = await Promise.all([buildItems(learnerId, type, 8, profile), getLang()]);

  return (
    <ExerciseSession
      type={type}
      items={items}
      settings={parseSettings(profile.settings)}
      lang={lang}
    />
  );
}
