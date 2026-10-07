/**
 * How long a child's voice recording is kept, in days.
 *
 * Kept apart from the sweep itself so the privacy notice can state the real
 * policy without pulling the database client into a static page — the number
 * shown to families and the number enforced are then the same by construction,
 * rather than by someone remembering to update the prose.
 *
 * Recordings exist so a specialist can replay a reading during the
 * scoring-reliability check and hear a self-correction. That purpose has a
 * shelf life; the recordings are personal data belonging to a minor, and the
 * Data Privacy Act expects them to be held no longer than the purpose needs.
 *
 * The default outlasts a study of this size — several months of practice plus
 * the write-up. Set RECORDING_RETENTION_DAYS to change it, or to 0 to keep
 * recordings until they are cleared by hand from the learner page.
 */
export const DEFAULT_RETENTION_DAYS = 180;

export function retentionDays(): number {
  const value = process.env.RECORDING_RETENTION_DAYS?.trim();
  // An empty value is "not set", not zero. Number("") is 0, and 0 means "keep
  // forever" — so a variable created blank in a hosting dashboard would have
  // silently switched off the deletion the privacy notice promises families.
  if (!value) return DEFAULT_RETENTION_DAYS;
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw < 0) return DEFAULT_RETENTION_DAYS;
  return Math.floor(raw);
}
