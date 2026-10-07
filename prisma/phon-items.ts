/**
 * Phonological-awareness item bank.
 *
 * The study's data set calls for sound-isolation, rhyming, blending and
 * segmentation tasks sequenced from simple to complex. Blending and
 * segmentation are covered by the Listen & choose and syllable-counting
 * activities, which generate from the word bank; the two banks here are the
 * ones that need curated items.
 *
 * Depth matters: a session draws eight items, so a bank of ten would be
 * exhausted in a single sitting and a learner would answer from memory
 * thereafter.
 *
 * Every item must be unambiguous under any reasonable reading of "rhyme" and
 * "same first sound", and `npm run words:check` enforces it:
 *
 *   - a rhyme answer shares the prompt's whole final syllable when that syllable
 *     is open (ma-ta / ba-ta), or its vowel and closing consonant when it is
 *     closed (da-mit / ga-mit). Sharing only a last vowel — lo-lo / lo-bo — is
 *     a rhyme in Tagalog verse but not to a seven-year-old learning to hear one;
 *   - no distractor shares even that last vowel, so no child is marked wrong for
 *     choosing a word a teacher would accept;
 *   - every word is a bank word: syllabified, staged, screened for suitability,
 *     and spoken in the app's own voice.
 *
 * The first version of this bank failed those checks on seventeen items —
 * "tren" was given as rhyming with "krus", "oso" as starting like "ubo", and
 * "suso" appeared despite being on the checker's own list of words to keep away
 * from children. Items are the place a reading specialist looks first.
 */

/** [prompt, answer, distractors, level] */
export type RhymeItem = [prompt: string, answer: string, distractors: string[], level: number];

export const RHYMES: RhymeItem[] = [
  // level 1 — two-syllable, familiar, clearly contrasting distractors
  ["bahay", "buhay", ["bola", "gatas"], 1],
  ["bola", "lola", ["dahon", "mais"], 1],
  ["tasa", "masa", ["ilog", "yelo"], 1],
  ["puso", "oso", ["ulan", "aklat"], 1],
  ["mata", "bata", ["puno", "gulay"], 1],
  ["lolo", "talo", ["mesa", "sakit"], 1],
  ["pito", "dito", ["bola", "ulap"], 1],
  ["sabi", "gabi", ["damo", "takot"], 1],
  ["tela", "dila", ["bato", "hipon"], 1],
  ["buko", "tuko", ["pera", "silid"], 1],
  ["baso", "aso", ["bibe", "dagat"], 1],
  ["hita", "lata", ["kuko", "labas"], 1],
  ["kuya", "tiya", ["bote", "kanin"], 1],
  ["ate", "bote", ["lobo", "gamit"], 1],
  ["sala", "wala", ["puso", "tinig"], 1],

  // level 2 — closed syllables and vowel sequences
  ["ilaw", "araw", ["mesa", "kuto"], 2],
  ["damit", "gamit", ["baso", "ulap"], 2],
  ["ulan", "kanan", ["tela", "oso"], 2],
  ["gatas", "lakas", ["puno", "dila"], 2],
  ["takot", "kamot", ["mata", "hari"], 2],
  ["sakit", "sabit", ["bola", "daga"], 2],
  ["nanay", "tatay", ["baso", "ilog"], 2],
  ["bahay", "sanay", ["kuto", "damo"], 2],
  ["hilaw", "dilaw", ["puso", "mani"], 2],
  ["hapon", "sipon", ["tela", "buko"], 2],
  ["bakod", "pusod", ["lola", "gabi"], 2],
  ["labas", "ubas", ["pito", "yelo"], 2],
  ["kulot", "pulot", ["mesa", "hita"], 2],
  ["lamok", "manok", ["bato", "wika"], 2],
  ["bukas", "lakas", ["dito", "lobo"], 2],

  // level 3 — three syllables and ng words
  ["salamin", "damdamin", ["mesa", "bola"], 3],
  ["payong", "tulong", ["baso", "mata"], 3],
  ["ngiti", "kalapati", ["gulay", "damit"], 3],
  ["salamat", "watawat", ["puso", "lobo"], 3],
  ["kandila", "dila", ["takot", "manok"], 3],
  ["mabilis", "malinis", ["bato", "araw"], 3],
  ["gulong", "tulong", ["tasa", "kanin"], 3],
  ["langit", "sakit", ["puno", "yelo"], 3],
  ["tinapay", "tatay", ["kilo", "ubas"], 3],
  ["kamatis", "atis", ["daga", "hapon"], 3],

  // level 4 — clusters and longer words
  ["plato", "bato", ["saging", "damit"], 4],
  ["prutas", "gatas", ["ngiti", "kandila"], 4],
  ["braso", "baso", ["payong", "malinis"], 4],
  ["prito", "kwento", ["hangin", "tinapay"], 4],
  ["klase", "kotse", ["gulong", "salamat"], 4],
  ["blusa", "prinsesa", ["gulong", "libro"], 4],
];

/**
 * Sound isolation: which word starts with the same sound?
 * The most basic phonological-awareness skill and the one the app was missing.
 *
 * [prompt, answer, distractors, level] — the answer shares the prompt's initial
 * sound; distractors deliberately begin with different ones.
 */
export type FirstSoundItem = [prompt: string, answer: string, distractors: string[], level: number];

export const FIRST_SOUNDS: FirstSoundItem[] = [
  // level 1 — stage 1–3 letters, maximum contrast between choices
  ["mama", "mesa", ["aso", "baso"], 1],
  ["aso", "ama", ["mesa", "sisi"], 1],
  ["sabi", "sama", ["bola", "mata"], 1],
  ["baso", "bibe", ["mama", "aso"], 1],
  ["ube", "ubo", ["sabi", "mesa"], 1],
  ["misa", "mata", ["aso", "bato"], 1],
  ["isa", "ina", ["baso", "tasa"], 1],
  ["iba", "isa", ["mama", "sala"], 1],

  // level 2 — stage 4–5 letters
  ["lata", "lobo", ["bato", "kuto"], 2],
  ["tasa", "tubo", ["mesa", "bola"], 2],
  ["kuto", "kilo", ["daga", "sabi"], 2],
  ["bola", "bato", ["lata", "tasa"], 2],
  ["gulay", "gatas", ["nanay", "tatay"], 2],
  ["nanay", "niyog", ["gulay", "bola"], 2],
  ["yelo", "yaya", ["mata", "kuto"], 2],
  ["mani", "manok", ["tela", "lobo"], 2],

  // level 3 — stage 6 letters
  ["puso", "pera", ["daga", "wika"], 3],
  ["dila", "damo", ["puno", "hari"], 3],
  ["hari", "hita", ["pusa", "relo"], 3],
  ["wika", "watawat", ["dila", "puso"], 3],
  ["relo", "radyo", ["hipon", "pako"], 3],
  ["pusa", "pito", ["damo", "hilo"], 3],
  ["damit", "dagat", ["hapon", "pulot"], 3],
  ["hipon", "hilaw", ["sipa", "putik"], 3],

  // level 4 — ng and clusters
  ["ngiti", "ngipin", ["saging", "bola"], 4],
  ["saging", "sungay", ["ngiti", "payong"], 4],
  ["plato", "prutas", ["bola", "tasa"], 4],
  ["tren", "trapo", ["klase", "braso"], 4],
  ["krus", "klase", ["tren", "plato"], 4],
  ["bangka", "bangus", ["ngiti", "gulong"], 4],
];

/**
 * The PhonItem rows this bank produces.
 *
 * Shared by the seed and by `npm run words:sync`, so a fresh install and a live
 * study database are given exactly the same items — options carry the answer
 * first and are shuffled when served, never stored shuffled.
 */
export function phonItemRows() {
  const row = (type: string) => ([prompt, answer, distractors, level]: RhymeItem) => ({
    type,
    prompt,
    answer,
    options: JSON.stringify([answer, ...distractors]),
    level,
  });
  return [...RHYMES.map(row("RHYME")), ...FIRST_SOUNDS.map(row("FIRST_SOUND"))];
}
