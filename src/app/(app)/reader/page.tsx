import { requireLearner } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { parseSettings } from "@/lib/settings";
import { getLang } from "@/lib/lang";
import { getDict } from "@/lib/i18n";
import { buildReaderSets } from "@/lib/reader-sets";
import ReaderClient from "@/components/reader/ReaderClient";

export default async function ReaderPage() {
  const session = await requireLearner();
  const lang = await getLang();
  const dict = getDict(lang);

  const [profile, words, withAudio] = await Promise.all([
    prisma.learnerProfile.findUniqueOrThrow({ where: { id: session.learnerId } }),
    prisma.word.findMany({
      orderBy: [{ stage: "asc" }, { level: "asc" }],
      select: { id: true, text: true, level: true, stage: true, audioVersion: true },
    }),
    // ids only — the clips themselves are streamed by /api/word-audio
    prisma.word.findMany({
      where: { OR: [{ audioWord: { not: null } }, { audioWordHuman: { not: null } }] },
      select: { id: true },
    }),
  ]);

  const sets = buildReaderSets(
    words,
    profile.level,
    profile.stage,
    dict.reader.myWords(profile.level),
    new Set(withAudio.map((w) => w.id))
  );

  return <ReaderClient settings={parseSettings(profile.settings)} sets={sets} lang={lang} />;
}
