import type { WordEntry } from "./word-bank";

/**
 * LEXORA decoding probe — pronounceable Filipino non-words.
 *
 * Why these exist
 * ---------------
 * Every other word in LEXORA is a real Filipino word, and a real word can be
 * read from memory. After eight weeks on a fixed 254-word bank, a child who
 * improves may have learned to decode — or may simply have learned those 254
 * items. Nothing in the accuracy figure can tell the two apart, and the study
 * claims to measure decoding.
 *
 * A word that has never existed cannot be recognised, only decoded, so it
 * isolates letter–sound knowledge from sight-word recall. That is why nonword
 * reading is the standard probe for this, and why it belongs in a pre/post
 * comparison rather than in daily practice: these are for measuring, never for
 * teaching.
 *
 * How they were built
 * -------------------
 * Each one obeys Filipino phonotactics and the Marungko letter sequence, so a
 * child only ever meets letters they have been taught — the stage is derived
 * from the letters exactly as it is for real words. Patterns and levels mirror
 * the real bank (CVCV = 1, one closed syllable = 2, three syllables = 3) so a
 * probe item is no harder to decode than the practice words it is compared
 * against; only its familiarity differs.
 *
 * Two traps worth recording
 * -------------------------
 * The partner site is in Davao City, where the children speak Cebuano as well
 * as Filipino. A "nonword" that happens to be ordinary Bisaya — linog, lami,
 * balay — is a real word to these particular readers and quietly stops testing
 * decoding. Every entry below was checked against both languages.
 *
 * These are also deliberately not near-misses of common words. malabo → milabo
 * is one vowel away, and a child who reads it as "malabo" has demonstrated
 * lexical guessing rather than a decoding failure, which muddies the very
 * distinction the probe exists to draw.
 */
export const PSEUDOWORDS: WordEntry[] = [
  /* ── Level 1 — two open syllables ─────────────────────────────────────── */
  ["bimo", "bi-mo", "CVCV", 1, ""],
  ["mesu", "me-su", "CVCV", 1, ""],
  ["sobi", "so-bi", "CVCV", 1, ""],
  ["kelo", "ke-lo", "CVCV", 1, ""],
  ["tebu", "te-bu", "CVCV", 1, ""],
  ["gemi", "ge-mi", "CVCV", 1, ""],
  ["riho", "ri-ho", "CVCV", 1, ""],

  /* ── Level 2 — a closed syllable ──────────────────────────────────────── */
  // The early stages are deliberately over-supplied. A learner at Marungko
  // stage 3 can only be shown words built from m, s, a, i, o, b, e and u, and a
  // probe that can only find five such items hands back a five-item run when it
  // asked for eight — a thinner measure exactly where the readers who need it
  // most will be sitting.
  ["sabim", "sa-bim", "CVCVC", 2, ""],
  ["besam", "be-sam", "CVCVC", 2, ""],
  ["misab", "mi-sab", "CVCVC", 2, ""],
  ["bosam", "bo-sam", "CVCVC", 2, ""],
  ["sebim", "se-bim", "CVCVC", 2, ""],
  ["sulek", "su-lek", "CVCVC", 2, ""],
  ["kitam", "ki-tam", "CVCVC", 2, ""],
  ["lakib", "la-kib", "CVCVC", 2, ""],
  ["taklo", "tak-lo", "CVCCV", 2, ""],
  ["yumal", "yu-mal", "CVCVC", 2, ""],
  ["kanit", "ka-nit", "CVCVC", 2, ""],
  ["purad", "pu-rad", "CVCVC", 2, ""],
  ["hudam", "hu-dam", "CVCVC", 2, ""],
  ["pardik", "par-dik", "CVCCVC", 2, ""],

  /* ── Level 3 — three syllables ────────────────────────────────────────── */
  ["obisa", "o-bi-sa", "VCVCV", 3, ""],
  ["tibalo", "ti-ba-lo", "CVCVCV", 3, ""],
  ["batuke", "ba-tu-ke", "CVCVCV", 3, ""],
  ["sadimo", "sa-di-mo", "CVCVCV", 3, ""],
  ["gunayo", "gu-na-yo", "CVCVCV", 3, ""],
];
