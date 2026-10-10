/**
 * Validate the instructional word bank before it ever reaches a learner.
 *
 *   npm run words:check
 *
 * Catches the mistakes that would quietly damage instruction: a syllable split
 * that does not spell the word, a level that contradicts the word's shape, or
 * too few words at a level — which makes every session serve the same items and
 * lets a child memorise them instead of decoding.
 */
import { WORDS, ASR_VARIANTS, STRESS_NOTES } from "../prisma/word-bank";
import { PSEUDOWORDS } from "../prisma/pseudoword-bank";
import { RHYMES, FIRST_SOUNDS } from "../prisma/phon-items";
import { stageForWord, syllableCount } from "../prisma/marungko-stage";
import { levenshtein } from "../src/lib/scoring";
import { syllableParts } from "../src/lib/reader-sets";

const MIN_PER_LEVEL = 20; // an 8-item session needs real choice to draw from

/**
 * Words to keep out of a reading list for 7–12 year olds.
 *
 * Filipino has several everyday words whose colloquial sense is adult — a
 * reading specialist reviewing the content would flag them, and a child might
 * be embarrassed reading one aloud to an adult. The point is not squeamishness:
 * an awkward word costs the child's attention at exactly the moment the study
 * is measuring their decoding.
 */
const AVOID: Record<string, string> = {
  kabit: 'colloquially "mistress"',
  buntis: "pregnant",
  suso: "also means breast",
  titi: "vulgar",
  puki: "vulgar",
  utot: "flatulence",
  tae: "faeces",
  bala: "bullet",
  patay: "dead",
  bugbog: "beaten",
  lasing: "drunk",
  sugat: "wound",
  dugo: "blood",
};
let errors = 0;
let warnings = 0;

const fail = (msg: string) => {
  console.error(`  ERROR  ${msg}`);
  errors++;
};
const warn = (msg: string) => {
  console.warn(`  warn   ${msg}`);
  warnings++;
};

console.log(`Checking ${WORDS.length} words…\n`);

const seen = new Set<string>();
const byLevel = new Map<number, number>();
const byStage = new Map<number, number>();

for (const [text, syllables, pattern, level, meaning] of WORDS) {
  if (seen.has(text)) fail(`"${text}" appears more than once`);
  seen.add(text);

  // the hyphenated form must spell the word exactly
  const joined = syllables.split("-").join("");
  if (joined !== text) fail(`"${text}" syllabified as "${syllables}" spells "${joined}"`);

  // and the Reader's "Show syllables" must split it the same way, typed or not
  const want = syllables.includes("-") ? syllables : null;
  const typed = text[0].toUpperCase() + text.slice(1) + ",";
  const shown = syllableParts(text, syllables)?.join("-") ?? null;
  const shownTyped = syllableParts(typed, syllables)?.join("-") ?? null;
  const wantTyped = want && want[0].toUpperCase() + want.slice(1) + ",";
  if (shown !== want) fail(`"${text}" shows in the Reader as "${shown}", not "${want}"`);
  if (shownTyped !== wantTyped) fail(`typed "${typed}" shows in the Reader as "${shownTyped}", not "${wantTyped}"`);

  if (!/^[a-zñ]+$/.test(text)) fail(`"${text}" contains characters the word bank does not allow`);
  if (AVOID[text]) fail(`"${text}" is not suitable for a children's reading list — ${AVOID[text]}`);
  if (level < 1 || level > 5) fail(`"${text}" has level ${level}, outside 1–5`);
  if (!pattern) fail(`"${text}" has no syllable pattern`);
  if (!meaning) warn(`"${text}" has no English gloss`);

  // the level must agree with the word's actual shape
  const syls = syllableCount(syllables);

  // A true consonant cluster is two consonants opening a syllable ("pla-to").
  // Two consonants either side of a syllable break ("bun-so") is a closed
  // syllable, which is level 2 work, not cluster work — so split on the
  // hyphens rather than pattern-matching the CV string.
  const VOWELS = "aeiou";
  const hasCluster = syllables
    .split("-")
    .some((syl) => {
      const onset = syl.replace(/^ng/, "N"); // "ng" is one sound
      return onset.length > 1 && !VOWELS.includes(onset[0]) && !VOWELS.includes(onset[1]);
    });
  if (syls >= 4 && level !== 5) fail(`"${text}" has ${syls} syllables but level ${level} (expected 5)`);
  if (syls <= 3 && level === 5 && !/ts|kw|dy|sy|ly/.test(text) && syls !== 3) {
    warn(`"${text}" is level 5 with only ${syls} syllables`);
  }
  if (level === 1 && /C$/.test(pattern.replace(/\(ng\)/g, ""))) {
    fail(`"${text}" is level 1 but pattern "${pattern}" ends in a consonant`);
  }
  if (level === 1 && syls !== 2) fail(`"${text}" is level 1 but has ${syls} syllables`);
  if (hasCluster && level < 4 && !/\(ng\)/.test(pattern)) {
    warn(`"${text}" pattern "${pattern}" looks clustered but is level ${level}`);
  }

  const stage = stageForWord(text);
  byLevel.set(level, (byLevel.get(level) ?? 0) + 1);
  byStage.set(stage, (byStage.get(stage) ?? 0) + 1);
}

// A word that does not spell the bank word is shown whole, never split by guess.
for (const [text, syllables] of [["buhay", "ba-hay"], ["bahayan", "ba-hay"], ["(aso)", "a-so"]]) {
  const shown = syllableParts(text, syllables)?.join("-") ?? null;
  const want = text === "(aso)" ? "(a-so)" : null;
  if (shown !== want) fail(`the Reader splits "${text}" (bank "${syllables}") as "${shown}", not "${want}"`);
}

for (const key of Object.keys(ASR_VARIANTS)) {
  if (!seen.has(key)) fail(`ASR variants listed for "${key}", which is not in the word bank`);
}

for (const key of Object.keys(STRESS_NOTES)) {
  if (!seen.has(key)) fail(`a stress caveat is listed for "${key}", which is not in the word bank`);
}

/* ── the decoding probe ────────────────────────────────────────────────── */
/**
 * The probe's non-words get the same structural checks as real words, plus the
 * one that only applies to them: a "non-word" that is actually a word.
 *
 * That failure is silent and total. A child reads it from memory like any other
 * word, the probe reports a decoding success that never happened, and the
 * measure quietly becomes the thing it was built to rule out.
 */
console.log(`\nChecking ${PSEUDOWORDS.length} probe non-words…\n`);

const probeSeen = new Set<string>();
const probeByStage = new Map<number, number>();

for (const [text, syllables, pattern, level, meaning] of PSEUDOWORDS) {
  if (probeSeen.has(text)) fail(`probe word "${text}" appears more than once`);
  probeSeen.add(text);

  if (seen.has(text)) fail(`probe word "${text}" is a real word in the bank — it cannot test decoding`);
  if (meaning) fail(`probe word "${text}" has a gloss ("${meaning}"); a non-word has no meaning`);

  const joined = syllables.split("-").join("");
  if (joined !== text) fail(`probe word "${text}" syllabified as "${syllables}" spells "${joined}"`);
  if (!/^[a-zñ]+$/.test(text)) fail(`probe word "${text}" contains characters the bank does not allow`);
  if (!pattern) fail(`probe word "${text}" has no syllable pattern`);
  if (level < 1 || level > 5) fail(`probe word "${text}" has level ${level}, outside 1–5`);

  probeByStage.set(stageForWord(text), (probeByStage.get(stageForWord(text)) ?? 0) + 1);
}

/**
 * Near-misses of real words.
 *
 * pseudoword-bank.ts sets the rule: a probe item must not be one letter from a
 * word the child practises, because a child who reads "mesu" as "mesa" has shown
 * lexical guessing, not a decoding failure — the distinction the probe exists to
 * draw. A warning rather than an error, because replacing a probe item is a
 * measurement decision for a reading specialist who speaks Cebuano as well as
 * Filipino, not something a script should do on its own.
 */
for (const [text] of PSEUDOWORDS) {
  const near = WORDS.filter(([w]) => levenshtein(text, w) <= 1).map(([w]) => w);
  if (near.length) warn(`probe word "${text}" is one letter from the real word(s) ${near.join(", ")}`);
}

// A probe run asks for eight items at or below the stage the learner is taught
// from, which is min(7, level + 2) at least (effectiveStage in
// src/lib/marungko.ts). A learner early in the sequence is the one whose
// decoding most needs measuring, so the lowest level must fill a full run.
console.log("  learner level   probe items available   (a run draws 8)");
for (let l = 1; l <= 5; l++) {
  const reachable = Math.min(7, l + 2);
  const pool = PSEUDOWORDS.filter(([t]) => stageForWord(t) <= reachable).length;
  const flag = pool < 8 ? "  ← short of a full run" : "";
  console.log(`        L${l}              ${String(pool).padStart(3)}${flag}`);
  if (pool < 8) warn(`a learner at level ${l} can only be shown ${pool} probe items`);
}

/* ── rhyme and first-sound items ───────────────────────────────────────── */
/**
 * These are where a reading specialist looks first, and the first version of
 * the bank had seventeen items a specialist would have rejected — "tren" given
 * as a rhyme for "krus", "oso" as starting like "ubo". Each rule below is one a
 * teacher applies without thinking; see the note at the top of phon-items.ts.
 */
console.log(`\nChecking ${RHYMES.length} rhyme and ${FIRST_SOUNDS.length} first-sound items…`);

const SYLLABLES = new Map(WORDS.map(([t, syl]) => [t, syl.split("-")]));
const finalSyllable = (w: string) => SYLLABLES.get(w)!.at(-1)!;
const rimeOf = (syl: string) => syl.replace(/^[^aeiou]+/, ""); // vowel + closing consonant
const isOpen = (syl: string) => /[aeiou]$/.test(syl);
/** The consonant sound just before the vowel: "tse" → s, "nga" → ng, "pla" → l. */
const onsetTail = (syl: string) => {
  const onset = syl.match(/^[^aeiou]*/)![0];
  return onset.endsWith("ng") ? "ng" : onset.slice(-1);
};
const firstSound = (w: string) => (w.startsWith("ng") ? "ng" : w[0]);

function checkWords(kind: string, words: string[]) {
  for (const w of words) {
    if (!SYLLABLES.has(w)) fail(`${kind}: "${w}" is not in the word bank`);
    if (AVOID[w]) fail(`${kind}: "${w}" is not suitable for a children's reading list — ${AVOID[w]}`);
  }
  if (new Set(words).size !== words.length) fail(`${kind}: the same word appears twice`);
  return words.every((w) => SYLLABLES.has(w));
}

for (const [prompt, answer, distractors] of RHYMES) {
  const kind = `rhyme "${prompt}"`;
  if (!checkWords(kind, [prompt, answer, ...distractors])) continue;
  const p = finalSyllable(prompt);
  const a = finalSyllable(answer);
  const rhymes = rimeOf(p) === rimeOf(a) && (!isOpen(p) || onsetTail(p) === onsetTail(a));
  if (!rhymes) fail(`${kind}: the answer "${answer}" ends "-${a}", which does not rhyme with "-${p}"`);
  for (const d of distractors) {
    const ds = finalSyllable(d);
    if (rimeOf(ds) === rimeOf(p) || (isOpen(p) && isOpen(ds) && ds.at(-1) === p.at(-1))) {
      fail(`${kind}: distractor "${d}" ("-${ds}") could also be heard as a rhyme for "-${p}"`);
    }
  }
}

for (const [prompt, answer, distractors] of FIRST_SOUNDS) {
  const kind = `first sound "${prompt}"`;
  if (!checkWords(kind, [prompt, answer, ...distractors])) continue;
  if (firstSound(answer) !== firstSound(prompt)) {
    fail(`${kind}: the answer "${answer}" starts with "${firstSound(answer)}", not "${firstSound(prompt)}"`);
  }
  for (const d of distractors) {
    if (firstSound(d) === firstSound(prompt)) fail(`${kind}: distractor "${d}" starts with the same sound`);
  }
}

/* ── distribution ──────────────────────────────────────────────────────── */
console.log("  level   words   (a session draws 8)");
for (let l = 1; l <= 5; l++) {
  const n = byLevel.get(l) ?? 0;
  const flag = n < MIN_PER_LEVEL ? `  ← thin, sessions will repeat` : "";
  console.log(`    ${l}     ${String(n).padStart(4)}${flag}`);
  if (n < MIN_PER_LEVEL) warn(`level ${l} has only ${n} words (want ${MIN_PER_LEVEL}+)`);
}

console.log("\n  Marungko stage   words   (derived from the letters used)");
for (let s = 1; s <= 7; s++) {
  console.log(`        ${s}          ${String(byStage.get(s) ?? 0).padStart(4)}`);
}

/* the pool an exercise can actually draw from, which is what a learner sees */
console.log("\n  pool available to a learner at each level");
for (let l = 1; l <= 5; l++) {
  const maxStage = Math.min(7, l + 2);
  const atLevel = WORDS.filter(([t, , , lv]) => lv === l && stageForWord(t) <= maxStage).length;
  const total = WORDS.filter(([t, , , lv]) => lv <= l && stageForWord(t) <= maxStage).length;
  const flag = atLevel < 16 ? "  ← under two sessions' worth" : "";
  console.log(`    L${l} (stage ≤ ${maxStage}):  ${String(atLevel).padStart(3)} at level, ${String(total).padStart(3)} total${flag}`);
  if (atLevel < 16) warn(`level ${l} exposes only ${atLevel} words to a learner`);
}

console.log(
  `\n${errors ? `${errors} error(s)` : "No errors"}${warnings ? `, ${warnings} warning(s)` : ""}.`
);
if (errors) process.exit(1);
