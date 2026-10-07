import { prisma } from "./db";
import { PLAUSIBLE, median } from "./stats";
import { effectiveStage } from "./marungko";

/**
 * Adaptive difficulty: the learner's level (1–5) is recomputed from the most
 * recent attempts recorded *at the current level*, so the windows naturally
 * reset after every level change.
 *
 * This is the study's skill-progression map — "the mastery criteria that a
 * learner must meet at each stage (phonological awareness, then single-word
 * decoding) before the system advances the learner to the next difficulty
 * level". In that order:
 *
 *  1. Phonological awareness: ≥ 8 answers at this level across the listening
 *     activities (blend, count the syllables, rhyme, first sound), ≥ 80%
 *     correct over the latest 12.
 *  2. Single-word decoding: ≥ 8 oral readings at this level, ≥ 85% correct
 *     over the latest 12, and decoding not getting slower.
 *
 *  Both met                                            → level up
 *  ≥ 8 oral readings at this level with accuracy ≤ 50% → level down
 *
 * Demotion reads decoding alone. A child who cannot read the words at a level
 * should not be kept there because they happen to rhyme well.
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

/**
 * Phonological awareness, the first criterion on the map.
 *
 * Judged on the four listening activities together rather than on each one.
 * Asking for all four at every level would hold a child back because a session
 * ran short, not because of anything they cannot do; the per-activity split is
 * shown to the specialist instead, who can see a gap and fill it.
 *
 * Unlike the latency guard, no data here means "not yet": this is a mastery
 * criterion, not a safeguard. A child whose sessions are all read-aloud is
 * held at their level until they have shown it — and the specialist's learner
 * page says so, rather than leaving a level that has stopped moving
 * unexplained. The specialist can still set the level by hand.
 *
 * 80% rather than the 85% asked of reading, because these are three-option
 * choices made from listening: one slip in eight is 88%, two is 75%, and the
 * line sits between them.
 */
export const PA_TYPES = ["BLEND", "SYLLABLES", "RHYME", "FIRST_SOUND"] as const;
const PA_WINDOW = 12;
export const PA_MIN_ANSWERS = 8;
export const PA_THRESHOLD = 0.8;

export const MAX_LEVEL = 5;

type Tally = { answered: number; correct: number };

/** Phonological-awareness answers at a level, newest first, within the window. */
async function paTally(learnerId: string, level: number) {
  const rows = await prisma.attempt.findMany({
    where: { learnerId, levelAtTime: level, activityType: { in: [...PA_TYPES] } },
    orderBy: { createdAt: "desc" },
    take: PA_WINDOW,
    select: { correct: true, activityType: true },
  });
  const byType: Record<string, Tally> = Object.fromEntries(
    PA_TYPES.map((t) => [t, { answered: 0, correct: 0 }])
  );
  for (const r of rows) {
    byType[r.activityType].answered += 1;
    if (r.correct) byType[r.activityType].correct += 1;
  }
  const correct = rows.filter((r) => r.correct).length;
  return {
    answered: rows.length,
    correct,
    met: rows.length >= PA_MIN_ANSWERS && correct / rows.length >= PA_THRESHOLD,
    byType,
  };
}

/** Oral readings at a level, newest first, within the window. */
async function decodingTally(learnerId: string, level: number) {
  const recent = await prisma.attempt.findMany({
    where: {
      learnerId,
      levelAtTime: level,
      activityType: { in: ["READ_ALOUD", "PRACTICE"] },
      // A retry follows the correct word being modelled, so letting it count
      // would move the learner up on repetition rather than on decoding.
      isRetry: false,
    },
    orderBy: { createdAt: "desc" },
    take: WINDOW,
    select: { correct: true },
  });
  const correct = recent.filter((a) => a.correct).length;
  return { answered: recent.length, correct };
}

/**
 * Where a learner stands on the skill-progression map at their current level:
 * what each criterion has seen so far and whether it is met. For the
 * specialist's learner page — built from the same functions the level rule
 * uses, so the panel cannot describe a different rule from the one applied.
 */
export async function progressionStatus(learnerId: string, level: number) {
  const [pa, decoding] = await Promise.all([
    paTally(learnerId, level),
    decodingTally(learnerId, level),
  ]);
  const accurate =
    decoding.answered >= MIN_ATTEMPTS && decoding.correct / decoding.answered >= UP_THRESHOLD;
  const slowing = accurate ? await decodingSlowingDown(learnerId, level) : false;
  return {
    level,
    atMax: level >= MAX_LEVEL,
    pa,
    decoding: { ...decoding, met: accurate && !slowing, slowing },
    rule: {
      paMin: PA_MIN_ANSWERS,
      paThreshold: PA_THRESHOLD,
      paWindow: PA_WINDOW,
      decodingMin: MIN_ATTEMPTS,
      decodingThreshold: UP_THRESHOLD,
      window: WINDOW,
    },
  };
}

export type ProgressionStatus = Awaited<ReturnType<typeof progressionStatus>>;

export async function updateAdaptiveLevel(
  learnerId: string
): Promise<{ level: number; changed: "up" | "down" | null }> {
  // The learner may have been erased mid-session; nothing to adapt.
  const profile = await prisma.learnerProfile.findUnique({ where: { id: learnerId } });
  if (!profile) return { level: 1, changed: null };

  const recent = await decodingTally(learnerId, profile.level);

  if (recent.answered < MIN_ATTEMPTS) return { level: profile.level, changed: null };

  const accuracy = recent.correct / recent.answered;

  let changed: "up" | "down" | null = null;
  let level = profile.level;

  if (accuracy >= UP_THRESHOLD && level < MAX_LEVEL) {
    // Phonological awareness first, then decoding — the map's order.
    if (!(await paTally(learnerId, profile.level)).met) {
      return { level: profile.level, changed: null };
    }
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
    const stage = effectiveStage(level, profile.stage);
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
