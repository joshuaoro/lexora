/**
 * Warm the instruction-speech cache.
 *
 *   npx tsx scripts/generate-instruction-audio.ts
 *   npx tsx scripts/generate-instruction-audio.ts --force   # re-synthesize
 *
 * Every fixed line the speaker button can say, in both languages, synthesized
 * ahead of time. Without this the first child to press the speaker on study day
 * waits a second or two for a WebSocket round trip; with it, nothing is cold.
 *
 * Lines are read from the dictionaries rather than copied here, so a reworded
 * instruction is picked up the next time this runs instead of quietly serving
 * audio of the old wording.
 */
import "dotenv/config";
import { getDict, type Lang } from "../src/lib/i18n";
import { getOrCreateSpeech, SPEECH_VOICE, SPEECH_RATE, speechHash } from "../src/lib/speech";
import { prisma } from "../src/lib/db";

const EXERCISE_TYPES = [
  "READ_ALOUD",
  "LISTEN_CHOOSE",
  "SYLLABLES",
  "RHYME",
  "FIRST_SOUND",
  "PRACTICE",
] as const;

/** Every phrase a SpeakButton is wired to, for one language. */
function phrasesFor(lang: Lang): string[] {
  const d = getDict(lang);
  const out: string[] = [];

  for (const type of EXERCISE_TYPES) {
    const intro = d.session.intro[type];
    if (!intro) continue;
    // The intro button reads both lines; the in-exercise button reads the how.
    out.push(`${intro.blurb} ${intro.how}`);
    out.push(intro.how);
  }

  out.push(`${d.session.leaveTitle} ${d.session.leaveBody}`);
  out.push(d.session.nowYouTry);
  out.push(d.dashboard.streakNone);

  return [...new Set(out.map((s) => s.trim()).filter(Boolean))];
}

async function main() {
  const force = process.argv.includes("--force");
  console.log(`Voice ${SPEECH_VOICE} at ${SPEECH_RATE}\n`);

  let made = 0;
  let kept = 0;
  let failed = 0;

  for (const lang of ["en", "fil"] as Lang[]) {
    const phrases = phrasesFor(lang);
    console.log(`${lang} — ${phrases.length} phrases`);

    for (const text of phrases) {
      if (force) {
        await prisma.speechClip.deleteMany({ where: { hash: speechHash(text, lang) } });
      }
      const clip = await getOrCreateSpeech(text, lang);
      const label = text.length > 58 ? text.slice(0, 55) + "…" : text;

      if (!clip) {
        failed++;
        console.log(`  FAILED  ${label}`);
      } else if (clip.generated) {
        made++;
        console.log(`  made    ${label}`);
      } else {
        kept++;
        console.log(`  cached  ${label}`);
      }
    }
    console.log();
  }

  const total = await prisma.speechClip.count();
  console.log(`${made} synthesized, ${kept} already cached, ${failed} failed.`);
  console.log(`${total} clips in the cache.`);
  if (failed) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("Instruction audio generation failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
