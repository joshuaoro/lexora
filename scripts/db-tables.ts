/**
 * Table order for backup and restore.
 *
 * Parents first: restore replays this order so foreign keys are always
 * satisfied, and deletes in reverse for the same reason.
 *
 * Kept in its own module so `restore` can share it without importing
 * `backup`, which would run a backup as a side effect of the import.
 */
export const TABLE_ORDER = [
  "User",
  "Word",
  "PhonItem",
  "LearnerProfile",
  "ActivitySession",
  "Attempt",
  "AttemptReview",
  "PracticeItem",
] as const;
