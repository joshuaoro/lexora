/**
 * LEXORA seed — instructional content, demo accounts, and sample reading
 * history for demonstration.
 *
 * The content itself lives in its own modules so it can be reviewed and
 * validated independently of the seeding logic:
 *   prisma/word-bank.ts      the Filipino word bank and ASR spelling variants
 *   prisma/phon-items.ts     rhyme and sound-isolation item banks
 *   prisma/marungko-stage.ts derives each word's Marungko stage from its letters
 *
 * Run `npm run words:check` before seeding — it verifies syllabification,
 * levels, and that every level holds enough words that sessions do not repeat.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { WORDS, ASR_VARIANTS, STRESS_NOTES } from "./word-bank";
import { PSEUDOWORDS } from "./pseudoword-bank";
import { RHYMES, FIRST_SOUNDS } from "./phon-items";
import { stageForWord } from "./marungko-stage";

// Scripts run outside the request path, so the direct (session) connection is
// preferred; fall back to the pooled URL when only that is available.
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("Set DATABASE_URL (and ideally DIRECT_URL) in .env");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 2 }) });

// Plausible dyslexic-style misreadings for demo history (letter reversals etc.)
function mutate(word: string): string {
  const swaps: Record<string, string> = { b: "d", d: "b", p: "b", m: "n", n: "m", u: "o", e: "i" };
  for (let i = 0; i < word.length; i++) {
    const s = swaps[word[i]];
    if (s) return word.slice(0, i) + s + word.slice(i + 1);
  }
  return word.slice(1); // omission fallback
}

async function main() {
  // Seeding wipes every table. Against a live study database that would destroy
  // real learner data, so it must be asked for explicitly.
  const forced = process.argv.includes("--force");
  if (process.env.NODE_ENV === "production" && !forced) {
    console.error(
      "Refusing to seed: NODE_ENV=production and this deletes all data.\n" +
        "If you really mean it, re-run with --force."
    );
    process.exitCode = 1;
    return;
  }

  console.log("Clearing existing data…");
  // Note: run `npm run audio:generate` after seeding to add pronunciation clips.
  await prisma.attemptReview.deleteMany();
  await prisma.attempt.deleteMany();
  await prisma.activitySession.deleteMany();
  await prisma.practiceItem.deleteMany();
  await prisma.phonItem.deleteMany();
  await prisma.word.deleteMany();
  await prisma.learnerProfile.deleteMany();
  await prisma.user.deleteMany();

  console.log(`Seeding ${WORDS.length} words and ${PSEUDOWORDS.length} probe non-words…`);
  await prisma.word.createMany({
    data: [
      ...WORDS.map(([text, syllables, pattern, level, meaningEn]) => ({
        text,
        syllables,
        pattern,
        level,
        meaningEn,
        // derived, never hand-typed, so no word can appear before its letters
        stage: stageForWord(text),
        variants: ASR_VARIANTS[text] ?? "",
        stressNote: STRESS_NOTES[text] ?? null,
      })),
      // Probe non-words share the table so they inherit staging, levelling and
      // the specialist word-bank view, and are held apart everywhere it counts
      // by isPseudo. They carry no gloss (there is nothing to mean) and no ASR
      // variants (nothing legitimate to vary), and `npm run audio:generate`
      // skips them — a probe item a child can listen to is not a probe.
      ...PSEUDOWORDS.map(([text, syllables, pattern, level]) => ({
        text,
        syllables,
        pattern,
        level,
        meaningEn: null,
        stage: stageForWord(text),
        variants: "",
        isPseudo: true,
      })),
    ],
  });

  console.log(`Seeding ${RHYMES.length} rhyme and ${FIRST_SOUNDS.length} sound-isolation items…`);
  await prisma.phonItem.createMany({
    data: [
      ...RHYMES.map(([prompt, answer, distractors, level]) => ({
        type: "RHYME",
        prompt,
        answer,
        options: JSON.stringify([answer, ...distractors]),
        level,
      })),
      ...FIRST_SOUNDS.map(([prompt, answer, distractors, level]) => ({
        type: "FIRST_SOUND",
        prompt,
        answer,
        options: JSON.stringify([answer, ...distractors]),
        level,
      })),
    ],
  });

  console.log("Seeding demo accounts…");
  const password = await bcrypt.hash("lexora123", 10);

  await prisma.user.create({
    data: { email: "specialist@lexora.ph", password, name: "Teacher Maria Santos", role: "SPECIALIST" },
  });

  const juan = await prisma.user.create({
    data: {
      email: "learner1@lexora.ph", password, name: "Juan", role: "LEARNER",
      // isDemo: this account carries the fabricated history generated below,
      // which must never reach a cohort chart or an exported result.
      learnerProfile: { create: { level: 2, stage: 4, isDemo: true } },
    },
    include: { learnerProfile: true },
  });

  await prisma.user.create({
    data: {
      email: "learner2@lexora.ph", password, name: "Ana", role: "LEARNER",
      learnerProfile: { create: { isDemo: true } },
    },
  });

  // ── Demo reading history for Juan: 14 days, accuracy trending upward ──
  console.log("Generating demo reading history…");
  const words = await prisma.word.findMany({
    where: { level: { lte: 2 }, stage: { lte: 5 }, isPseudo: false },
  });
  const learnerId = juan.learnerProfile!.id;
  const now = new Date();
  const missTally = new Map<string, number>();

  for (let daysAgo = 13; daysAgo >= 0; daysAgo--) {
    if (daysAgo === 9 || daysAgo === 4) continue; // rest days
    const dayAcc = 0.55 + ((13 - daysAgo) / 13) * 0.35; // 55% → 90%
    const day = new Date(now);
    day.setDate(day.getDate() - daysAgo);
    day.setHours(16, 10, 0, 0); // after-school session

    const nItems = 8 + Math.floor(Math.random() * 3);
    const sessionWords = [...words].sort(() => Math.random() - 0.5).slice(0, nItems);
    let correctCount = 0;
    const attempts = [];

    for (let i = 0; i < sessionWords.length; i++) {
      const w = sessionWords[i];
      const correct = Math.random() < dayAcc;
      if (correct) correctCount++;
      else missTally.set(w.id, (missTally.get(w.id) ?? 0) + 1);
      const transcript = correct ? w.text : mutate(w.text);
      attempts.push({
        learnerId,
        wordId: w.id,
        target: w.text,
        transcript,
        correct,
        score: correct ? 1 : 0.5,
        errorType: correct ? "correct" : transcript.length < w.text.length ? "omission" : "substitution",
        responseMs: 1800 + Math.floor(Math.random() * 3500),
        levelAtTime: 2,
        activityType: "READ_ALOUD",
        createdAt: new Date(day.getTime() + i * 15000),
      });
    }

    const session = await prisma.activitySession.create({
      data: {
        learnerId,
        type: "READ_ALOUD",
        total: sessionWords.length,
        correct: correctCount,
        durationMs: sessionWords.length * 15000,
        levelAtTime: 2,
        createdAt: day,
      },
    });
    await prisma.attempt.createMany({
      data: attempts.map((a) => ({ ...a, sessionId: session.id })),
    });
  }

  // Practice list from repeated misses
  for (const [wordId, misses] of missTally) {
    if (misses >= 2) {
      await prisma.practiceItem.create({
        data: { learnerId, wordId, missCount: misses, source: "AUTO" },
      });
    }
  }

  console.log("Seed complete.");
  console.log("Demo accounts (password: lexora123):");
  console.log("  specialist@lexora.ph  — reading specialist");
  console.log("  learner1@lexora.ph    — learner with sample history");
  console.log("  learner2@lexora.ph    — learner, fresh account");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
