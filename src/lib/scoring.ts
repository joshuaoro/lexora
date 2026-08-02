/**
 * Word-level reading assessment: compares the ASR transcript of the learner's
 * oral reading against the target word and classifies the error type.
 * Pure functions — usable on both server and client.
 */

export type ErrorType = "correct" | "substitution" | "omission" | "insertion" | "no_response";

export type ReadingScore = {
  correct: boolean;
  score: number; // best similarity 0–1
  heard: string; // the closest token the ASR heard
  errorType: ErrorType;
};

/** Lowercase, strip diacritics/punctuation, keep letters only. */
export function normalizeWord(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics (ñ → n)
    .replace(/[^a-z\s-]/g, "")
    .replace(/-/g, "")
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

export function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

/**
 * Word-level decoding is scored strictly: at 0.95 no single substituted or
 * dropped letter can pass for any word in the bank (the closest case is a
 * 10-letter word at 0.90). This matters because letter substitutions —
 * "buhay" for "bahay", "dola" for "bola" — are exactly the misreadings the
 * system exists to detect, and a reading specialist would mark them wrong.
 * The remaining tolerance absorbs ASR spelling noise on longer words.
 * Override with SCORE_THRESHOLD to loosen or tighten after comparing the
 * system's scoring against specialist judgments.
 */
export const DEFAULT_SCORE_THRESHOLD = 0.95;

/**
 * Score an oral reading of `target` given the raw ASR `transcript`.
 * The transcript may contain several tokens (the ASR can return a phrase),
 * so the best-matching token is used.
 *
 * Acceptance: similarity ≥ `threshold` (see DEFAULT_SCORE_THRESHOLD), or an
 * exact match for very short words (≤ 3 letters). The raw similarity is kept
 * on every attempt so near-misses stay visible to the reading specialist.
 */
export function scoreReading(
  target: string,
  transcript: string | null | undefined,
  threshold: number = DEFAULT_SCORE_THRESHOLD,
  variants: string[] = []
): ReadingScore {
  const t = normalizeWord(target);
  const raw = normalizeWord(transcript ?? "");

  if (!raw) {
    return { correct: false, score: 0, heard: "", errorType: "no_response" };
  }

  const tokens = raw.split(/\s+/).filter(Boolean);
  const candidates = [...tokens, tokens.join("")];

  let best = "";
  let bestScore = -1;
  for (const c of candidates) {
    const s = similarity(t, c);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }

  // Accepted spellings for the same correct reading — the recognizer writes
  // some loanwords in English orthography ("krus" → "cross"), which must not
  // be counted as a misreading. Compared exactly, so they never mask an error.
  const accepted = variants.map(normalizeWord).filter(Boolean);
  const matchesVariant = accepted.length > 0 && candidates.some((c) => accepted.includes(c));

  const correct = matchesVariant || (t.length <= 3 ? best === t : bestScore >= threshold);

  let errorType: ErrorType = "correct";
  if (!correct) {
    if (best.length < t.length) errorType = "omission";
    else if (best.length > t.length) errorType = "insertion";
    else errorType = "substitution";
  }

  return { correct, score: Math.max(0, bestScore), heard: best, errorType };
}
