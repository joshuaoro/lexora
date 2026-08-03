/**
 * Prove that consecutive sessions serve different words.
 *
 *   npm run words:rotation
 *
 * This is the property that keeps the study honest. If a level only holds
 * eight words, every session serves the same eight and a learner can memorise
 * them — accuracy would then rise without any decoding improvement, and the
 * intervention data would mean nothing. This simulates a learner working
 * through five sessions at each level and reports how much they overlap.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { buildItems } from "../src/lib/exercise-items";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("Set DATABASE_URL (and ideally DIRECT_URL) in .env");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const SESSIONS = 5;
const ITEMS = 8;

async function main() {
  const email = `rotation-check-${Date.now()}@lexora.test`;
  const user = await prisma.user.create({
    data: {
      email,
      name: "RotationCheck",
      password: "not-a-real-login",
      role: "LEARNER",
      learnerProfile: { create: {} },
    },
    include: { learnerProfile: true },
  });
  const learnerId = user.learnerProfile!.id;

  console.log(`Simulating ${SESSIONS} sessions of ${ITEMS} words at each level\n`);
  console.log("  level   overlap between consecutive sessions   distinct words seen");
  console.log("  " + "-".repeat(64));

  let worstOverlap = 0;
  for (let level = 1; level <= 5; level++) {
    await prisma.learnerProfile.update({ where: { id: learnerId }, data: { level, stage: 1 } });
    await prisma.attempt.deleteMany({ where: { learnerId } });

    const sets: Set<string>[] = [];
    for (let s = 0; s < SESSIONS; s++) {
      const items = await buildItems(learnerId, "READ_ALOUD", ITEMS);
      sets.push(new Set(items.map((i) => i.target)));

      // record the attempts, so the next session knows what was just seen
      await prisma.attempt.createMany({
        data: items.map((i) => ({
          learnerId,
          wordId: i.wordId,
          activityType: "READ_ALOUD",
          target: i.target,
          correct: true,
          score: 1,
          errorType: "correct",
          levelAtTime: level,
        })),
      });
    }

    const overlaps: number[] = [];
    for (let s = 1; s < sets.length; s++) {
      overlaps.push([...sets[s - 1]].filter((w) => sets[s].has(w)).length);
    }
    const distinct = new Set(sets.flatMap((s) => [...s])).size;
    const avg = overlaps.reduce((a, b) => a + b, 0) / overlaps.length;
    worstOverlap = Math.max(worstOverlap, avg);

    const bar = "█".repeat(Math.round(avg)) || "·";
    console.log(
      `    L${level}     ${overlaps.join(", ").padEnd(16)} avg ${avg.toFixed(1)}/8 ${bar.padEnd(9)}${String(distinct).padStart(4)} of ${SESSIONS * ITEMS} slots`
    );
  }

  await prisma.attempt.deleteMany({ where: { learnerId } });
  await prisma.learnerProfile.delete({ where: { id: learnerId } });
  await prisma.user.delete({ where: { id: user.id } });

  const ok = worstOverlap <= 2;
  console.log(
    `\n${ok ? "PASS" : "FAIL"} — worst average overlap ${worstOverlap.toFixed(1)}/${ITEMS} words between consecutive sessions.`
  );
  if (!ok) {
    console.log("Sessions are repeating: add more words at the affected levels.");
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
