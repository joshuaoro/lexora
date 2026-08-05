import { requireSpecialist } from "@/lib/guards";
import { prisma } from "@/lib/db";
import WordBankClient from "@/components/specialist/WordBankClient";

export default async function WordBankPage() {
  await requireSpecialist();

  // The audio columns hold base64 clips, so they are never selected directly —
  // only which of them exist, via id lookups.
  const [words, withTts, withHuman] = await Promise.all([
    prisma.word.findMany({
      orderBy: [{ stage: "asc" }, { level: "asc" }, { text: "asc" }],
      select: {
        id: true,
        text: true,
        syllables: true,
        pattern: true,
        stage: true,
        level: true,
        meaningEn: true,
        variants: true,
        audioVersion: true,
        isPseudo: true,
        stressNote: true,
      },
    }),
    prisma.word.findMany({ where: { audioWord: { not: null } }, select: { id: true } }),
    prisma.word.findMany({ where: { audioWordHuman: { not: null } }, select: { id: true } }),
  ]);

  const ttsIds = new Set(withTts.map((w) => w.id));
  const humanIds = new Set(withHuman.map((w) => w.id));

  return (
    <WordBankClient
      words={words.map((w) => ({
        ...w,
        hasTts: ttsIds.has(w.id),
        hasHuman: humanIds.has(w.id),
      }))}
    />
  );
}
