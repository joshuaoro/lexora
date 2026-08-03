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
  ["lolo", "lobo", ["mesa", "sakit"], 1],
  ["pito", "dito", ["baso", "ulap"], 1],
  ["mani", "sabi", ["damo", "takot"], 1],
  ["tela", "mesa", ["bato", "hipon"], 1],
  ["buko", "tuko", ["pera", "silid"], 1],
  ["baso", "aso", ["kilo", "dagat"], 1],
  ["puno", "pito", ["wika", "labas"], 1],
  ["daga", "gabi", ["tasa", "kanin"], 1],
  ["hari", "mani", ["lobo", "gamit"], 1],
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
  ["bukas", "lakas", ["dito", "suso"], 2],

  // level 3 — three syllables and ng words
  ["saging", "hangin", ["mesa", "bola"], 3],
  ["payong", "tulong", ["baso", "mata"], 3],
  ["ngiti", "pito", ["gulay", "damit"], 3],
  ["salamat", "watawat", ["puso", "lobo"], 3],
  ["kandila", "dila", ["takot", "manok"], 3],
  ["mabilis", "malinis", ["bato", "araw"], 3],
  ["gulong", "tulong", ["tasa", "kanin"], 3],
  ["langit", "sakit", ["puno", "yelo"], 3],
  ["tinapay", "tatay", ["kilo", "ubas"], 3],
  ["malamig", "tahimik", ["daga", "hapon"], 3],

  // level 4 — clusters and longer words
  ["plato", "bato", ["saging", "damit"], 4],
  ["prutas", "gatas", ["ngiti", "kandila"], 4],
  ["braso", "baso", ["payong", "malinis"], 4],
  ["trapo", "plato", ["hangin", "tinapay"], 4],
  ["klase", "mesa", ["gulong", "salamat"], 4],
  ["tren", "krus", ["bola", "mata"], 4],
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
  ["sabi", "suso", ["bola", "mata"], 1],
  ["baso", "bibe", ["mama", "aso"], 1],
  ["ube", "ubo", ["sabi", "mesa"], 1],
  ["misa", "mata", ["aso", "bato"], 1],
  ["isa", "ina", ["baso", "tasa"], 1],
  ["oso", "ubo", ["mama", "sala"], 1],

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
