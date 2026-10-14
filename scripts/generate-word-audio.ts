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
 * Synthesis is Azure AI Speech (AZURE_SPEECH_KEY, AZURE_SPEECH_REGION in .env).
 * The free tier throttles requests per minute, so each clip may wait and retry
 * for up to PATIENCE_MS; a full run of the bank takes a while, and that is
 * expected.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { synthesizeWord, TTS_VOICE } from "../src/lib/word-tts";
import { databaseSsl } from "../src/lib/db-ssl";

// Long-running script: use the direct (session) connection when available.
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("Set DATABASE_URL (and ideally DIRECT_URL) in .env");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString, max: 2, ssl: databaseSsl(connectionString) }),
});

/** Ten minutes of retrying per clip: room for the free tier's throttling. */
const PATIENCE_MS = 10 * 60 * 1000;

async function main() {
  const force = process.argv.includes("--force");

  const words = await prisma.word.findMany({
    // Probe non-words are deliberately left without audio. The probe measures
    // whether a child can decode letters they have never seen combined before;
    // a clip they could play first would hand them the answer.
    where: { isPseudo: false },
    orderBy: [{ stage: "asc" }, { text: "asc" }],
    select: { id: true, text: true, syllables: true, audioWord: true, audioSyll: true },
  });
  const todo = force ? words : words.filter((w) => !w.audioWord || !w.audioSyll);

  if (todo.length === 0) {
    console.log("All words already have generated audio. Use --force to regenerate.");
    return;
  }

  console.log(`Generating audio for ${todo.length} of ${words.length} words (voice: ${TTS_VOICE})…`);

  let done = 0;
  let failed = 0;
  for (const word of todo) {
    try {
      const { audioWord, audioSyll } = await synthesizeWord(word.text, word.syllables, {
        patienceMs: PATIENCE_MS,
      });
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
