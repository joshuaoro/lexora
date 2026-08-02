import { prisma } from "./db";

/**
 * Adaptive difficulty: the learner's level (1–5) is recomputed from the most
 * recent oral-reading attempts recorded *at the current level*, so the window
 * naturally resets after every level change.
 *
 *  - ≥ 8 attempts at this level with accuracy ≥ 85%  → level up
 *  - ≥ 8 attempts at this level with accuracy ≤ 50%  → level down
 */
const WINDOW = 12;
const MIN_ATTEMPTS = 8;
const UP_THRESHOLD = 0.85;
const DOWN_THRESHOLD = 0.5;

export const MAX_LEVEL = 5;

export async function updateAdaptiveLevel(
  learnerId: string
): Promise<{ level: number; changed: "up" | "down" | null }> {
  const profile = await prisma.learnerProfile.findUniqueOrThrow({ where: { id: learnerId } });

  const recent = await prisma.attempt.findMany({
    where: {
      learnerId,
      levelAtTime: profile.level,
      activityType: { in: ["READ_ALOUD", "PRACTICE"] },
    },
    orderBy: { createdAt: "desc" },
    take: WINDOW,
    select: { correct: true },
  });

  if (recent.length < MIN_ATTEMPTS) return { level: profile.level, changed: null };

  const accuracy = recent.filter((a) => a.correct).length / recent.length;

  let changed: "up" | "down" | null = null;
  let level = profile.level;

  if (accuracy >= UP_THRESHOLD && level < MAX_LEVEL) {
    level += 1;
    changed = "up";
  } else if (accuracy <= DOWN_THRESHOLD && level > 1) {
    level -= 1;
    changed = "down";
  }

  if (changed) {
    // The Marungko letter coverage widens as the learner levels up, but never
    // shrinks below what the learner has already reached.
    const stage = Math.max(profile.stage, Math.min(7, level + 2));
    await prisma.learnerProfile.update({ where: { id: learnerId }, data: { level, stage } });
  }

  return { level, changed };
}

/** Register a misread word on the personalized practice list. */
export async function recordMiss(learnerId: string, wordId: string) {
  await prisma.practiceItem.upsert({
    where: { learnerId_wordId: { learnerId, wordId } },
    create: { learnerId, wordId, missCount: 1, source: "AUTO" },
    update: { missCount: { increment: 1 }, streak: 0, mastered: false },
  });
}

/** Track mastery: two consecutive correct practice reads master the word. */
export async function recordPracticeResult(learnerId: string, wordId: string, correct: boolean) {
  const item = await prisma.practiceItem.findUnique({
    where: { learnerId_wordId: { learnerId, wordId } },
  });
  if (!item) return;
  if (correct) {
    const streak = item.streak + 1;
    await prisma.practiceItem.update({
      where: { id: item.id },
      data: { streak, mastered: streak >= 2 },
    });
  } else {
    await prisma.practiceItem.update({
      where: { id: item.id },
      data: { streak: 0, missCount: { increment: 1 }, mastered: false },
    });
  }
}
