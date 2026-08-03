import { prisma } from "./db";

export type ExerciseType =
  | "READ_ALOUD"
  | "LISTEN_CHOOSE"
  | "SYLLABLES"
  | "RHYME"
  | "FIRST_SOUND"
  | "PRACTICE";

export type ExerciseItem = {
  wordId: string | null;
  target: string; // the word being assessed
  syllables: string | null;
  options: string[] | null; // choice-based activities
  answer: string | null; // correct option
  hasAudio: boolean; // stored Filipino pronunciation of the whole word
  hasSyllAudio: boolean; // stored syllable-by-syllable pronunciation
  audioVersion: number; // busts cached clips after a specialist re-records
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
  version: Map<string, number>;
}> {
  const [withWord, withSyll, versions] = await Promise.all([
    prisma.word.findMany({
      where: { OR: [{ audioWord: { not: null } }, { audioWordHuman: { not: null } }] },
      select: { id: true },
    }),
    prisma.word.findMany({
      where: { OR: [{ audioSyll: { not: null } }, { audioSyllHuman: { not: null } }] },
      select: { id: true },
    }),
    prisma.word.findMany({ select: { id: true, audioVersion: true } }),
  ]);
  return {
    word: new Set(withWord.map((w) => w.id)),
    syll: new Set(withSyll.map((w) => w.id)),
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
 * which would make accuracy gains meaningless. Rotation keeps sessions varied
 * while staying inside the level the adaptive logic has chosen.
 */
async function wordPool(learnerId: string, level: number, stage: number): Promise<WordRow[]> {
  const [pool, recent] = await Promise.all([
    prisma.word.findMany({
      where: { level: { lte: level }, stage: { lte: stage } },
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
  count = 8
): Promise<ExerciseItem[]> {
  const [profile, audio] = await Promise.all([
    prisma.learnerProfile.findUniqueOrThrow({ where: { id: learnerId } }),
    audioIndex(),
  ]);
  const stage = Math.max(profile.stage, Math.min(7, profile.level + 2));

  const flags = (id: string | null) => ({
    hasAudio: id ? audio.word.has(id) : false,
    hasSyllAudio: id ? audio.syll.has(id) : false,
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
      where: { text: { in: chosen.map((it) => it.prompt) } },
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

  // SYLLABLES — count the syllables (pantig) of the word
  return targets.map((w) => {
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
    };
  });
}
