import { requireLearner } from "@/lib/guards";
import { parseSettings } from "@/lib/settings";
import { getLang } from "@/lib/lang";
import SettingsClient from "@/components/settings/SettingsClient";

export default async function SettingsPage() {
  const { profile } = await requireLearner();
  const lang = await getLang();

  return <SettingsClient initial={parseSettings(profile.settings)} lang={lang} />;
}
