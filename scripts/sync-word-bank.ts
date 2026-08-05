/**
 * Bring an existing database up to date with the word-bank source files —
 * without touching learner data.
 *
 *   npm run words:sync
 *
 * `prisma db seed` is the usual way content reaches the database, but seeding
 * deletes every table first. Once a study is running that is not an option: the
 * attempts, recordings and reviews are the research. This script adds and
 * updates content in place instead, so the bank can gain a word or a caveat
 * mid-study without costing a single reading.
 *
 * Idempotent by design — running it twice changes nothing the second time.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { WORDS, STRESS_NOTES } from "../prisma/word-bank";
import { PSEUDOWORDS } from "../prisma/pseudoword-bank";
import { stageForWord } from "../prisma/marungko-stage";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("Set DATABASE_URL (and ideally DIRECT_URL) in .env");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 2 }) });

async function main() {
  const existing = new Map(
    (await prisma.word.findMany({ select: { text: true, isPseudo: true, stressNote: true } })).map(
      (w) => [w.text, w]
    )
  );

  // ── Probe non-words ────────────────────────────────────────────────────
  // A collision here would be silent and serious: a "non-word" that is also a
  // real word in the bank stops testing decoding and starts testing recall.
  const collisions = PSEUDOWORDS.filter(([text]) => existing.get(text)?.isPseudo === false);
  if (collisions.length) {
    throw new Error(
      `These probe words already exist as real words: ${collisions.map(([t]) => t).join(", ")}`
    );
  }

  let added = 0;
  for (const [text, syllables, pattern, level] of PSEUDOWORDS) {
    if (existing.has(text)) continue;
    await prisma.word.create({
      data: {
        text,
        syllables,
        pattern,
        level,
        stage: stageForWord(text),
        meaningEn: null,
        variants: "",
        isPseudo: true,
      },
    });
    added++;
  }
  console.log(`Probe non-words: ${added} added, ${PSEUDOWORDS.length - added} already present.`);

  // ── Stress caveats ─────────────────────────────────────────────────────
  let noted = 0;
  for (const [text, note] of Object.entries(STRESS_NOTES)) {
    const row = existing.get(text);
    if (!row || row.stressNote === note) continue;
    await prisma.word.update({ where: { text }, data: { stressNote: note } });
    noted++;
  }
  console.log(`Stress caveats: ${noted} applied, ${Object.keys(STRESS_NOTES).length - noted} unchanged.`);

  // ── Sanity ─────────────────────────────────────────────────────────────
  const [real, pseudo, missingAudio] = await Promise.all([
    prisma.word.count({ where: { isPseudo: false } }),
    prisma.word.count({ where: { isPseudo: true } }),
    // A probe word with audio would let a child hear the answer before reading.
    prisma.word.count({
      where: { isPseudo: true, OR: [{ audioWord: { not: null } }, { audioSyll: { not: null } }] },
    }),
  ]);
  console.log(`Bank now holds ${real} real words and ${pseudo} probe non-words.`);
  if (missingAudio > 0) {
    throw new Error(`${missingAudio} probe non-words have audio attached; they must not.`);
  }

  console.log(`Word bank source lists ${WORDS.length} real words.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
