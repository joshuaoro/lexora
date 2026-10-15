/**
 * Instructional-logic audit: the rules the study actually depends on —
 * adaptive difficulty, practice-list mastery, scoring strictness, and the
 * specialist–system agreement metric.
 */
import {
  BASE, api, json, check, section, report, query, one,
  requireSpecialistLogin, createTestLearner, deleteTestLearner, endSuite,
} from "./helpers.mjs";

console.log(`Logic audit against ${BASE}`);

const specialist = await requireSpecialistLogin();

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

const fresh = await adaptiveProfile();
check("starts at level 1", fresh.level === 1);
// Level 1 draws its words from stage 3 (m, s, a, i, o, b, e, u). The record
// used to say stage 1 — the letters m, s, a — until the first level change, so
// a specialist, the summary export and the IEP draft all described a placement
// the child was not being taught at.
check(
  "and is recorded at the Marungko stage level 1 actually teaches from",
  fresh.stage === 3,
  `S${fresh.stage}`
);

// The skill-progression map asks for phonological awareness first, then
// decoding. These are listening answers — the activity reports the choice.
const listeningAnswers = async (who, n, correct = true) => {
  for (let i = 0; i < n; i++) {
    await json("/api/attempts", {
      cookie: who.cookie,
      method: "POST",
      body: { activityType: "BLEND", target: "mama", choiceCorrect: correct, responseMs: 1500 },
    });
  }
};

const easy = await query(`SELECT id, text FROM "Word" WHERE level = 1 AND NOT "isPseudo" ORDER BY text LIMIT 11`);
for (const w of easy.slice(0, 10)) await adaptiveRead(w.id, w.text, w.text);
const readOnly = await adaptiveProfile();
check(
  "accurate reading alone does not promote before phonological awareness is shown",
  readOnly.level === 1,
  `L${readOnly.level}`
);

await listeningAnswers(adaptive, 8);
const listenedOnly = await adaptiveProfile();
check("listening answers by themselves never move the level", listenedOnly.level === 1, `L${listenedOnly.level}`);

await adaptiveRead(easy[10].id, easy[10].text, easy[10].text);
const up = await adaptiveProfile();
check("levels up once both criteria on the map are met", up.level === 2, `L${up.level} S${up.stage}`);
check("Marungko stage widens with the level", up.stage >= 4, `S${up.stage}`);

const any = await query(`SELECT id, text FROM "Word" WHERE level <= 2 AND NOT "isPseudo" ORDER BY text LIMIT 10`);
for (const w of any) await adaptiveRead(w.id, w.text, "zzzz");
const down = await adaptiveProfile();
check("levels down after poor accuracy", down.level === 1, `L${down.level}`);
check("stage never shrinks back", down.stage >= up.stage, `S${down.stage}`);

// Either side of the 80% line, set by the research team on 9 October. The
// misreads come first: promotion is evaluated after every attempt, so trailing
// misreads would arrive too late — the learner would already have been
// promoted on a clean run. Phonological awareness is met first, so the reading
// threshold is the only thing that can be holding these learners.
async function readTwelve(misreads) {
  const who = await createTestLearner("borderline");
  await listeningAnswers(who, 8);
  const words = await query(`SELECT id, text FROM "Word" WHERE level = 1 AND NOT "isPseudo" ORDER BY text LIMIT 12`);
  for (let i = 0; i < 12; i++) {
    const w = words[i % words.length];
    await json("/api/attempts", {
      cookie: who.cookie,
      method: "POST",
      body: {
        activityType: "READ_ALOUD",
        wordId: w.id,
        target: w.text,
        browserTranscript: i < misreads ? "zzzz" : w.text,
        responseMs: 1500,
      },
    });
  }
  const { level } = await one(`SELECT level FROM "LearnerProfile" WHERE id = $1`, [who.learnerId]);
  await deleteTestLearner(who.email);
  return level;
}
const below = await readTwelve(3); // 9 of 12 = 75%
check("75% accuracy stays below the 80% level-up line", below === 1, `L${below}`);
const above = await readTwelve(2); // 10 of 12 = 83%
check("83% clears it", above === 2, `L${above}`);
await deleteTestLearner(adaptive.email);

/* ── 2b. practice readings stay out of every figure ────────────────────── */
section("[2b] practice readings stay out of every figure");
/** This learner's row of the summary export, as an object keyed by column. */
async function summaryRow(learnerId) {
  const lines = (await (await api("/api/export?what=summary", { cookie: specialist })).text())
    .replace(/^﻿/, "")
    .trim()
    .split("\r\n");
  const cols = lines[0].split(",");
  const cells = lines.slice(1).map((l) => l.split(",")).find((c) => c[cols.indexOf("learner_id")] === learnerId);
  return cells ? Object.fromEntries(cols.map((c, i) => [c, cells[i]])) : null;
}
const measured = await createTestLearner("measured");
const mWords = await query(`SELECT id, text FROM "Word" WHERE level = 1 AND NOT "isPseudo" ORDER BY text LIMIT 2`);
// One Read aloud misread puts the word on the list and is the only measured reading.
await json("/api/attempts", {
  cookie: measured.cookie,
  method: "POST",
  body: { activityType: "READ_ALOUD", wordId: mWords[0].id, target: mWords[0].text, browserTranscript: "zzzz", responseMs: 1500 },
});
const beforePractice = await summaryRow(measured.learnerId);
for (let i = 0; i < 4; i++) {
  await json("/api/attempts", {
    cookie: measured.cookie,
    method: "POST",
    body: { activityType: "PRACTICE", wordId: mWords[0].id, target: mWords[0].text, browserTranscript: mWords[0].text, responseMs: 1200 },
  });
}
// A specialist scoring a practice reading must not reach the agreement figure.
const pAttempt = await one(
  `SELECT id FROM "Attempt" WHERE "learnerId" = $1 AND "activityType" = 'PRACTICE' ORDER BY "createdAt" DESC LIMIT 1`,
  [measured.learnerId]
);
await json("/api/reviews", { cookie: specialist, method: "POST", body: { attemptId: pAttempt.id, agrees: true, blind: true } });
const afterPractice = await summaryRow(measured.learnerId);
check(
  "practice readings do not count as measured readings",
  beforePractice?.oral_attempts === "1" && afterPractice?.oral_attempts === "1",
  `oral_attempts ${beforePractice?.oral_attempts} → ${afterPractice?.oral_attempts}`
);
check(
  "nor change accuracy",
  afterPractice?.oral_accuracy_pct === beforePractice?.oral_accuracy_pct,
  `${beforePractice?.oral_accuracy_pct}% → ${afterPractice?.oral_accuracy_pct}%`
);
check(
  "nor enter the agreement sample when scored",
  afterPractice?.attempts_reviewed === "0",
  `attempts_reviewed ${afterPractice?.attempts_reviewed}`
);
const mLevel = await one(`SELECT level FROM "LearnerProfile" WHERE id = $1`, [measured.learnerId]);
check("nor move the level", mLevel.level === 1, `L${mLevel.level}`);
await deleteTestLearner(measured.email);

/* ── 3. practice list: lessons, checks and mastery ─────────────────────── */
section("[3] practice list: lessons, checks and mastery");
// Read aloud misreads (with word ids) put words on the list.
const missWords = await query(`SELECT id, text FROM "Word" WHERE level = 1 AND NOT "isPseudo" ORDER BY text LIMIT 3`);
for (const w of missWords) await read(w.id, w.text, "zzzz");

const practice = await query(
  `SELECT p."wordId", w.text FROM "PracticeItem" p JOIN "Word" w ON w.id = p."wordId" WHERE p."learnerId" = $1 ORDER BY w.text`,
  [learner.learnerId]
);
check("misread words are collected automatically", practice.length > 0, `${practice.length} words`);

const itemRow = (wordId) =>
  one(
    `SELECT streak, mastered, "missCount", "lastTaughtOn"::text AS taught, "lastSeenOn"::text AS seen
       FROM "PracticeItem" WHERE "learnerId" = $1 AND "wordId" = $2`,
    [learner.learnerId, wordId]
  );
const lastMode = () =>
  one(
    `SELECT "practiceMode" FROM "Attempt" WHERE "learnerId" = $1 AND "activityType" = 'PRACTICE'
      ORDER BY "createdAt" DESC LIMIT 1`,
    [learner.learnerId]
  ).then((r) => r?.practiceMode ?? null);
const practiceRead = (w, heard, extra = {}) =>
  json("/api/attempts", {
    cookie: learner.cookie,
    method: "POST",
    body: { activityType: "PRACTICE", wordId: w.wordId, target: w.text, browserTranscript: heard, responseMs: 1200, ...extra },
  });
/** Pretend the word's last lesson and last sighting were a day earlier. */
const aDayPasses = (w) =>
  query(
    `UPDATE "PracticeItem" SET "lastTaughtOn" = "lastTaughtOn" - 1, "lastSeenOn" = "lastSeenOn" - 1
      WHERE "learnerId" = $1 AND "wordId" = $2`,
    [learner.learnerId, w.wordId]
  );

const [first, second] = practice;
const lesson1 = await practiceRead(first, first.text);
check("a word's first Practice reading is a lesson", (await lastMode()) === "lesson" && lesson1.body.practice?.mode === "lesson", String(await lastMode()));
check("a lesson is not progress", (await itemRow(first.wordId)).streak === 0);
await practiceRead(first, first.text);
check("a second reading the same day is a lesson again", (await lastMode()) === "lesson");

await aDayPasses(first);
const check1 = await practiceRead(first, first.text);
const afterCheck1 = await itemRow(first.wordId);
check("on a later day it is a check", (await lastMode()) === "check" && check1.body.practice?.mode === "check");
check("a correct check is one step, not mastery", afterCheck1.streak === 1 && !afterCheck1.mastered, `streak=${afterCheck1.streak}`);
await practiceRead(first, first.text);
check("a second reading that day is a lesson, not a second check", (await lastMode()) === "lesson" && (await itemRow(first.wordId)).streak === 1);

await aDayPasses(first);
const check2 = await practiceRead(first, first.text);
check("a correct check on another day masters the word", (await itemRow(first.wordId)).mastered === true && check2.body.practice?.mastered === true);

// Review focus 4: misread again in Read aloud, it comes back as a check.
await read(first.wordId, first.text, "zzzz");
const back = await itemRow(first.wordId);
check("a mastered word misread in Read aloud returns to the list", back.mastered === false && back.streak === 0, `missCount=${back.missCount}`);
await aDayPasses(first);
await practiceRead(first, first.text);
check("and its next Practice is a check, not a fresh lesson", (await lastMode()) === "check");

// A misread check resets progress and is taught again.
await practiceRead(second, second.text); // lesson
await aDayPasses(second);
await practiceRead(second, "qqqq"); // check, misread
const failed = await itemRow(second.wordId);
const today = (await one(`SELECT (now() AT TIME ZONE 'Asia/Manila')::date::text AS d`)).d;
check("a misread check resets progress and teaches the word again", failed.streak === 0 && failed.taught === today, `taught=${failed.taught}`);
check("practice misreads do not add to times missed", failed.missCount === 1, `missCount=${failed.missCount}`);

// Review focus 5: the stored mode is the server's.
await aDayPasses(second);
await practiceRead(second, second.text, { practiceMode: "lesson" });
check("the stored mode is the server's, whatever the client sends", (await lastMode()) === "check");

// Review focus 3: a word no longer on the list.
const offList = await one(`SELECT id, text FROM "Word" WHERE level = 2 AND NOT "isPseudo" ORDER BY text LIMIT 1`);
const stray = await practiceRead({ wordId: offList.id, text: offList.text }, offList.text);
check(
  "a Practice reading of a word not on the list is saved, with no mode",
  stray.status === 200 && (await lastMode()) === null && stray.body.practice === null,
  `HTTP ${stray.status}`
);

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
