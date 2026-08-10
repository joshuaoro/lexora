import { prisma } from "./db";
import { retentionDays } from "./retention-policy";

/**
 * Drop every recording that is past the retention window.
 *
 * Runs when any learner starts an activity rather than on a schedule: it is a
 * cheap update, and it needs no cron on a deployment that has none.
 *
 * Deliberately not scoped to the learner who triggered it. It was, and that
 * quietly broke the promise the privacy notice makes to families: a child only
 * ever swept their own recordings, so a child who stopped using the app never
 * swept anything and their voice stayed in the database forever. The learner
 * most likely to be dormant is one who withdrew from the study — precisely
 * whose recordings should be the first to go.
 *
 * The cost of widening it is close to nothing. Once a sweep has run, the next
 * matches no rows at all, because only recordings that have just crossed the
 * window qualify.
 *
 * Only the audio is removed. Transcripts, scores, error types, response times
 * and specialist reviews all survive, so no reported figure changes.
 */
export async function purgeExpiredRecordings(): Promise<number> {
  const days = retentionDays();
  if (days === 0) return 0;

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const { count } = await prisma.attempt.updateMany({
    where: { audio: { not: null }, createdAt: { lt: cutoff } },
    data: { audio: null },
  });
  return count;
}
