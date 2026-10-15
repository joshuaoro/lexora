/**
 * Which readings the study's figures are made of.
 *
 * First readings in Read aloud, and nothing else. A Practice reading is taken
 * after LEXORA has modeled the word (a lesson) or on a word the child has been
 * taught (a check), so it measures learning a word rather than decoding one;
 * a re-read ("Ikaw naman!") follows the word being said. Both are saved and
 * playable, and both stay out of level, accuracy, error patterns, agreement and
 * calibration (spec 2026-10-16, §4).
 *
 * Written out once. It used to be copied as ["READ_ALOUD", "PRACTICE"] into
 * about ten files, which is how a rule drifts between the dashboard and the
 * exports.
 */
export const MEASURED_READING_TYPES: string[] = ["READ_ALOUD"];

/** First readings of the measured types: the filter every figure shares. */
export const MEASURED_READINGS = { activityType: { in: MEASURED_READING_TYPES }, isRetry: false };
