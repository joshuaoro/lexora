/**
 * What a reading specialist can record about a misreading they just heard.
 *
 * A controlled vocabulary, kept in one place so the chips a specialist presses,
 * the rows a report groups, and the columns an export carries can never drift
 * apart. Adding a value here is the only way to add one anywhere.
 *
 * Two things about the shape of this list matter more than its contents.
 *
 * It is not all errors. `self_corrected` describes a child who arrived at the
 * right word, and `unclear` describes the specialist rather than the child.
 * Counting either into an error distribution would overstate how much went
 * wrong, so `kind` separates them and every report has to respect it — which is
 * also why the chips are headed "What did you observe?" rather than "What did
 * you hear?".
 *
 * And `stress` is here because nothing else in LEXORA can catch it. Filipino
 * does not write stress, so búkas and bukás reach the scorer as the same five
 * letters and are marked the same however they were said. A specialist's ear is
 * the only instrument the study has for a marker its own literature calls
 * diagnostic — see STRESS_NOTES in prisma/word-bank.ts.
 */

export type TagKind = "error" | "behaviour";

export type ErrorTag = {
  id: string;
  kind: TagKind;
  en: string;
  fil: string;
  /** Shown under the chip so two specialists read the category the same way. */
  hintEn: string;
};

export const ERROR_TAGS: ErrorTag[] = [
  {
    id: "vowel",
    kind: "error",
    en: "Vowel",
    fil: "Patinig",
    hintEn: "a/e/i/o/u swapped — “tila” for tela",
  },
  {
    id: "initial_consonant",
    kind: "error",
    en: "First sound",
    fil: "Unang tunog",
    hintEn: "wrong or missing consonant at the start — “daso” for baso",
  },
  {
    id: "final_consonant",
    kind: "error",
    en: "Last sound",
    fil: "Huling tunog",
    hintEn: "wrong or dropped consonant at the end — “sula” for sulat",
  },
  {
    id: "digraph",
    kind: "error",
    en: "Digraph",
    fil: "Digrapo",
    hintEn: "ng, ts, dy, sy read as separate letters",
  },
  {
    id: "cluster",
    kind: "error",
    en: "Consonant cluster",
    fil: "Magkasunod na katinig",
    hintEn: "pr, tr, kl broken up or simplified — “putas” for prutas",
  },
  {
    id: "syllable_omitted",
    kind: "error",
    en: "Syllable dropped",
    fil: "Nawalang pantig",
    hintEn: "a whole pantig missing — “atay” for tatay",
  },
  {
    id: "syllable_added",
    kind: "error",
    en: "Syllable added",
    fil: "Dagdag na pantig",
    hintEn: "an extra pantig that is not in the word",
  },
  {
    id: "stress",
    kind: "error",
    en: "Stress (diin)",
    fil: "Diin",
    hintEn: "right letters, wrong stress — bukás for búkas. Nothing else can catch this.",
  },
  {
    id: "self_corrected",
    kind: "behaviour",
    en: "Self-corrected in the recording",
    fil: "Kusang naitama sa recording",
    hintEn:
      "started wrong and fixed it unprompted, within this one take — not the “Now you try” re-read",
  },
  {
    id: "unclear",
    kind: "behaviour",
    en: "Could not tell",
    fil: "Hindi matukoy",
    hintEn: "too quiet or too noisy to judge the sound",
  },
];

export const TAG_IDS: string[] = ERROR_TAGS.map((t) => t.id);

const BY_ID = new Map(ERROR_TAGS.map((t) => [t.id, t]));

export function isValidTag(id: string): boolean {
  return BY_ID.has(id);
}

export function tagLabel(id: string, lang: "en" | "fil" = "en"): string {
  const t = BY_ID.get(id);
  return t ? (lang === "fil" ? t.fil : t.en) : id;
}

/** Only the tags that describe something the child got wrong. */
export function errorTagIds(): string[] {
  return ERROR_TAGS.filter((t) => t.kind === "error").map((t) => t.id);
}

/**
 * Distribution over tagged reviews, with the denominator it was computed from.
 *
 * The coverage figure travels with the counts on purpose. Tagging is optional,
 * so a distribution alone invites the reader to assume it describes every
 * misreading, when it may describe a third of them. A heatmap without its
 * denominator is the same mistake as a fabricated one, a step removed.
 */
export type TagDistribution = {
  errors: { id: string; label: string; count: number }[];
  behaviours: { id: string; label: string; count: number }[];
  /** Reviews marking a misreading — the population that could have been tagged. */
  taggable: number;
  /** How many of those carry at least one tag. */
  tagged: number;
  coveragePct: number | null;
};

export function summariseTags(
  /** One entry per reviewed misreading; inner array may be empty (untagged). */
  perReview: string[][],
  lang: "en" | "fil" = "en"
): TagDistribution {
  const counts = new Map<string, number>();
  let tagged = 0;

  for (const tags of perReview) {
    const known = tags.filter(isValidTag);
    if (known.length) tagged++;
    for (const t of known) counts.set(t, (counts.get(t) ?? 0) + 1);
  }

  const rows = (kind: TagKind) =>
    ERROR_TAGS.filter((t) => t.kind === kind).map((t) => ({
      id: t.id,
      label: lang === "fil" ? t.fil : t.en,
      count: counts.get(t.id) ?? 0,
    }));

  return {
    errors: rows("error"),
    behaviours: rows("behaviour"),
    taggable: perReview.length,
    tagged,
    coveragePct: perReview.length ? Math.round((tagged / perReview.length) * 100) : null,
  };
}
