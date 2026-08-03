import { requireLearner } from "@/lib/guards";
import { parseSettings } from "@/lib/settings";
import { getLang } from "@/lib/lang";
import { buildItems } from "@/lib/exercise-items";
import ExerciseSession from "@/components/exercises/ExerciseSession";

export default async function PracticeSessionPage() {
  const { profile, learnerId } = await requireLearner();
  const [items, lang] = await Promise.all([buildItems(learnerId, "PRACTICE"), getLang()]);

  return (
    <ExerciseSession
      type="PRACTICE"
      items={items}
      settings={parseSettings(profile.settings)}
      lang={lang}
    />
  );
}
