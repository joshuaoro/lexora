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
import { WORDS, ASR_VARIANTS } from "../prisma/word-bank";
import { stageForWord, syllableCount } from "../prisma/marungko-stage";

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

for (const key of Object.keys(ASR_VARIANTS)) {
  if (!seen.has(key)) fail(`ASR variants listed for "${key}", which is not in the word bank`);
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
