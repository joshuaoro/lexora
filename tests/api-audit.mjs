/**
 * Authorization, validation and data-scoping audit.
 *
 * Learner records here belong to children, so the important property is that
 * nobody can read or change data they do not own. Run against localhost or a
 * deployed URL:  npm run audit:api -- https://your-app.vercel.app
 */
import {
  BASE, api, json, login, check, section, report, query, one,
  createTestLearner, deleteTestLearner, endSuite,
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
const wordId = (await one(`SELECT id FROM "Word" WHERE NOT "isPseudo" ORDER BY text LIMIT 1`)).id;
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
// Assert what the learner actually sees, not the status line. The signed-in
// layout is an async server component, so Next.js commits response headers
// before `notFound()` runs deeper in the tree and the status stays 200 even
// though the not-found page is what renders. That is framework behaviour, not
// something LEXORA controls, and nothing here consumes the status code.
const unknownSlug = await api("/exercises/not-a-thing", { cookie: alice.cookie });
const unknownBody = await unknownSlug.text();
check(
  "unknown exercise slug renders the not-found page",
  /couldn.t find that page|could not be found|404/i.test(unknownBody),
  `HTTP ${unknownSlug.status}`
);

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

/* ── 9. the database is not reachable around the app ───────────────────── */
/**
 * Supabase serves a PostgREST endpoint at https://<ref>.supabase.co/rest/v1/
 * and grants `anon` full DML on the public schema by default. That is a second
 * door into the same database, and none of sections 1–8 above can see it —
 * every one of them tests LEXORA's own front door.
 *
 * Two ways to check, strongest first:
 *
 *   With SUPABASE_ANON_KEY set, the real property is asserted directly: present
 *   the key the way an attacker would and confirm no learner row comes back.
 *   The key is public by design in Supabase's model, so keeping it in .env
 *   costs nothing and buys the only test that proves the actual guarantee.
 *
 *   Without it, fall back to confirming the endpoint does not answer as a live
 *   PostgREST instance at all. Weaker — absence of a door rather than a locked
 *   one — but it needs no extra configuration.
 */
section("[9] the Supabase Data API is not a second way in");

const ref = (process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "").match(
  /\/\/postgres\.([a-z0-9]+):/
)?.[1];

if (!ref) {
  check("SKIP: no Supabase project ref in DIRECT_URL — nothing to probe", true);
} else {
  const restBase = `https://${ref}.supabase.co/rest/v1`;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  /** Fetch that treats a dead host as a result, not an exception. */
  const probe = async (path, headers = {}) => {
    try {
      const res = await fetch(`${restBase}${path}`, {
        headers,
        signal: AbortSignal.timeout(15000),
      });
      return { status: res.status, body: await res.text().catch(() => "") };
    } catch {
      return { status: 0, body: "" }; // unreachable — which is the goal
    }
  };

  if (anonKey) {
    // The tables worth naming individually: anything holding a child's data or
    // a credential. A single sampled table would not prove the others.
    for (const table of ["User", "Attempt", "LearnerProfile", "AttemptReview"]) {
      const res = await probe(`/${table}?select=*&limit=1`, {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      });
      // RLS with no policies answers 200 with an empty array; a disabled Data
      // API answers 404 or does not connect. Both are fine. What must never
      // happen is a row coming back.
      let rows = null;
      try {
        const parsed = JSON.parse(res.body);
        if (Array.isArray(parsed)) rows = parsed.length;
      } catch {
        /* not a JSON array — no rows by definition */
      }
      check(
        `anon key reads no rows from ${table}`,
        rows === null || rows === 0,
        `HTTP ${res.status}${rows === null ? "" : `, rows=${rows}`}`
      );
    }
  } else {
    const res = await probe("/");
    // "No API key found" is PostgREST answering, which means the endpoint is
    // live and only the anon key stands between it and the data.
    const live = res.status === 200 || /No API key found/i.test(res.body);
    check(
      "the Data API does not answer as a live PostgREST instance",
      !live,
      live
        ? `HTTP ${res.status} — disable it in Supabase → Settings → Data API, ` +
            "or set SUPABASE_ANON_KEY in .env for the stronger row-level check"
        : `HTTP ${res.status || "unreachable"}`
    );
  }
}

/* ── 10. RLS has not silently blinded the app ──────────────────────────── */
/**
 * The counterpart to section 9, and the more dangerous direction.
 *
 * RLS with no policies denies SELECT *silently* — zero rows, no error. If the
 * app's connection role ever lost BYPASSRLS, nothing would crash; every child's
 * data would simply appear to have vanished, and the first person to notice
 * would be a specialist wondering where a learner's history went.
 *
 * Three things make this test able to catch that, and each of them is load
 * bearing:
 *
 *   It reads over HTTP. `query()` here uses a raw pg client on DIRECT_URL —
 *   the same `postgres` role Prisma uses — so a query()-only check would bypass
 *   RLS exactly as the app does and pass while the deployment returned nothing.
 *   Only a request to a running endpoint exercises the app's own connection,
 *   which matters most against Vercel, where DATABASE_URL may resolve to a
 *   different role than the DIRECT_URL this suite reads with.
 *
 *   It compares counts rather than asserting non-emptiness. RLS is enabled per
 *   table and could be misapplied to one of them, so the realistic failure is a
 *   filtered subset, which "more than zero" sails straight past.
 *
 *   It seeds its own rows. If the app and the database both reported zero the
 *   check would pass having proved nothing — the same vacuous-assertion trap
 *   that let a build fingerprint "change" to the md5 of an empty string.
 *
 * These have been watched failing, which is the only reason to trust them. On
 * the first run the fixture was wrong in two different ways and the section
 * caught both: ActivitySession reported "app sees 0, database holds 1" (the
 * session was opened but never closed, and the export filters total > 0), and
 * PracticeItem reported 0 against 0 and refused to pass on it (the miss carried
 * no wordId, so recordMiss never fired). Divergence and vacuity, both surfaced
 * before either had a chance to become a green check over nothing.
 *
 * Note for anyone trying to re-stage the real failure: FORCE ROW LEVEL SECURITY
 * will not do it. A role holding BYPASSRLS bypasses row security whether or not
 * FORCE is set — measured on this database, 76 PhonItem rows before and during
 * FORCE. Reproducing it means pointing the app at a role without BYPASSRLS.
 */
section("[10] the app can still read every table through its own connection");

const rls = await createTestLearner("rls");
const rlsSession = await json("/api/sessions", {
  cookie: rls.cookie,
  method: "POST",
  body: { type: "READ_ALOUD" },
});

// One correct reading and one miss. The miss is what creates a PracticeItem —
// and only if wordId is sent, since recordMiss keys the practice list on the
// word row rather than on the target text.
const readings = [
  { target: "bahay", heard: "bahay" },
  { target: "bola", heard: "dola" },
];
const attemptIds = [];
for (const r of readings) {
  const w = await one(`SELECT id FROM "Word" WHERE text = $1`, [r.target]);
  const res = await json("/api/attempts", {
    cookie: rls.cookie,
    method: "POST",
    body: {
      activityType: "READ_ALOUD",
      target: r.target,
      wordId: w?.id ?? null,
      browserTranscript: r.heard,
      responseMs: 1500,
      sessionId: rlsSession.body?.id,
    },
  });
  if (res.body?.attemptId ?? res.body?.id) attemptIds.push(res.body.attemptId ?? res.body.id);
}

// Close the session with its totals. The sessions export filters on total > 0,
// so a session that was opened and never finished is legitimately invisible to
// it — leaving it open would make the parity check below fail for a reason that
// has nothing to do with RLS.
if (rlsSession.body?.id) {
  await api(`/api/sessions/${rlsSession.body.id}`, {
    cookie: rls.cookie,
    method: "PATCH",
    body: { total: readings.length, correct: 1, durationMs: 3000 },
  });
}

// A specialist verdict plus a tag, so AttemptReview and ReviewErrorTag are not
// empty on either side of the comparison.
if (attemptIds.length) {
  await api("/api/reviews", {
    cookie: specialist,
    method: "POST",
    body: { attemptId: attemptIds[0], agrees: true, blind: true, tags: ["vowel"] },
  });
}

/** Assert the app and the database agree, and that neither is empty. */
async function parity(label, appCount, sql, params = []) {
  const dbCount = Number((await one(sql, params)).n);
  check(
    `${label}: app sees ${appCount}, database holds ${dbCount}`,
    appCount === dbCount && dbCount > 0,
    dbCount === 0 ? "nothing seeded — the check would be vacuous" : ""
  );
}

// Attempt + Word + ActivitySession, via the learner's own export.
const rlsCsv = await (
  await api("/api/export?what=attempts", { cookie: rls.cookie })
).text();
const rlsRows = rlsCsv.trim().split("\n").length - 1;
await parity("Attempt", rlsRows, `SELECT COUNT(*)::int n FROM "Attempt" WHERE "learnerId" = $1`, [
  rls.learnerId,
]);

// User + LearnerProfile, via the all-learner summary the specialist exports.
const sumCsv = await (
  await api("/api/export?what=summary", { cookie: specialist })
).text();
await parity(
  "LearnerProfile",
  sumCsv.trim().split("\n").length - 1,
  `SELECT COUNT(*)::int n FROM "LearnerProfile" WHERE NOT "isDemo"`
);

// ActivitySession, via the sessions export.
const sessCsv = await (
  await api(`/api/export?what=sessions&learnerId=${rls.learnerId}`, { cookie: specialist })
).text();
await parity(
  "ActivitySession",
  sessCsv.trim().split("\n").length - 1,
  `SELECT COUNT(*)::int n FROM "ActivitySession" WHERE "learnerId" = $1`,
  [rls.learnerId]
);

// AttemptReview + ReviewErrorTag, read back through the attempts export's
// review column rather than counted directly — it is the app's own join.
const reviewedCsv = await (
  await api(`/api/export?what=attempts&learnerId=${rls.learnerId}`, { cookie: specialist })
).text();
const reviewedRows = reviewedCsv
  .trim()
  .split("\n")
  .slice(1)
  .filter((line) => /agree|dispute/i.test(line)).length;
await parity(
  "AttemptReview",
  reviewedRows,
  `SELECT COUNT(*)::int n FROM "AttemptReview" r
     JOIN "Attempt" a ON a.id = r."attemptId" WHERE a."learnerId" = $1`,
  [rls.learnerId]
);

// PracticeItem — the miss above should have put one word on the list. The
// app-side number comes from the summary export's own practice columns
// (practice_words_active + practice_words_mastered), not from a second database
// read: comparing a query against itself would be exactly the vacuous check
// this section exists to rule out.
const summaryHeader = sumCsv.trim().split("\n")[0].replace(/^﻿/, "").split(",");
const emailCol = summaryHeader.indexOf("email");
const activeCol = summaryHeader.indexOf("practice_words_active");
const masteredCol = summaryHeader.indexOf("practice_words_mastered");
const ourRow = sumCsv
  .trim()
  .split("\n")
  .slice(1)
  .map((line) => line.split(","))
  .find((cells) => cells[emailCol] === rls.email);

if (!ourRow || emailCol === -1 || activeCol === -1) {
  check("PracticeItem: summary export exposes the test learner's row", false, "row not found");
} else {
  await parity(
    "PracticeItem",
    Number(ourRow[activeCol]) + Number(ourRow[masteredCol]),
    `SELECT COUNT(*)::int n FROM "PracticeItem" WHERE "learnerId" = $1`,
    [rls.learnerId]
  );
}

// Word and PhonItem have no JSON endpoint — they reach a child only through a
// server-rendered page, and `buildItems` runs on the server before it renders.
//
// The start screen prints the size of the run it just built — "Start! (8
// words)" — which is that server query's result count made visible. Asserting
// on it is worth more than looking for a word in the markup: the words go into
// a client component's props, and an empty run still renders a full page, so a
// byte-length or "page loaded" check would pass with nothing behind it. If RLS
// blinded either table the count would read 0 while the page looked normal.
const RUN_SIZE = 8;
for (const [slug, table] of [
  ["read-aloud", "Word"],
  ["rhyme", "PhonItem"],
]) {
  const page = await (await api(`/exercises/${slug}`, { cookie: rls.cookie })).text();
  const built = Number(page.match(/\((\d+)\s*(?:words|salita)\)/i)?.[1] ?? -1);
  check(
    `${table}: the ${slug} run was built from ${RUN_SIZE} database rows`,
    built === RUN_SIZE,
    built === -1 ? "no item count found on the start screen" : `built ${built}`
  );
}

// SpeechClip — a cached instruction line must still be servable.
const clip = await api("/api/speech?lang=fil&text=Magaling!", { cookie: rls.cookie });
check("SpeechClip is readable through /api/speech", clip.status === 200, `HTTP ${clip.status}`);

await deleteTestLearner(rls.email);

/* ── cleanup ───────────────────────────────────────────────────────────── */
await deleteTestLearner(alice.email);
await deleteTestLearner(bob.email);
await endSuite();

report("API audit");
