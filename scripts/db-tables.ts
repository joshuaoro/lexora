/**
 * Table order for backup and restore.
 *
 * Parents first: restore replays this order so foreign keys are always
 * satisfied, and deletes in reverse for the same reason.
 *
 * Kept in its own module so `restore` can share it without importing
 * `backup`, which would run a backup as a side effect of the import.
 *
 * This list is checked against the live schema on every backup — see
 * assertCoversSchema below. It has to be, because it silently fell behind once:
 * `ReviewErrorTag` arrived with migration 20260811050000 and was not added here,
 * so for a day every backup omitted the specialist observation tags while
 * reporting success. Those tags are a person's judgement of what they heard and
 * cannot be regenerated from anything.
 */
export const TABLE_ORDER = [
  "User",
  "Word",
  "PhonItem",
  // No foreign keys of its own; grouped with the other reference data.
  "SpeechClip",
  "LearnerProfile",
  "ActivitySession",
  "Attempt",
  "AttemptReview",
  // Child of AttemptReview, so it must follow it on the way in.
  "ReviewErrorTag",
  "PracticeItem",
] as const;

/**
 * Tables deliberately left out of the dump.
 *
 * `_prisma_migrations` is schema metadata, not study data, and `prisma migrate
 * deploy` writes it when the schema is created — restoring a copy over the top
 * would fight the migration history rather than protect anything.
 */
const NOT_BACKED_UP = new Set(["_prisma_migrations"]);

/**
 * Fail the backup if the schema has grown a table this list does not know about.
 *
 * A backup that quietly skips a table is worse than no backup, because it
 * reports success and is only discovered to be incomplete at the moment someone
 * needs it. Checking against the live schema means the next migration cannot
 * reopen the gap described above — the backup breaks loudly instead.
 */
export function assertCoversSchema(liveTables: string[]): void {
  const known = new Set<string>([...TABLE_ORDER, ...NOT_BACKED_UP]);
  const missing = liveTables.filter((t) => !known.has(t)).sort();
  if (missing.length === 0) return;

  throw new Error(
    `Backup would omit ${missing.length} table(s): ${missing.join(", ")}.\n` +
      "Add them to TABLE_ORDER in scripts/db-tables.ts — parents before children,\n" +
      "since restore replays the list in order — or list them in NOT_BACKED_UP if\n" +
      "they genuinely hold no study data. Refusing to write a partial backup."
  );
}
