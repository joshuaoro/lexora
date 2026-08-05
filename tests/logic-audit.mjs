/**
 * Instructional-logic audit: the rules the study actually depends on —
 * adaptive difficulty, practice-list mastery, scoring strictness, and the
 * specialist–system agreement metric.
 */
import {
  BASE, json, login, check, section, report, query, one,
  createTestLearner, deleteTestLearner, endSuite,
} from "./helpers.mjs";

console.log(`Logic audit against ${BASE}`);

const specialist = await login("specialist@lexora.ph");
if (!specialist) {
  console.error("Could not sign in as specialist@lexora.ph — is the database seeded?");
  process.exit(1);
}

const learner = await createTestLearner("logic");
const profile = () => one(`SELECT level, stage FROM "LearnerProfile" WHERE id = $1`, [learner.learnerId]);

const read = (wordId, target, heard) =>
  json("/api/attempts", {
    cookie: learner.cookie,
    method: "POST",
    body: { activityType: "READ_ALOUD", wordId, target, browserTranscript: heard, responseMs: 1500 },
  });

/* ── 1. word-level scoring must reject near-misses ─────────────────────── */
section("[1] scoring rejects the misreadings the study looks for");
for (const [target, heard, shouldBeCorrect] of [
  ["bahay", "bahay", true],
  ["bahay", "ang bahay", true], // ASR often returns a phrase
  ["salamat", "Salamat.", true], // punctuation and case are normalised
  ["bahay", "buhay", false], // single vowel substitution — a different word
  ["bola", "dola", false], // b/d reversal
  ["paaralan", "paralan", false], // omission
]) {
  const r = await json("/api/attempts", {
    cookie: learner.cookie,
    method: "POST",
    body: { activityType: "READ_ALOUD", target, browserTranscript: heard, responseMs: 1200 },
  });
  check(
    `"${target}" heard as "${heard}" → ${shouldBeCorrect ? "correct" : "incorrect"}`,
    Boolean(r.body.correct) === shouldBeCorrect,
    `sim ${(r.body.score ?? 0).toFixed(2)}, ${r.body.errorType}`
  );
}

/* ── 2. adaptive difficulty ────────────────────────────────────────────── */
// A dedicated learner: the scoring checks above deliberately record misreads,
// which would otherwise sit inside the adaptive accuracy window and mask the
// level-up rule.
section("[2] adaptive difficulty responds to performance");
const adaptive = await createTestLearner("adaptive");
const adaptiveProfile = () =>
  one(`SELECT level, stage FROM "LearnerProfile" WHERE id = $1`, [adaptive.learnerId]);
const adaptiveRead = (wordId, target, heard) =>
  json("/api/attempts", {
    cookie: adaptive.cookie,
    method: "POST",
    body: { activityType: "READ_ALOUD", wordId, target, browserTranscript: heard, responseMs: 1500 },
  });

check("starts at level 1", (await adaptiveProfile()).level === 1);

const easy = await query(`SELECT id, text FROM "Word" WHERE level = 1 AND NOT "isPseudo" ORDER BY text LIMIT 10`);
for (const w of easy) await adaptiveRead(w.id, w.text, w.text);
const up = await adaptiveProfile();
check("levels up after sustained accuracy", up.level === 2, `L${up.level} S${up.stage}`);
check("Marungko stage widens with the level", up.stage >= 3, `S${up.stage}`);

const any = await query(`SELECT id, text FROM "Word" WHERE level <= 2 AND NOT "isPseudo" ORDER BY text LIMIT 10`);
for (const w of any) await adaptiveRead(w.id, w.text, "zzzz");
const down = await adaptiveProfile();
check("levels down after poor accuracy", down.level === 1, `L${down.level}`);
check("stage never shrinks back", down.stage >= up.stage, `S${down.stage}`);

// A near-miss run must NOT promote. The misreads come first: promotion is
// evaluated after every attempt, so trailing misreads would arrive too late —
// the learner would already have been promoted on a clean run of ten.
// Two misreads followed by ten correct keeps the 12-attempt window at 83%,
// just under the 85% rule.
const borderline = await createTestLearner("borderline");
const bWords = await query(`SELECT id, text FROM "Word" WHERE level = 1 AND NOT "isPseudo" ORDER BY text LIMIT 12`);
for (let i = 0; i < 12; i++) {
  const w = bWords[i % bWords.length];
  await json("/api/attempts", {
    cookie: borderline.cookie,
    method: "POST",
    body: {
      activityType: "READ_ALOUD",
      wordId: w.id,
      target: w.text,
      browserTranscript: i < 2 ? "zzzz" : w.text,
      responseMs: 1500,
    },
  });
}
const bLevel = await one(`SELECT level FROM "LearnerProfile" WHERE id = $1`, [borderline.learnerId]);
check("83% accuracy stays below the level-up threshold", bLevel.level === 1, `L${bLevel.level}`);
await deleteTestLearner(borderline.email);
await deleteTestLearner(adaptive.email);

/* ── 3. practice list ──────────────────────────────────────────────────── */
section("[3] practice list and mastery");
// Misread three real words (with ids, so they can be tracked) to populate it.
const missWords = await query(`SELECT id, text FROM "Word" WHERE level = 1 AND NOT "isPseudo" ORDER BY text LIMIT 3`);
for (const w of missWords) await read(w.id, w.text, "zzzz");

const practice = await query(
  `SELECT p."wordId", w.text FROM "PracticeItem" p JOIN "Word" w ON w.id = p."wordId" WHERE p."learnerId" = $1`,
  [learner.learnerId]
);
check("misread words are collected automatically", practice.length > 0, `${practice.length} words`);

const item = practice[0];
const practiceRead = (heard) =>
  json("/api/attempts", {
    cookie: learner.cookie,
    method: "POST",
    body: { activityType: "PRACTICE", wordId: item.wordId, target: item.text, browserTranscript: heard, responseMs: 1200 },
  });

await practiceRead(item.text);
const afterOne = await one(`SELECT streak, mastered FROM "PracticeItem" WHERE "learnerId" = $1 AND "wordId" = $2`, [learner.learnerId, item.wordId]);
check("one correct read is not yet mastery", afterOne.mastered === false, `streak=${afterOne.streak}`);

await practiceRead(item.text);
const afterTwo = await one(`SELECT streak, mastered FROM "PracticeItem" WHERE "learnerId" = $1 AND "wordId" = $2`, [learner.learnerId, item.wordId]);
check("two correct reads in a row master the word", afterTwo.mastered === true, `streak=${afterTwo.streak}`);

await practiceRead("qqqq");
const afterMiss = await one(`SELECT streak, mastered FROM "PracticeItem" WHERE "learnerId" = $1 AND "wordId" = $2`, [learner.learnerId, item.wordId]);
check("a later miss un-masters it", afterMiss.mastered === false && afterMiss.streak === 0);

/* ── 4. specialist controls ────────────────────────────────────────────── */
section("[4] specialist intervention controls");
const lvl = await json(`/api/learners/${learner.learnerId}`, { cookie: specialist, method: "PATCH", body: { level: 4 } });
check("level override applies", lvl.status === 200 && (await profile()).level === 4);

const pinWord = await one(`SELECT id, text FROM "Word" WHERE text = 'bulaklak'`);
await json(`/api/learners/${learner.learnerId}/practice`, { cookie: specialist, method: "POST", body: { wordId: pinWord.id } });
const pinned = await one(`SELECT source FROM "PracticeItem" WHERE "learnerId" = $1 AND "wordId" = $2`, [learner.learnerId, pinWord.id]);
check("specialist can pin a practice word", pinned?.source === "SPECIALIST");

/* ── 5. agreement metric ───────────────────────────────────────────────── */
section("[5] scoring reliability review");
const attempt = await one(`SELECT id FROM "Attempt" WHERE "learnerId" = $1 ORDER BY "createdAt" DESC LIMIT 1`, [learner.learnerId]);
await json("/api/reviews", { cookie: specialist, method: "POST", body: { attemptId: attempt.id, agrees: true, note: "clear reading" } });
const stored = await one(`SELECT agrees, note FROM "AttemptReview" WHERE "attemptId" = $1`, [attempt.id]);
check("review and note are stored", stored?.agrees === true && stored?.note === "clear reading");

await json("/api/reviews", { cookie: specialist, method: "POST", body: { attemptId: attempt.id, agrees: false } });
const dupes = await one(`SELECT COUNT(*)::int AS n FROM "AttemptReview" WHERE "attemptId" = $1`, [attempt.id]);
check("re-reviewing updates rather than duplicating", dupes.n === 1, `${dupes.n} row(s)`);

/* ── 6. recording retention ────────────────────────────────────────────── */
section("[6] recordings can be cleared without losing scores");
await query(`UPDATE "Attempt" SET audio = 'data:audio/webm;base64,AAAA' WHERE "learnerId" = $1`, [learner.learnerId]);
const before = await one(`SELECT COUNT(*)::int AS n FROM "Attempt" WHERE "learnerId" = $1 AND audio IS NOT NULL`, [learner.learnerId]);
const cleared = await json(`/api/learners/${learner.learnerId}/recordings`, { cookie: specialist, method: "DELETE" });
const after = await one(
  `SELECT COUNT(*)::int AS with_audio,
          (SELECT COUNT(*)::int FROM "Attempt" WHERE "learnerId" = $1) AS total
     FROM "Attempt" WHERE "learnerId" = $1 AND audio IS NOT NULL`,
  [learner.learnerId]
);
check("recordings are removed", cleared.status === 200 && after.with_audio === 0, `${before.n} → 0`);
check("the scored attempts survive", after.total > 0, `${after.total} attempts kept`);

/* ── cleanup ───────────────────────────────────────────────────────────── */
await deleteTestLearner(learner.email);
await endSuite();

report("Logic audit");
