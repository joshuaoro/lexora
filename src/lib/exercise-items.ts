import { prisma } from "./db";
import { effectiveStage } from "./marungko";
import { firstSound, isLoneVowel, letterSoundUrl } from "./letter-sounds";

export type ExerciseType =
  | "READ_ALOUD"
  | "LISTEN_CHOOSE"
  | "BLEND"
  | "SYLLABLES"
  | "RHYME"
  | "FIRST_SOUND"
  | "CHANGE_SOUND"
  | "PRACTICE"
  | "PSEUDO_PROBE";

export type ExerciseItem = {
  wordId: string | null;
  target: string; // the word being assessed
  syllables: string | null;
  options: string[] | null; // choice-based activities
  answer: string | null; // correct option
  hasAudio: boolean; // stored Filipino pronunciation of the whole word
  hasSyllAudio: boolean; // stored syllable-by-syllable pronunciation
  hasSyllHuman: boolean; // ...recorded by a specialist, which is played as recorded
  audioVersion: number; // busts cached clips after a specialist re-records
  /**
   * Per syllable, a specialist's recording to play in place of the voice —
   * set for a lone vowel, which the voice would say as a letter name.
   */
  partClips?: (string | null)[];
  /** Change the sound: the word heard first, and the two recorded sounds swapped. */
  swap?: {
    fromText: string;
    fromWordId: string;
    fromHasAudio: boolean;
    fromVersion: number;
    fromSound: string;
    toSound: string;
  };
};

/**
 * Word fields the exercises need. The audio columns hold base64 clips, so they
 * are never selected directly — only whether they exist.
 */
const WORD_FIELDS = {
  id: true,
  text: true,
  syllables: true,
  level: true,
  stage: true,
} as const;

type WordRow = { id: string; text: string; syllables: string; level: number; stage: number };

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

/**
 * Which words have stored pronunciation audio, and at what version.
 * A specialist recording counts the same as a generated clip — the serving
 * route picks whichever should win.
 */
async function audioIndex(): Promise<{
  word: Set<string>;
  syll: Set<string>;
  syllHuman: Set<string>;
  version: Map<string, number>;
}> {
  const [withWord, withSyll, withSyllHuman, versions] = await Promise.all([
    prisma.word.findMany({
      where: { OR: [{ audioWord: { not: null } }, { audioWordHuman: { not: null } }] },
      select: { id: true },
    }),
    prisma.word.findMany({
      where: { OR: [{ audioSyll: { not: null } }, { audioSyllHuman: { not: null } }] },
      select: { id: true },
    }),
    prisma.word.findMany({ where: { audioSyllHuman: { not: null } }, select: { id: true } }),
    prisma.word.findMany({ select: { id: true, audioVersion: true } }),
  ]);
  return {
    word: new Set(withWord.map((w) => w.id)),
    syll: new Set(withSyll.map((w) => w.id)),
    syllHuman: new Set(withSyllHuman.map((w) => w.id)),
    version: new Map(versions.map((w) => [w.id, w.audioVersion])),
  };
}

/** How many of the learner's most recent attempts count as "seen lately". */
const RECENT_WINDOW = 40;

/**
 * Word pool matched to the learner's level and Marungko stage, ordered so the
 * learner meets words they have not seen recently first.
 *
 * Without this, sessions draw from the same small level pool every time and a
 * learner can memorise a handful of words rather than learn to decode them —
 * which would make the accuracy record meaningless. Rotation keeps sessions varied
 * while staying inside the level the adaptive logic has chosen.
 */
async function wordPool(learnerId: string, level: number, stage: number): Promise<WordRow[]> {
  const [pool, recent] = await Promise.all([
    prisma.word.findMany({
      // Probe non-words share this table and must never surface in ordinary
      // practice: meeting one during a session would teach it, and a taught
      // non-word stops measuring decoding the moment it becomes familiar.
      where: { level: { lte: level }, stage: { lte: stage }, isPseudo: false },
      select: WORD_FIELDS,
    }),
    prisma.attempt.findMany({
      where: { learnerId, wordId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: RECENT_WINDOW,
      select: { wordId: true },
    }),
  ]);

  // Most recent first, so index 0 is the freshest — a lower index means the
  // word was seen more recently and should wait longer before returning.
  const lastSeen = new Map<string, number>();
  recent.forEach((a, i) => {
    if (a.wordId && !lastSeen.has(a.wordId)) lastSeen.set(a.wordId, i);
  });

  const rank = (w: WordRow) => {
    const seenAt = lastSeen.get(w.id);
    return seenAt === undefined ? Infinity : seenAt; // unseen words first
  };

  const order = (rows: WordRow[]) =>
    shuffle(rows).sort((a, b) => rank(b) - rank(a));

  // Words at the learner's level lead; easier ones pad a thin level.
  return [...order(pool.filter((w) => w.level === level)), ...order(pool.filter((w) => w.level < level))];
}

export async function buildItems(
  learnerId: string,
  type: ExerciseType,
  count = 8,
  // Pages already hold the profile from requireLearner; passing it avoids a
  // second lookup and the crash when the row has been erased mid-session.
  known?: { level: number; stage: number }
): Promise<ExerciseItem[]> {
  const [loaded, audio, recordedSounds] = await Promise.all([
    known ? null : prisma.learnerProfile.findUnique({ where: { id: learnerId } }),
    audioIndex(),
    prisma.letterSound.findMany({ select: { sound: true, version: true } }),
  ]);
  const profile = known ?? loaded;
  if (!profile) return [];
  const stage = effectiveStage(profile.level, profile.stage);

  // The letter sounds a specialist has recorded, and at what version.
  const sounds = new Map(recordedSounds.map((r) => [r.sound, r.version]));
  const soundUrl = (sound: string) => letterSoundUrl(sound, sounds.get(sound) ?? 1);

  /**
   * Whether a word's parts can be spoken properly, one at a time.
   *
   * A syllable that is a lone vowel (the "a" of a-so) can only come from a
   * specialist's recording: the voice says "ey", and the research team heard it
   * sound "so English" on 9 October. So a word with a lone vowel nobody has
   * recorded is left out of the activities that speak its parts — unless a
   * specialist recorded the word's syllables whole, which is played as it is.
   */
  const speakable = (w: WordRow) =>
    audio.syllHuman.has(w.id) ||
    w.syllables.split("-").every((part) => !isLoneVowel(part) || sounds.has(part));
  const partClips = (w: WordRow) =>
    w.syllables.split("-").map((part) => (isLoneVowel(part) && sounds.has(part) ? soundUrl(part) : null));

  const flags = (id: string | null) => ({
    hasAudio: id ? audio.word.has(id) : false,
    hasSyllAudio: id ? audio.syll.has(id) : false,
    hasSyllHuman: id ? audio.syllHuman.has(id) : false,
    audioVersion: (id && audio.version.get(id)) || 1,
  });

  // Rhyming and sound isolation both come from the curated item bank and are
  // presented the same way: hear the prompt, pick the matching word.
  if (type === "RHYME" || type === "FIRST_SOUND") {
    // Match difficulty to the learner, widening the net if too few items exist
    // at or below their level.
    const atLevel = await prisma.phonItem.findMany({
      where: { type, level: { lte: profile.level } },
    });
    const items =
      atLevel.length >= count ? atLevel : await prisma.phonItem.findMany({ where: { type } });
    const chosen = shuffle(items).slice(0, count);

    // Rhyme prompts are plain text, so match them to the word bank by text to
    // reuse the stored pronunciation where one exists.
    const bank = await prisma.word.findMany({
      // Real words only, so a prompt can never pick up a probe item's id.
      where: { text: { in: chosen.map((it) => it.prompt) }, isPseudo: false },
      select: { id: true, text: true },
    });
    const byText = new Map(bank.map((w) => [w.text, w.id]));

    return chosen.map((it) => {
      const wordId = byText.get(it.prompt) ?? null;
      return {
        wordId,
        target: it.prompt,
        syllables: null,
        options: shuffle(JSON.parse(it.options) as string[]),
        answer: it.answer,
        ...flags(wordId),
      };
    });
  }

  /**
   * The decoding probe: non-words only.
   *
   * Drawn at or below the learner's own stage so every letter has been taught —
   * the probe tests whether they can blend letters they know into a word they
   * have never met, not whether they can guess at letters they have never seen.
   *
   * Ordered at random rather than by the rotation the practice pool uses: there
   * is nothing to space out here, because a child should never see the same
   * probe item often enough for spacing to matter.
   */
  if (type === "PSEUDO_PROBE") {
    const items = await prisma.word.findMany({
      where: { isPseudo: true, stage: { lte: stage } },
      select: WORD_FIELDS,
    });
    return shuffle(items)
      .slice(0, count)
      .map((w) => ({
        wordId: w.id,
        target: w.text,
        syllables: w.syllables,
        options: null,
        answer: null,
        // Never any audio, and the flags say so regardless of what the database
        // holds — a probe item the child can listen to hands them the answer.
        hasAudio: false,
        hasSyllAudio: false,
        hasSyllHuman: false,
        audioVersion: 1,
      }));
  }

  if (type === "PRACTICE") {
    const practice = await prisma.practiceItem.findMany({
      where: { learnerId, mastered: false },
      orderBy: [{ missCount: "desc" }, { updatedAt: "desc" }],
      take: count,
      include: { word: { select: WORD_FIELDS } },
    });
    return practice.map((p) => ({
      wordId: p.wordId,
      target: p.word.text,
      syllables: p.word.syllables,
      options: null,
      answer: null,
      ...flags(p.wordId),
    }));
  }

  const pool = await wordPool(learnerId, profile.level, stage);
  const targets = pool.slice(0, count);

  if (type === "READ_ALOUD") {
    return targets.map((w) => ({
      wordId: w.id,
      target: w.text,
      syllables: w.syllables,
      options: null,
      answer: null,
      ...flags(w.id),
    }));
  }

  if (type === "LISTEN_CHOOSE") {
    return targets.map((w) => {
      // Distractors that look similar: same first letter or same length first
      const others = pool.filter((o) => o.id !== w.id);
      const similar = others.filter(
        (o) => o.text[0] === w.text[0] || Math.abs(o.text.length - w.text.length) <= 1
      );
      const distractors = shuffle(similar.length >= 2 ? similar : others)
        .slice(0, 2)
        .map((o) => o.text);
      return {
        wordId: w.id,
        target: w.text,
        syllables: w.syllables,
        options: shuffle([w.text, ...distractors]),
        answer: w.text,
        ...flags(w.id),
      };
    });
  }

  /**
   * Change the sound — phoneme-level manipulation, the top of the proposal's
   * phonological-awareness sequence. The child hears a word, then two sounds,
   * and finds the word made by swapping the first for the second: bata, /b/,
   * /m/ → mata.
   *
   * Built from pairs of real words in the learner's pool that differ only in
   * their first sound, and only where a specialist has recorded both sounds — a
   * voice cannot say /b/ without saying "bi". The wrong options are the word
   * unchanged (a child who did not make the swap) and, where the bank has one, a
   * third word from the same family (lata), so the second sound has to be heard
   * rather than guessed. No answer word comes up twice in a run.
   */
  if (type === "CHANGE_SOUND") {
    const families = new Map<string, WordRow[]>();
    for (const w of pool) {
      const first = firstSound(w.text);
      if (!first) continue;
      const rest = w.text.slice(first.length);
      families.set(rest, [...(families.get(rest) ?? []), w]);
    }
    const pairs: { from: WordRow; to: WordRow; family: WordRow[] }[] = [];
    for (const family of families.values()) {
      for (const from of family) {
        for (const to of family) {
          const a = firstSound(from.text)!;
          const b = firstSound(to.text)!;
          if (a !== b && sounds.has(a) && sounds.has(b)) pairs.push({ from, to, family });
        }
      }
    }
    const chosen: typeof pairs = [];
    const answers = new Set<string>();
    for (const pair of shuffle(pairs)) {
      if (chosen.length === count) break;
      if (answers.has(pair.to.id)) continue;
      answers.add(pair.to.id);
      chosen.push(pair);
    }
    return chosen.map(({ from, to, family }) => {
      const sameShape = (w: WordRow) =>
        w.syllables.split("-").length === to.syllables.split("-").length;
      const third =
        shuffle(family.filter((w) => w.id !== from.id && w.id !== to.id))[0] ??
        shuffle(pool.filter((w) => w.id !== from.id && w.id !== to.id && sameShape(w)))[0];
      return {
        wordId: to.id,
        target: to.text,
        syllables: to.syllables,
        options: shuffle([to.text, from.text, ...(third ? [third.text] : [])]),
        answer: to.text,
        ...flags(to.id),
        swap: {
          fromText: from.text,
          fromWordId: from.id,
          fromHasAudio: audio.word.has(from.id),
          fromVersion: audio.version.get(from.id) || 1,
          fromSound: soundUrl(firstSound(from.text)!),
          toSound: soundUrl(firstSound(to.text)!),
        },
      };
    });
  }

  /**
   * Syllable blending: the child hears the word only in parts — "ba… ta" — and
   * picks the word those parts make.
   *
   * The whole word is never played before the answer, or this is Listen &
   * choose again. And the wrong options share a part with the target where the
   * bank allows it — same first syllable or same last — so catching "ba…"
   * alone is not enough: the parts have to be put together. One-syllable words
   * have nothing to blend and are left out.
   *
   * So are words whose parts cannot be spoken properly yet — a lone vowel
   * nobody has recorded (see `speakable` above).
   */
  if (type === "BLEND") {
    const parts = (w: WordRow) => w.syllables.split("-");
    const blendable = pool.filter((w) => parts(w).length >= 2 && speakable(w));
    return blendable.slice(0, count).map((w) => {
      const mine = parts(w);
      const others = blendable.filter((o) => o.text !== w.text);
      const sharesPart = (o: WordRow) => {
        const theirs = parts(o);
        return theirs[0] === mine[0] || theirs[theirs.length - 1] === mine[mine.length - 1];
      };
      const sameLength = (o: WordRow) => parts(o).length === mine.length;
      const distractors: string[] = [];
      for (const group of [
        shuffle(others.filter(sharesPart)),
        shuffle(others.filter((o) => !sharesPart(o) && sameLength(o))),
        shuffle(others),
      ]) {
        for (const o of group) {
          if (distractors.length === 2) break;
          if (!distractors.includes(o.text)) distractors.push(o.text);
        }
      }
      return {
        wordId: w.id,
        target: w.text,
        syllables: w.syllables,
        options: shuffle([w.text, ...distractors]),
        answer: w.text,
        ...flags(w.id),
        partClips: partClips(w),
      };
    });
  }

  // SYLLABLES — count the syllables (pantig) of the word. Its "Hear the parts"
  // speaks them one at a time too, so the same rule decides which words qualify.
  return pool.filter(speakable).slice(0, count).map((w) => {
    const n = w.syllables.split("-").length;
    const opts = new Set<number>([n]);
    while (opts.size < 3) {
      const cand = n + (Math.random() < 0.5 ? -1 : 1) * (Math.floor(Math.random() * 2) + 1);
      if (cand >= 1 && cand <= 6) opts.add(cand);
    }
    return {
      wordId: w.id,
      target: w.text,
      syllables: w.syllables,
      options: shuffle([...opts].map(String)),
      answer: String(n),
      ...flags(w.id),
      partClips: partClips(w),
    };
  });
}
