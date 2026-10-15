import { prisma } from "./db";

/**
 * The practice list as lessons and checks (spec 2026-10-16, §3).
 *
 * A lesson models the word first ("Ang salitang ito ay bahay. Ikaw naman!")
 * and teaches; it never counts as progress. A check is the child reading a
 * word they were taught on an earlier day, alone; two correct checks, on two
 * different days, take the word off the list. None of it counts toward the
 * study's figures (src/lib/measures.ts).
 *
 * Days are Manila calendar days as YYYY-MM-DD (dayKey in time.ts), stored in
 * DATE columns as midnight UTC of that date.
 */
export type PracticeMode = "lesson" | "check";
export type PracticeProgress = { mode: PracticeMode; streak: number; mastered: boolean };

/** The YYYY-MM-DD a DATE column holds, or null. */
export function practiceDayKey(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** The value to store in a DATE column for a YYYY-MM-DD day. */
export function practiceDayDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/**
 * A check if the word has been taught and has not come up today; a lesson
 * otherwise. Every check marks the word seen, so two checks can never fall on
 * the same day.
 */
export function practiceModeFor(
  item: { lastTaughtOn: Date | null; lastSeenOn: Date | null },
  today: string
): PracticeMode {
  return item.lastTaughtOn !== null && practiceDayKey(item.lastSeenOn) !== today ? "check" : "lesson";
}

/** Record a first Practice reading against its list word and return its progress. */
export async function applyPracticeReading(
  item: { id: string; streak: number },
  mode: PracticeMode,
  correct: boolean,
  today: string
): Promise<PracticeProgress> {
  const day = practiceDayDate(today);
  const data =
    mode === "lesson"
      ? { lastTaughtOn: day, lastSeenOn: day }
      : correct
        ? { lastSeenOn: day, streak: item.streak + 1, mastered: item.streak + 1 >= 2 }
        : // A misread check is followed by the lesson, so it is taught today.
          { lastSeenOn: day, lastTaughtOn: day, streak: 0, mastered: false };
  const updated = await prisma.practiceItem.update({ where: { id: item.id }, data });
  return { mode, streak: updated.streak, mastered: updated.mastered };
}
