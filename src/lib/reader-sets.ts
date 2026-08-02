import { stageLabel } from "./marungko";

type WordLite = { id: string; text: string; level: number; stage: number; audioVersion: number };

export type ReaderWord = {
  id: string | null;
  text: string;
  hasAudio: boolean;
  version?: number;
};
export type ReaderSet = { label: string; words: ReaderWord[] };

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
