import { stageLabel } from "./marungko";

type WordLite = {
  id: string;
  text: string;
  syllables: string;
  level: number;
  stage: number;
  audioVersion: number;
};

export type ReaderWord = {
  id: string | null;
  text: string;
  /** Hyphenated, as stored in the word bank: "ba-hay". Absent for typed words. */
  syllables?: string;
  hasAudio: boolean;
  version?: number;
};
export type ReaderSet = { label: string; words: ReaderWord[] };

/** The word itself, without punctuation typed around it: `"(Bahay),"` → `Bahay`. */
export function wordCore(text: string): string {
  return text.replace(/^[^\p{L}]+/u, "").replace(/[^\p{L}]+$/u, "");
}

/**
 * Splits a word as it is displayed into its syllables, for the Reader's "Show
 * syllables". `syllables` is the word bank's hyphenated form. The split is made
 * by position, so a typed word keeps its own capitals and the punctuation
 * around it ("Bahay," → "Ba" "hay,").
 *
 * Null when there is nothing to split: a one-syllable word, or text that does
 * not spell the bank word. Typed words are never split by rule. A wrong split
 * on a child's reading surface teaches the wrong unit, and Filipino loanwords
 * break the simple rules, so only the word bank's split, which the specialists
 * review, is shown.
 */
export function syllableParts(text: string, syllables: string | undefined): string[] | null {
  if (!syllables || !syllables.includes("-")) return null;
  const core = wordCore(text);
  const pieces = syllables.split("-");
  const joined = pieces.join("");
  if (joined.length !== core.length || joined.toLowerCase() !== core.toLowerCase()) return null;

  const start = text.indexOf(core);
  const parts: string[] = [];
  let at = 0;
  for (const piece of pieces) {
    parts.push(core.slice(at, at + piece.length));
    at += piece.length;
  }
  parts[0] = text.slice(0, start) + parts[0];
  parts[parts.length - 1] += text.slice(start + core.length);
  return parts;
}

/**
 * Builds the Reader's word sets: a randomized mix matched to the learner's
 * current level/stage, plus one set per Marungko stage.
 *
 * `audioIds` holds the words that have a stored Filipino pronunciation clip,
 * so the client knows whether to play it or fall back to browser speech.
 */
export function buildReaderSets(
  words: WordLite[],
  level: number,
  stage: number,
  myWordsLabel: string,
  audioIds: Set<string>
): ReaderSet[] {
  const toReaderWord = (w: WordLite): ReaderWord => ({
    id: w.id,
    text: w.text,
    syllables: w.syllables,
    hasAudio: audioIds.has(w.id),
    version: w.audioVersion,
  });

  const myWords = words
    .filter((w) => w.level <= level && w.stage <= stage)
    .sort(() => Math.random() - 0.5)
    .slice(0, 12)
    .map(toReaderWord);

  return [
    { label: myWordsLabel, words: myWords },
    ...[1, 2, 3, 4, 5, 6, 7].map((s) => ({
      label: stageLabel(s),
      words: words.filter((w) => w.stage === s).map(toReaderWord),
    })),
  ].filter((set) => set.words.length > 0);
}
