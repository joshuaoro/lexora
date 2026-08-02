/**
 * Pre-generates Filipino pronunciation audio for every word in the bank.
 *
 * Browser text-to-speech usually has no Filipino voice installed, so Tagalog
 * words get read with English phonics ("bahay" → "buh-HAY"). This script
 * synthesizes each word once with a neural Filipino voice and stores the clip
 * in the database, so playback is correct on every device with no runtime API
 * dependency.
 *
 *   npm run audio:generate            # fill in missing audio
 *   npm run audio:generate -- --force # regenerate every generated clip
 *
 * Specialist recordings live in separate columns and are never touched here.
 * Individual words can also be (re)generated from the Word bank UI.
 *
 * If msedge-tts ever breaks, the Python `edge-tts` CLI produces identical
 * output: edge-tts --voice fil-PH-BlessicaNeural --text "bahay" --write-media bahay.mp3
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { createSynthesizer, TTS_VOICE } from "../src/lib/word-tts";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const force = process.argv.includes("--force");

  const words = await prisma.word.findMany({
    orderBy: [{ stage: "asc" }, { text: "asc" }],
    select: { id: true, text: true, syllables: true, audioWord: true, audioSyll: true },
  });
  const todo = force ? words : words.filter((w) => !w.audioWord || !w.audioSyll);

  if (todo.length === 0) {
    console.log("All words already have generated audio. Use --force to regenerate.");
    return;
  }

  console.log(`Generating audio for ${todo.length} of ${words.length} words (voice: ${TTS_VOICE})…`);
  const synth = await createSynthesizer();

  let done = 0;
  let failed = 0;
  for (const word of todo) {
    try {
      const { audioWord, audioSyll } = await synth(word.text, word.syllables);
      await prisma.word.update({
        where: { id: word.id },
        data: { audioWord, audioSyll, audioVersion: { increment: 1 } },
      });
      done++;
      if (done % 10 === 0 || done === todo.length) console.log(`  ${done}/${todo.length} …`);
    } catch (err) {
      failed++;
      // Keep it to one line — Prisma errors echo the whole base64 payload.
      const reason = (err instanceof Error ? err.message : String(err)).split("\n")[0].slice(0, 160);
      console.error(`  ✗ ${word.text}: ${reason}`);
    }
  }

  console.log(`Done. ${done} generated${failed ? `, ${failed} failed` : ""}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
