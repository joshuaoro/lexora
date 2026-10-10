import { requireLearner } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { parseSettings } from "@/lib/settings";
import { getLang } from "@/lib/lang";
import { getDict } from "@/lib/i18n";
import { buildReaderSets } from "@/lib/reader-sets";
import ReaderClient from "@/components/reader/ReaderClient";

export default async function ReaderPage() {
  const { profile } = await requireLearner();
  const lang = await getLang();
  const dict = getDict(lang);

  const [words, withAudio] = await Promise.all([
    prisma.word.findMany({
      // Real words only. The probe's non-words share this table, and the Reader
      // used to list them — every one, in its stage's set, whatever the child's
      // own stage — and, having no stored clip, spoke them aloud in the
      // browser's voice. A non-word a child has heard and read is one they now
      // know, and it stops measuring decoding. See Word.isPseudo.
      where: { isPseudo: false },
      orderBy: [{ stage: "asc" }, { level: "asc" }],
      select: { id: true, text: true, syllables: true, level: true, stage: true, audioVersion: true },
    }),
    // ids only — the clips themselves are streamed by /api/word-audio
    prisma.word.findMany({
      where: {
        isPseudo: false,
        OR: [{ audioWord: { not: null } }, { audioWordHuman: { not: null } }],
      },
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
