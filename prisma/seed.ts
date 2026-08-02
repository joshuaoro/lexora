/**
 * LEXORA seed — Marungko-staged Filipino word bank, rhyme item bank,
 * demo accounts, and sample reading history for demonstration.
 *
 * Marungko letter sequence (stages used by LEXORA):
 *  1: m s a          2: + i o        3: + b e u       4: + t k l
 *  5: + y n g        6: + p r d h w  7: + ng, borrowed letters (ts, dy, ...)
 *
 * Difficulty levels:
 *  1: two-syllable open words (CV-CV)
 *  2: words with a closed syllable / vowel sequence
 *  3: three-syllable words and ng- words
 *  4: consonant clusters (CCV/CCVC) and complex codas
 *  5: four or more syllables
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

type W = [text: string, syllables: string, pattern: string, stage: number, level: number, meaningEn: string];

const WORDS: W[] = [
  // ── Stage 1: m, s, a ────────────────────────────────────────────────
  ["mama", "ma-ma", "CVCV", 1, 1, "mom"],
  ["ama", "a-ma", "VCV", 1, 1, "father"],
  ["sama", "sa-ma", "CVCV", 1, 1, "to join / accompany"],
  ["masa", "ma-sa", "CVCV", 1, 1, "dough"],
  ["asa", "a-sa", "VCV", 1, 1, "to hope / rely"],
  ["mas", "mas", "CVC", 1, 2, "more"],
  // ── Stage 2: + i, o ─────────────────────────────────────────────────
  ["aso", "a-so", "VCV", 2, 1, "dog"],
  ["oso", "o-so", "VCV", 2, 1, "bear"],
  ["misa", "mi-sa", "CVCV", 2, 1, "mass (church)"],
  ["sisi", "si-si", "CVCV", 2, 1, "blame / regret"],
  ["amo", "a-mo", "VCV", 2, 1, "boss / master"],
  ["mais", "ma-is", "CVVC", 2, 2, "corn"],
  // ── Stage 3: + b, e, u ──────────────────────────────────────────────
  ["baso", "ba-so", "CVCV", 3, 1, "drinking glass"],
  ["mesa", "me-sa", "CVCV", 3, 1, "table"],
  ["abo", "a-bo", "VCV", 3, 1, "ash"],
  ["ube", "u-be", "VCV", 3, 1, "purple yam"],
  ["bibe", "bi-be", "CVCV", 3, 1, "duckling"],
  ["baba", "ba-ba", "CVCV", 3, 1, "chin"],
  ["sabi", "sa-bi", "CVCV", 3, 1, "said"],
  ["ubas", "u-bas", "VCVC", 3, 2, "grapes"],
  ["bus", "bus", "CVC", 3, 2, "bus"],
  ["bumasa", "bu-ma-sa", "CVCVCV", 3, 3, "to read"],
  // ── Stage 4: + t, k, l ──────────────────────────────────────────────
  ["lata", "la-ta", "CVCV", 4, 1, "tin can"],
  ["bola", "bo-la", "CVCV", 4, 1, "ball"],
  ["tela", "te-la", "CVCV", 4, 1, "cloth"],
  ["bato", "ba-to", "CVCV", 4, 1, "stone"],
  ["tubo", "tu-bo", "CVCV", 4, 1, "pipe / sugarcane"],
  ["talo", "ta-lo", "CVCV", 4, 1, "defeated"],
  ["kuto", "ku-to", "CVCV", 4, 1, "head louse"],
  ["tasa", "ta-sa", "CVCV", 4, 1, "cup"],
  ["lobo", "lo-bo", "CVCV", 4, 1, "balloon"],
  ["buko", "bu-ko", "CVCV", 4, 1, "young coconut"],
  ["sulat", "su-lat", "CVCVC", 4, 2, "letter / to write"],
  ["aklat", "ak-lat", "VCCVC", 4, 2, "book"],
  ["takot", "ta-kot", "CVCVC", 4, 2, "fear"],
  ["bukas", "bu-kas", "CVCVC", 4, 2, "tomorrow / open"],
  ["salamat", "sa-la-mat", "CVCVCVC", 4, 3, "thank you"],
  ["kamatis", "ka-ma-tis", "CVCVCVC", 4, 3, "tomato"],
  ["makulit", "ma-ku-lit", "CVCVCVC", 4, 3, "naughty / persistent"],
  ["kulambo", "ku-lam-bo", "CVCVCCV", 4, 3, "mosquito net"],
  ["bulaklak", "bu-lak-lak", "CVCVCCVC", 4, 4, "flower"],
  ["kalabasa", "ka-la-ba-sa", "CVCVCVCV", 4, 5, "squash"],
  // ── Stage 5: + y, n, g ──────────────────────────────────────────────
  ["gabi", "ga-bi", "CVCV", 5, 1, "night / taro"],
  ["yelo", "ye-lo", "CVCV", 5, 1, "ice"],
  ["yaya", "ya-ya", "CVCV", 5, 1, "nanny"],
  ["nanay", "na-nay", "CVCVC", 5, 2, "mother"],
  ["tatay", "ta-tay", "CVCVC", 5, 2, "father"],
  ["gulay", "gu-lay", "CVCVC", 5, 2, "vegetable"],
  ["gatas", "ga-tas", "CVCVC", 5, 2, "milk"],
  ["bunso", "bun-so", "CVCCV", 5, 2, "youngest child"],
  ["niyog", "ni-yog", "CVCVC", 5, 2, "coconut"],
  ["bantay", "ban-tay", "CVCCVC", 5, 2, "guard"],
  ["itlog", "it-log", "VCCVC", 5, 2, "egg"],
  ["ulan", "u-lan", "VCVC", 5, 2, "rain"],
  ["ilog", "i-log", "VCVC", 5, 2, "river"],
  ["salamin", "sa-la-min", "CVCVCVC", 5, 3, "mirror / eyeglasses"],
  ["nilaga", "ni-la-ga", "CVCVCV", 5, 3, "boiled dish"],
  ["kaibigan", "ka-i-bi-gan", "CVVCVCVC", 5, 5, "friend"],
  // ── Stage 6: + p, r, d, h, w ────────────────────────────────────────
  ["puno", "pu-no", "CVCV", 6, 1, "tree"],
  ["pera", "pe-ra", "CVCV", 6, 1, "money"],
  ["pusa", "pu-sa", "CVCV", 6, 1, "cat"],
  ["puso", "pu-so", "CVCV", 6, 1, "heart"],
  ["dila", "di-la", "CVCV", 6, 1, "tongue"],
  ["daga", "da-ga", "CVCV", 6, 1, "mouse"],
  ["damo", "da-mo", "CVCV", 6, 1, "grass"],
  ["relo", "re-lo", "CVCV", 6, 1, "watch / clock"],
  ["wika", "wi-ka", "CVCV", 6, 1, "language"],
  ["damit", "da-mit", "CVCVC", 6, 2, "clothes"],
  ["dahon", "da-hon", "CVCVC", 6, 2, "leaf"],
  ["bahay", "ba-hay", "CVCVC", 6, 2, "house"],
  ["buhay", "bu-hay", "CVCVC", 6, 2, "life / alive"],
  ["araw", "a-raw", "VCVC", 6, 2, "sun / day"],
  ["ilaw", "i-law", "VCVC", 6, 2, "light"],
  ["ulap", "u-lap", "VCVC", 6, 2, "cloud"],
  ["hipon", "hi-pon", "CVCVC", 6, 2, "shrimp"],
  ["hilaw", "hi-law", "CVCVC", 6, 2, "unripe / raw"],
  ["isda", "is-da", "VCCV", 6, 2, "fish"],
  ["pinto", "pin-to", "CVCCV", 6, 2, "door"],
  ["radyo", "rad-yo", "CVCCV", 6, 2, "radio"],
  ["hardin", "har-din", "CVCCVC", 6, 2, "garden"],
  ["sampay", "sam-pay", "CVCCVC", 6, 2, "hung laundry"],
  ["watawat", "wa-ta-wat", "CVCVCVC", 6, 3, "flag"],
  ["tinapay", "ti-na-pay", "CVCVCVC", 6, 3, "bread"],
  ["kandila", "kan-di-la", "CVCCVCV", 6, 3, "candle"],
  ["diwata", "di-wa-ta", "CVCVCV", 6, 3, "fairy"],
  ["payaso", "pa-ya-so", "CVCVCV", 6, 3, "clown"],
  ["plato", "pla-to", "CCVCV", 6, 4, "plate"],
  ["braso", "bra-so", "CCVCV", 6, 4, "arm"],
  ["prito", "pri-to", "CCVCV", 6, 4, "fried"],
  ["tren", "tren", "CCVC", 6, 4, "train"],
  ["trak", "trak", "CCVC", 6, 4, "truck"],
  ["krus", "krus", "CCVC", 6, 4, "cross"],
  ["prutas", "pru-tas", "CCVCVC", 6, 4, "fruit"],
  ["paaralan", "pa-a-ra-lan", "CVVCVCVC", 6, 5, "school"],
  ["mahalaga", "ma-ha-la-ga", "CVCVCVCV", 6, 5, "important"],
  ["karagatan", "ka-ra-ga-tan", "CVCVCVCVC", 6, 5, "ocean"],
  // ── Stage 7: + ng and borrowed letters ──────────────────────────────
  ["ngipin", "ngi-pin", "CVCVC(ng)", 7, 3, "tooth"],
  ["ngiti", "ngi-ti", "CVCV(ng)", 7, 3, "smile"],
  ["ngayon", "nga-yon", "CVCVC(ng)", 7, 3, "now / today"],
  ["saging", "sa-ging", "CVCVC(ng)", 7, 3, "banana"],
  ["payong", "pa-yong", "CVCVC(ng)", 7, 3, "umbrella"],
  ["gunting", "gun-ting", "CVCCVC(ng)", 7, 3, "scissors"],
  ["mangga", "mang-ga", "CVCCV(ng)", 7, 3, "mango"],
  ["bangka", "bang-ka", "CVCCV(ng)", 7, 3, "boat"],
  ["bangus", "ba-ngus", "CVCVC(ng)", 7, 3, "milkfish"],
  ["tulong", "tu-long", "CVCVC(ng)", 7, 3, "help"],
  ["gulong", "gu-long", "CVCVC(ng)", 7, 3, "wheel"],
  ["tainga", "ta-i-nga", "CVVCV(ng)", 7, 4, "ear"],
  ["pinggan", "ping-gan", "CVCCVC(ng)", 7, 4, "dish / plate"],
  ["singkamas", "sing-ka-mas", "CVCCVCVC(ng)", 7, 4, "jicama"],
  ["pangalan", "pa-nga-lan", "CVCVCVC(ng)", 7, 4, "name"],
  ["pangako", "pa-nga-ko", "CVCVCV(ng)", 7, 4, "promise"],
  ["kotse", "kot-se", "CVCCV", 7, 3, "car"],
  ["dyip", "dyip", "CCVC", 7, 4, "jeepney"],
  ["tsinelas", "tsi-ne-las", "CCVCVCVC", 7, 5, "slippers"],
];

// Rhyme bank: prompt + options (first option is the answer; shuffled at runtime)
const RHYMES: [prompt: string, answer: string, distractors: string[], level: number][] = [
  ["bahay", "buhay", ["bola", "gatas"], 1],
  ["ilaw", "araw", ["mesa", "kuto"], 1],
  ["bola", "lola", ["dahon", "mais"], 1],
  ["bato", "plato", ["dila", "puno"], 2],
  ["dila", "kandila", ["araw", "isda"], 2],
  ["damit", "langit", ["baso", "ulap"], 2],
  ["ulan", "buwan", ["tela", "oso"], 2],
  ["saging", "gising", ["puno", "lata"], 3],
  ["tasa", "masa", ["ilog", "yelo"], 1],
  ["puso", "oso", ["ulan", "aklat"], 1],
];

/**
 * Spellings the speech recognizer legitimately returns for a *correct* reading.
 * Loanwords and digraphs (Marungko stage 7) are the usual offenders: Whisper
 * writes "krus" as "cross" and "dyip" as "deep". Without these, a child who
 * reads the word perfectly would be scored as making an error.
 * Reading specialists can extend this list per word in the Word bank.
 */
const ASR_VARIANTS: Record<string, string> = {
  krus: "cross, kurs",
  dyip: "deep, jeep, dip, dape, dyp",
  tsinelas: "chinelas, sinelas, sinilas, sinalas, tsinelas",
  mangga: "manga",
  bulaklak: "bulaklaq, bulaklac",
  kotse: "kotche, coche",
  radyo: "radio",
  tren: "train",
  plato: "platto",
  bus: "boss, bas",
};

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

  console.log(`Seeding ${WORDS.length} words…`);
  for (const [text, syllables, pattern, stage, level, meaningEn] of WORDS) {
    await prisma.word.create({
      data: { text, syllables, pattern, stage, level, meaningEn, variants: ASR_VARIANTS[text] ?? "" },
    });
  }

  console.log(`Seeding ${RHYMES.length} rhyme items…`);
  for (const [prompt, answer, distractors, level] of RHYMES) {
    await prisma.phonItem.create({
      data: { type: "RHYME", prompt, answer, options: JSON.stringify([answer, ...distractors]), level },
    });
  }

  console.log("Seeding demo accounts…");
  const password = await bcrypt.hash("lexora123", 10);

  await prisma.user.create({
    data: { email: "specialist@lexora.ph", password, name: "Teacher Maria Santos", role: "SPECIALIST" },
  });

  const juan = await prisma.user.create({
    data: {
      email: "learner1@lexora.ph", password, name: "Juan", role: "LEARNER",
      learnerProfile: { create: { level: 2, stage: 4 } },
    },
    include: { learnerProfile: true },
  });

  await prisma.user.create({
    data: {
      email: "learner2@lexora.ph", password, name: "Ana", role: "LEARNER",
      learnerProfile: { create: {} },
    },
  });

  // ── Demo reading history for Juan: 14 days, accuracy trending upward ──
  console.log("Generating demo reading history…");
  const words = await prisma.word.findMany({ where: { level: { lte: 2 }, stage: { lte: 5 } } });
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
