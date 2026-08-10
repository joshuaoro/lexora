import { prisma } from "./db";
import { learnerSummary, decodingTime, accuracyByPattern } from "./stats";
import { divergence } from "./divergence";
import { summariseTags } from "./error-tags";
import { stageLabel } from "./marungko";

/**
 * A plain-text summary a SPED teacher can paste into an IEP.
 *
 * Written to be *copied and then edited*, not filed as-is. LEXORA says on every
 * page that it does not diagnose and is not a substitute for a licensed
 * educator, and a document that arrived with "Recommended intervention: …"
 * already written would quietly contradict that — an app prescribing while
 * disclaiming that it prescribes is the kind of thing a panel notices.
 *
 * So the split is deliberate. Everything above "Points to consider" is what the
 * data says: counts, percentages, times. Below it are prompts, labelled as
 * data-derived and addressed to the teacher's judgement, phrased as things to
 * look at rather than things to do.
 *
 * The error profile comes only from what a specialist heard and tagged, never
 * from ASR transcripts. Most of the transcripts in this database were invented
 * by the seed script, and the genuine ones carry the recogniser's spelling
 * rather than the child's phonology — an error profile built from them would
 * read convincingly and describe nobody.
 */

function pct(n: number | null): string {
  return n === null ? "not enough data" : `${n}%`;
}

export async function buildIepDraft(learnerId: string): Promise<string | null> {
  const profile = await prisma.learnerProfile.findUnique({
    where: { id: learnerId },
    include: { user: { select: { name: true } } },
  });
  if (!profile) return null;
  // A demo learner's history is fabricated. Refusing outright is safer than a
  // caveat nobody reads once the text is pasted into another document.
  if (profile.isDemo) return null;

  const [summary, timing, byPattern, split, reviewed] = await Promise.all([
    learnerSummary(learnerId),
    decodingTime(learnerId),
    accuracyByPattern(learnerId),
    divergence(learnerId),
    prisma.attemptReview.findMany({
      where: { attempt: { learnerId, correct: false, isRetry: false } },
      select: { tags: { select: { tag: true } } },
    }),
  ]);

  const tags = summariseTags(reviewed.map((r) => r.tags.map((t) => t.tag)));
  const topErrors = tags.errors.filter((e) => e.count > 0).sort((a, b) => b.count - a.count);
  const selfCorrected = tags.behaviours.find((b) => b.id === "self_corrected")?.count ?? 0;

  // A family with no scored readings has a null accuracy, not a zero — sorting
  // those to the front would report the *least practised* shape as the hardest.
  const weakest = byPattern
    .filter((p): p is typeof p & { accuracy: number } => p.attempts >= 5 && p.accuracy !== null)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 2);

  const L = [
    `LEXORA READING SUMMARY — ${profile.user.name}`,
    `Generated ${new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}`,
    "",
    "SCOPE",
    "Word-level reading only: phonological awareness and single-word decoding,",
    "following the Marungko sequence. Connected text, reading fluency (WCPM),",
    "spelling and comprehension were not assessed.",
    "",
    "CURRENT PLACEMENT",
    `  Difficulty level: ${profile.level} of 5`,
    `  ${stageLabel(profile.stage)}`,
    "",
    "WHAT THE DATA SHOWS",
    `  Single-word accuracy: ${summary.overallAccuracy}% over ${summary.wordsRead14} readings in the last 14 days.`,
    `  Typical time per correct word: ${
      summary.medianDecodeMs === null
        ? "not enough timed readings yet"
        : `${(summary.medianDecodeMs / 1000).toFixed(1)} seconds`
    }.`,
  ];

  if (timing.medianMs !== null && timing.earlierMs !== null && timing.laterMs !== null) {
    const change = Math.round(((timing.earlierMs - timing.laterMs) / timing.earlierMs) * 100);
    L.push(
      `  Decoding speed is ${
        change >= 10 ? `${change}% faster` : change <= -10 ? `${Math.abs(change)}% slower` : "steady"
      } compared with earlier sessions.`
    );
  }
  L.push(
    "  Note: Filipino spells what it says, and in such languages reading difficulty",
    "  shows up as slow reading more reliably than as inaccurate reading. Read the",
    "  time above alongside the accuracy, not beneath it.",
    ""
  );

  L.push("DECODING VERSUS RECALL");
  if (split.enoughData) {
    L.push(
      `  Real words: ${pct(split.real.pct)} (${split.real.correct}/${split.real.n} reviewed)`,
      `  Made-up words: ${pct(split.pseudo.pct)} (${split.pseudo.correct}/${split.pseudo.n} reviewed)`,
      split.gapPoints !== null && split.gapPoints >= 25
        ? "  The gap suggests familiar words are being recognised rather than decoded."
        : "  The two track closely, which suggests accuracy reflects decoding that should",
      split.gapPoints !== null && split.gapPoints >= 25
        ? "  Skills may not transfer to unfamiliar words."
        : "  transfer to unfamiliar words."
    );
    if (split.thin) L.push("  Based on few readings — treat as an indication, not a measure.");
  } else {
    L.push(
      `  Not yet established (${split.real.n} real and ${split.pseudo.n} made-up words reviewed).`,
      "  Made-up words separate decoding from memorised sight words; a specialist must",
      "  score them by ear before this can be reported."
    );
  }
  L.push("");

  L.push("ERROR PATTERN (from specialist listening, not automatic scoring)");
  if (tags.tagged === 0) {
    L.push(
      "  No misreadings have been categorised yet. Categories are recorded optionally",
      "  by the reading specialist while reviewing recordings."
    );
  } else {
    for (const e of topErrors) L.push(`  ${e.label}: ${e.count}`);
    L.push(
      `  Categories were recorded for ${tags.tagged} of ${tags.taggable} reviewed misreadings (${tags.coveragePct}%).`
    );
    if (selfCorrected > 0) {
      L.push(
        `  Separately, the learner self-corrected within the recording ${selfCorrected} time(s).`,
        "  This is a reading behaviour rather than an error: the correct word was produced."
      );
    }
  }
  L.push("");

  if (weakest.length) {
    L.push("WORD SHAPES FOUND HARDEST");
    for (const w of weakest) L.push(`  ${w.family}: ${w.accuracy}% over ${w.attempts} readings`);
    L.push("");
  }

  L.push(
    "POINTS TO CONSIDER (data-derived prompts — for the teacher's professional judgement)",
    "  These are patterns in the recorded data, not clinical recommendations."
  );
  if (topErrors.length) {
    L.push(`  - The most frequent category recorded was ${topErrors[0].label.toLowerCase()}.`);
    if (topErrors.some((e) => e.id === "stress")) {
      L.push(
        "  - Stress errors were noted. Filipino does not write stress, so the app cannot",
        "    detect these; they were heard by the specialist and are worth attention."
      );
    }
  }
  if (weakest.length) L.push(`  - ${weakest[0].family} word shapes had the lowest accuracy.`);
  if (split.enoughData && split.gapPoints !== null && split.gapPoints >= 25) {
    L.push("  - The real-word/made-up-word gap is worth discussing before advancing the level.");
  }
  if (summary.medianDecodeMs !== null && summary.medianDecodeMs > 4000) {
    L.push("  - Correct readings are taking over four seconds, which suggests effortful decoding.");
  }
  if (!topErrors.length && !weakest.length) {
    L.push("  - Not enough reviewed data yet to suggest a focus.");
  }

  L.push(
    "",
    "---",
    "LEXORA is a reading support tool. It does not diagnose dyslexia, does not",
    "provide clinical assessment, and is not a substitute for licensed educators,",
    "reading specialists, speech-language pathologists, or health-care professionals.",
    "Figures above cover word-level reading only and should be interpreted by a",
    "qualified teacher alongside their own observation of the learner."
  );

  return L.join("\n");
}
