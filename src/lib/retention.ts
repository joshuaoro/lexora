import { prisma } from "./db";
import { retentionDays } from "./retention-policy";

/**
 * Drop this learner's recordings that are past the retention window.
 *
 * Runs when a learner starts an activity rather than on a schedule: it is a
 * cheap indexed update, it keeps every learner sweeping their own data, and it
 * needs no cron on a deployment that has none.
 *
 * Only the audio is removed. Transcripts, scores, error types, response times
 * and specialist reviews all survive, so no reported figure changes.
 */
export async function purgeExpiredRecordings(learnerId: string): Promise<number> {
  const days = retentionDays();
  if (days === 0) return 0;

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const { count } = await prisma.attempt.updateMany({
    where: { learnerId, audio: { not: null }, createdAt: { lt: cutoff } },
    data: { audio: null },
  });
  return count;
}
