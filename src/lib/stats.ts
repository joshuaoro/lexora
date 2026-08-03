import { prisma } from "./db";

export type DailyAccuracy = { day: string; accuracy: number | null };

const READ_TYPES = ["READ_ALOUD", "PRACTICE"];

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Daily reading accuracy for the last `days` calendar days (null = no practice). */
export async function dailyAccuracy(learnerId: string, days = 14): Promise<DailyAccuracy[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const attempts = await prisma.attempt.findMany({
    where: { learnerId, activityType: { in: READ_TYPES }, createdAt: { gte: start } },
    select: { correct: true, createdAt: true },
  });

  const buckets = new Map<string, { correct: number; total: number }>();
  for (const a of attempts) {
    const key = dayKey(a.createdAt);
    const b = buckets.get(key) ?? { correct: 0, total: 0 };
    b.total += 1;
    if (a.correct) b.correct += 1;
    buckets.set(key, b);
  }

  const series: DailyAccuracy[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const b = buckets.get(dayKey(d));
    series.push({
      day: dayLabel(d),
      accuracy: b ? Math.round((b.correct / b.total) * 100) : null,
    });
  }
  return series;
}

export async function learnerSummary(learnerId: string) {
  const since14 = new Date();
  since14.setHours(0, 0, 0, 0);
  since14.setDate(since14.getDate() - 13);

  const [allReads, reads14, sessionAgg, sessionCount] = await Promise.all([
    prisma.attempt.groupBy({
      by: ["correct"],
      where: { learnerId, activityType: { in: READ_TYPES } },
      _count: true,
    }),
    prisma.attempt.count({
      where: { learnerId, activityType: { in: READ_TYPES }, createdAt: { gte: since14 } },
    }),
    prisma.activitySession.aggregate({
      where: { learnerId },
      _sum: { durationMs: true },
    }),
    // Abandoned sessions (started but never finished) don't count
    prisma.activitySession.count({ where: { learnerId, total: { gt: 0 } } }),
  ]);

  const total = allReads.reduce((n, g) => n + g._count, 0);
  const correct = allReads.find((g) => g.correct)?._count ?? 0;

  return {
    overallAccuracy: total ? Math.round((correct / total) * 100) : 0,
    wordsRead14: reads14,
    minutesPracticed: Math.round((sessionAgg._sum.durationMs ?? 0) / 60000),
    activitiesCompleted: sessionCount,
  };
}

/** Error-pattern distribution across all scored oral readings. */
export async function errorPatterns(learnerId: string) {
  const groups = await prisma.attempt.groupBy({
    by: ["errorType"],
    where: { learnerId, activityType: { in: READ_TYPES }, correct: false },
    _count: true,
  });
  const order = ["substitution", "omission", "insertion", "no_response"];
  const labels: Record<string, string> = {
    substitution: "Substitution",
    omission: "Omission",
    insertion: "Insertion",
    no_response: "No response",
  };
  return order.map((key) => ({
    type: labels[key],
    count: groups.find((g) => g.errorType === key)?._count ?? 0,
  }));
}

/** Accuracy grouped by word difficulty level (1–5). */
export async function accuracyByLevel(learnerId: string) {
  const attempts = await prisma.attempt.findMany({
    where: { learnerId, activityType: { in: READ_TYPES }, word: { isNot: null } },
    select: { correct: true, word: { select: { level: true } } },
  });
  const buckets = new Map<number, { correct: number; total: number }>();
  for (const a of attempts) {
    const level = a.word!.level;
    const b = buckets.get(level) ?? { correct: 0, total: 0 };
    b.total++;
    if (a.correct) b.correct++;
    buckets.set(level, b);
  }
  return [1, 2, 3, 4, 5].map((level) => {
    const b = buckets.get(level);
    return {
      level: `Level ${level}`,
      accuracy: b ? Math.round((b.correct / b.total) * 100) : null,
      attempts: b?.total ?? 0,
    };
  });
}

/**
 * Accuracy grouped by syllable structure.
 *
 * The most actionable view a reading specialist gets: "reads CVCV fine, fails
 * on clusters" points straight at what to teach next, in a way that overall
 * accuracy or a level number cannot. Raw patterns are collapsed into the
 * families that matter instructionally.
 */
export type PatternFamily =
  | "Open (CV·CV)"
  | "Closed syllable"
  | "Vowel pair"
  | "Consonant cluster"
  | "ng words"
  | "Long (4+ syllables)";

export function patternFamily(pattern: string, syllables: string): PatternFamily {
  if (pattern.includes("(ng)")) return "ng words";
  if (syllables.split("-").length >= 4) return "Long (4+ syllables)";

  const VOWELS = "aeiou";
  const hasOnsetCluster = syllables
    .split("-")
    .some((s) => s.length > 1 && !VOWELS.includes(s[0]) && !VOWELS.includes(s[1]));
  if (hasOnsetCluster) return "Consonant cluster";

  if (/VV/.test(pattern)) return "Vowel pair";
  if (/C$/.test(pattern)) return "Closed syllable";
  return "Open (CV·CV)";
}

export async function accuracyByPattern(learnerId: string) {
  const attempts = await prisma.attempt.findMany({
    where: { learnerId, activityType: { in: READ_TYPES }, word: { isNot: null } },
    select: { correct: true, word: { select: { pattern: true, syllables: true } } },
  });

  const buckets = new Map<string, { correct: number; total: number }>();
  for (const a of attempts) {
    const family = patternFamily(a.word!.pattern, a.word!.syllables);
    const b = buckets.get(family) ?? { correct: 0, total: 0 };
    b.total++;
    if (a.correct) b.correct++;
    buckets.set(family, b);
  }

  const ORDER: PatternFamily[] = [
    "Open (CV·CV)",
    "Closed syllable",
    "Vowel pair",
    "Consonant cluster",
    "ng words",
    "Long (4+ syllables)",
  ];

  return ORDER.map((family) => {
    const b = buckets.get(family);
    return {
      family,
      accuracy: b && b.total > 0 ? Math.round((b.correct / b.total) * 100) : null,
      attempts: b?.total ?? 0,
    };
  }).filter((row) => row.attempts > 0); // only show structures actually attempted
}

/** Accuracy grouped by Marungko stage (1–7). */
export async function accuracyByStage(learnerId: string) {
  const attempts = await prisma.attempt.findMany({
    where: { learnerId, activityType: { in: READ_TYPES }, word: { isNot: null } },
    select: { correct: true, word: { select: { stage: true } } },
  });
  const buckets = new Map<number, { correct: number; total: number }>();
  for (const a of attempts) {
    const stage = a.word!.stage;
    const b = buckets.get(stage) ?? { correct: 0, total: 0 };
    b.total++;
    if (a.correct) b.correct++;
    buckets.set(stage, b);
  }
  return [1, 2, 3, 4, 5, 6, 7].map((stage) => {
    const b = buckets.get(stage);
    return {
      stage: `Stage ${stage}`,
      accuracy: b ? Math.round((b.correct / b.total) * 100) : null,
      attempts: b?.total ?? 0,
    };
  });
}
