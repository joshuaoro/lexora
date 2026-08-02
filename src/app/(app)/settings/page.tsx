import { requireLearner } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { parseSettings } from "@/lib/settings";
import { getLang } from "@/lib/lang";
import SettingsClient from "@/components/settings/SettingsClient";

export default async function SettingsPage() {
  const session = await requireLearner();
  const [profile, lang] = await Promise.all([
    prisma.learnerProfile.findUniqueOrThrow({ where: { id: session.learnerId } }),
    getLang(),
  ]);

  return <SettingsClient initial={parseSettings(profile.settings)} lang={lang} />;
}
