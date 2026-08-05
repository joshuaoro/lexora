import { prisma } from "./db";
import { PLAUSIBLE, median } from "./stats";

/**
 * Adaptive difficulty: the learner's level (1–5) is recomputed from the most
 * recent oral-reading attempts recorded *at the current level*, so the window
 * naturally resets after every level change.
 *
 *  - ≥ 8 attempts at this level with accuracy ≥ 85%, and decoding not getting
 *    slower                                            → level up
 *  - ≥ 8 attempts at this level with accuracy ≤ 50%    → level down
 *
 * Why accuracy alone is not enough to move a child up
 * ---------------------------------------------------
 * Filipino spells what it says. In orthographies that regular, dyslexia shows
 * up as slow reading rather than wrong reading — the finding replicates across
 * Spanish, Italian and German, and it is the reason accuracy can sit near
 * ceiling for a child who is still sounding out every word.
 *
 * A level rule reading only accuracy will happily walk that child from level 1
 * to level 5. Each promotion is defensible on its own and the result is a
 * learner drowning in harder words with the underlying difficulty untouched, at
 * exactly the age the study is trying to help them. So a promotion also asks
 * for evidence that decoding is becoming automatic, not merely correct.
 */
const WINDOW = 12;
const MIN_ATTEMPTS = 8;
const UP_THRESHOLD = 0.85;
const DOWN_THRESHOLD = 0.5;

/**
 * The latency guard.
 *
 * Compares the earlier and later halves of the timed correct readings at this
 * level. Getting meaningfully slower while holding accuracy is the signature of
 * effortful compensation, and it holds the level for another window.
 *
 * The tolerance is loose on purpose. This is a handful of readings from a
 * seven-year-old, and a single distracted afternoon should not strand a child
 * who is genuinely ready. It is there to catch a trend, not to police noise —
 * and it can only ever delay a promotion, never force a demotion.
 */
const LATENCY_WINDOW = 24;
const MIN_LATENCY_ATTEMPTS = 8;
const SLOWER_TOLERANCE = 1.25;

export const MAX_LEVEL = 5;

export async function updateAdaptiveLevel(
  learnerId: string
): Promise<{ level: number; changed: "up" | "down" | null }> {
  // The learner may have been erased mid-session; nothing to adapt.
  const profile = await prisma.learnerProfile.findUnique({ where: { id: learnerId } });
  if (!profile) return { level: 1, changed: null };

  const recent = await prisma.attempt.findMany({
    where: {
      learnerId,
      levelAtTime: profile.level,
      activityType: { in: ["READ_ALOUD", "PRACTICE"] },
      // A retry follows the correct word being modelled, so letting it count
      // would move the learner up on repetition rather than on decoding.
      isRetry: false,
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
    if (await decodingSlowingDown(learnerId, profile.level)) {
      return { level: profile.level, changed: null };
    }
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

/**
 * Is this learner's decoding getting slower at their current level?
 *
 * Returns false whenever there is not enough timed data to tell. That default
 * matters: an unproven guard must never be able to trap a learner at a level,
 * so silence here means "no objection", not "hold".
 */
async function decodingSlowingDown(learnerId: string, level: number): Promise<boolean> {
  const timed = await prisma.attempt.findMany({
    where: {
      learnerId,
      levelAtTime: level,
      activityType: { in: ["READ_ALOUD", "PRACTICE"] },
      isRetry: false,
      correct: true,
      responseMs: PLAUSIBLE,
    },
    orderBy: { createdAt: "desc" },
    take: LATENCY_WINDOW,
    select: { responseMs: true },
  });

  if (timed.length < MIN_LATENCY_ATTEMPTS) return false;

  // Query came back newest-first; put it back in reading order so "earlier"
  // means earlier.
  const ms = timed.map((a) => a.responseMs).reverse();
  const half = Math.floor(ms.length / 2);
  const earlier = median(ms.slice(0, half));
  const later = median(ms.slice(half));
  if (earlier === null || later === null || earlier <= 0) return false;

  return later > earlier * SLOWER_TOLERANCE;
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
