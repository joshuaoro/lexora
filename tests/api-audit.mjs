/**
 * Authorization, validation and data-scoping audit.
 *
 * Learner records here belong to children, so the important property is that
 * nobody can read or change data they do not own. Run against localhost or a
 * deployed URL:  npm run audit:api -- https://your-app.vercel.app
 */
import {
  BASE, api, json, login, check, section, report, query, one,
  createTestLearner, deleteTestLearner, closeDb,
} from "./helpers.mjs";

console.log(`API audit against ${BASE}`);

const specialist = await login("specialist@lexora.ph");
if (!specialist) {
  console.error("Could not sign in as specialist@lexora.ph — is the database seeded?");
  process.exit(1);
}

const alice = await createTestLearner("api-a");
const bob = await createTestLearner("api-b");

/* ── 1. anonymous access ───────────────────────────────────────────────── */
section("[1] unauthenticated requests are rejected");
for (const [path, opts] of [
  ["/api/settings", {}],
  ["/api/export?what=attempts", {}],
  ["/api/sessions", { method: "POST", body: { type: "READ_ALOUD" } }],
  ["/api/attempts", { method: "POST", body: { activityType: "READ_ALOUD", target: "aso" } }],
  ["/api/reviews", { method: "POST", body: { attemptId: "x", agrees: true } }],
  ["/api/words", { method: "POST", body: { text: "x", syllables: "x", pattern: "CV", stage: 1, level: 1 } }],
]) {
  const res = await api(path, opts);
  check(`anon ${opts.method ?? "GET"} ${path}`, res.status === 401, String(res.status));
}

/* ── 2. learners cannot use specialist capabilities ────────────────────── */
section("[2] specialist-only endpoints reject learners");
const wordId = (await one(`SELECT id FROM "Word" ORDER BY text LIMIT 1`)).id;
for (const [label, path, method, body] of [
  ["create word", "/api/words", "POST", { text: "hax", syllables: "hax", pattern: "CVC", stage: 1, level: 1 }],
  ["review attempt", "/api/reviews", "POST", { attemptId: "x", agrees: true }],
  ["edit variants", `/api/words/${wordId}`, "PATCH", { variants: "x" }],
  ["save word audio", `/api/words/${wordId}/audio`, "PATCH", { kind: "word", audio: "data:audio/webm;base64,AAAA" }],
  ["delete word audio", `/api/words/${wordId}/audio`, "DELETE", undefined],
  ["generate word audio", `/api/words/${wordId}/audio/generate`, "POST", undefined],
  ["change level", `/api/learners/${bob.learnerId}`, "PATCH", { level: 5 }],
  ["erase learner", `/api/learners/${bob.learnerId}`, "DELETE", { confirmName: "AuditBot" }],
  ["clear recordings", `/api/learners/${bob.learnerId}/recordings`, "DELETE", undefined],
]) {
  const res = await api(path, { cookie: alice.cookie, method, body });
  check(`learner ${label}`, res.status === 401, String(res.status));
}

/* ── 3. data scoping between learners ──────────────────────────────────── */
section("[3] learners only ever see their own data");
// give Bob some data
await json("/api/attempts", {
  cookie: bob.cookie,
  method: "POST",
  body: { activityType: "READ_ALOUD", target: "bahay", browserTranscript: "bahay", responseMs: 1000 },
});

const bobCsv = await (await api("/api/export?what=attempts", { cookie: bob.cookie })).text();
check("a learner's export contains their own rows", bobCsv.trim().split("\n").length - 1 >= 1);

// Alice asks for Bob's id explicitly — must be ignored
const spoofCsv = await (
  await api(`/api/export?what=attempts&learnerId=${bob.learnerId}`, { cookie: alice.cookie })
).text();
const spoofNames = new Set(spoofCsv.trim().split("\n").slice(1).map((l) => l.split(",")[1]));
check("learnerId cannot be used to read another learner", !spoofNames.has("AuditBot") || spoofCsv.trim().split("\n").length === 1,
  `rows=${spoofCsv.trim().split("\n").length - 1}`);

const summary = await api("/api/export?what=summary", { cookie: alice.cookie });
check("learners cannot export the all-learner summary", summary.status === 403, String(summary.status));

/* ── 4. session ownership ──────────────────────────────────────────────── */
section("[4] sessions can only be closed by their owner");
const sess = await json("/api/sessions", { cookie: alice.cookie, method: "POST", body: { type: "READ_ALOUD" } });
const foreign = await api(`/api/sessions/${sess.body.id}`, {
  cookie: bob.cookie, method: "PATCH", body: { total: 9, correct: 9, durationMs: 1 },
});
check("another learner cannot close it", foreign.status === 404, String(foreign.status));
const own = await api(`/api/sessions/${sess.body.id}`, {
  cookie: alice.cookie, method: "PATCH", body: { total: 1, correct: 1, durationMs: 100 },
});
check("the owner can close it", own.status === 200, String(own.status));

/* ── 5. auth validation ────────────────────────────────────────────────── */
section("[5] authentication validation");
check("wrong password rejected", (await api("/api/auth/login", { method: "POST", body: { email: "specialist@lexora.ph", password: "nope" } })).status === 401);
check("unknown email rejected", (await api("/api/auth/login", { method: "POST", body: { email: "ghost@x.ph", password: "lexora123" } })).status === 401);
check("duplicate email rejected", (await api("/api/auth/register", { method: "POST", body: { name: "X", email: alice.email, password: "abcdef", role: "LEARNER" } })).status === 409);
check("short password rejected", (await api("/api/auth/register", { method: "POST", body: { name: "X", email: `s-${Date.now()}@lexora.test`, password: "123", role: "LEARNER" } })).status === 400);
check("specialist role needs the access code", (await api("/api/auth/register", { method: "POST", body: { name: "X", email: `sp-${Date.now()}@lexora.test`, password: "abcdef", role: "SPECIALIST" } })).status === 403);
check("blank access code never matches", (await api("/api/auth/register", { method: "POST", body: { name: "X", email: `sp2-${Date.now()}@lexora.test`, password: "abcdef", role: "SPECIALIST", code: "" } })).status === 403);

/* ── 6. input validation ───────────────────────────────────────────────── */
section("[6] input validation");
check("out-of-range font size", (await api("/api/settings", { cookie: alice.cookie, method: "PATCH", body: { fontSize: 9999 } })).status === 400);
check("unknown font", (await api("/api/settings", { cookie: alice.cookie, method: "PATCH", body: { font: "papyrus" } })).status === 400);
check("unknown activity type", (await api("/api/attempts", { cookie: alice.cookie, method: "POST", body: { activityType: "NOPE", target: "aso" } })).status === 400);
check("missing target word", (await api("/api/attempts", { cookie: alice.cookie, method: "POST", body: { activityType: "READ_ALOUD" } })).status === 400);
check("unknown session type", (await api("/api/sessions", { cookie: alice.cookie, method: "POST", body: { type: "NOPE" } })).status === 400);
check("duplicate word", (await api("/api/words", { cookie: specialist, method: "POST", body: { text: "bahay", syllables: "ba-hay", pattern: "CVCVC", stage: 6, level: 2 } })).status === 409);
check("word with spaces", (await api("/api/words", { cookie: specialist, method: "POST", body: { text: "two words", syllables: "a-b", pattern: "X", stage: 1, level: 1 } })).status === 400);
check("word with bad stage", (await api("/api/words", { cookie: specialist, method: "POST", body: { text: "zzz", syllables: "zzz", pattern: "X", stage: 99, level: 1 } })).status === 400);
check("variants with digits", (await api(`/api/words/${wordId}`, { cookie: specialist, method: "PATCH", body: { variants: "abc123" } })).status === 400);
check("level out of range", (await api(`/api/learners/${alice.learnerId}`, { cookie: specialist, method: "PATCH", body: { level: 99 } })).status === 400);

/* ── 7. not found ──────────────────────────────────────────────────────── */
section("[7] unknown resources return 404");
check("unknown word audio", (await api("/api/word-audio/does-not-exist", { cookie: alice.cookie })).status === 404);
check("unknown learner", (await api("/api/learners/nope", { cookie: specialist, method: "PATCH", body: { level: 3 } })).status === 404);
check("unknown word generate", (await api("/api/words/nope/audio/generate", { cookie: specialist, method: "POST" })).status === 404);
check("unknown exercise slug", (await api("/exercises/not-a-thing", { cookie: alice.cookie })).status === 404);

/* ── 8. erasure really cascades ────────────────────────────────────────── */
section("[8] erasure removes every trace (RA 10173)");
const wrongName = await api(`/api/learners/${bob.learnerId}`, {
  cookie: specialist, method: "DELETE", body: { confirmName: "not the name" },
});
check("deletion requires the exact name", wrongName.status === 400, String(wrongName.status));

const erase = await api(`/api/learners/${bob.learnerId}`, {
  cookie: specialist, method: "DELETE", body: { confirmName: "AuditBot" },
});
check("specialist can erase a learner", erase.status === 200, String(erase.status));
const leftovers = await query(
  `SELECT
     (SELECT COUNT(*) FROM "Attempt" WHERE "learnerId" = $1) AS attempts,
     (SELECT COUNT(*) FROM "ActivitySession" WHERE "learnerId" = $1) AS sessions,
     (SELECT COUNT(*) FROM "PracticeItem" WHERE "learnerId" = $1) AS practice,
     (SELECT COUNT(*) FROM "LearnerProfile" WHERE id = $1) AS profile`,
  [bob.learnerId]
);
const l = leftovers[0];
check(
  "no orphaned rows remain",
  Number(l.attempts) === 0 && Number(l.sessions) === 0 && Number(l.practice) === 0 && Number(l.profile) === 0,
  JSON.stringify(l)
);

/* ── cleanup ───────────────────────────────────────────────────────────── */
await deleteTestLearner(alice.email);
await deleteTestLearner(bob.email);
await closeDb();

report("API audit");
