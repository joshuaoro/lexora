/**
 * Production smoke test — the things the other suites structurally cannot cover
 * because they only exercise the text fallback and a local server:
 *
 *   - real audio through the Groq/Whisper API (proves GROQ_API_KEY is deployed)
 *   - neural TTS generated from inside a serverless function
 *   - the SPECIALIST_CODE actually configured on the host
 *   - CSV exports, concurrency, and study-data integrity
 *
 *   npm run audit:prod -- https://your-app.vercel.app YOUR-SPECIALIST-CODE
 *
 * Needs DIRECT_URL in .env pointing at the same database the deployment uses.
 */
import {
  BASE, api, json, login, check, section, report, query, one,
  createTestLearner, deleteTestLearner, closeDb,
} from "./helpers.mjs";

const SPECIALIST_CODE = process.argv[3] ?? process.env.SPECIALIST_CODE ?? "";
console.log(`Production smoke test against ${BASE}`);

const specialist = await login("specialist@lexora.ph");
check("demo specialist can sign in", !!specialist);
const learner = await createTestLearner("prod");

/* ── 1. real Whisper round trip ────────────────────────────────────────── */
section("[1] server-side Whisper (real audio, not the text fallback)");
const clip = (await one(`SELECT "audioWord" FROM "Word" WHERE text = 'bahay'`)).audioWord;

const readAudio = (target) =>
  json("/api/attempts", {
    cookie: learner.cookie,
    method: "POST",
    body: { activityType: "READ_ALOUD", target, audio: clip, responseMs: 2000 },
  });

const hit = await readAudio("bahay");
check(
  "audio is transcribed server-side",
  hit.body.engine === "server",
  `engine=${hit.body.engine ?? "none"}, heard="${hit.body.heard ?? ""}"`
);
check("a correct reading is scored correct", hit.body.correct === true, `sim ${(hit.body.score ?? 0).toFixed(2)}`);

await new Promise((r) => setTimeout(r, 4000)); // respect the free-tier rate limit
const miss = await readAudio("araw");
check("the same clip against another target is wrong", miss.body.correct === false, `heard="${miss.body.heard ?? ""}"`);

/* ── 2. serverless TTS generation ──────────────────────────────────────── */
section("[2] on-demand audio generation from a serverless function");
// Letters only — the word bank rejects digits, which is correct behaviour.
const suffix = Array.from({ length: 5 }, () => "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)]).join("");
const probeWord = `probe${suffix}`;
const created = await json("/api/words", {
  cookie: specialist,
  method: "POST",
  body: { text: probeWord, syllables: "pro-be", pattern: "CCVCV", stage: 6, level: 3 },
});
check("specialist can add a word", created.status === 201, `HTTP ${created.status}`);

if (created.body?.id) {
  const gen = await api(`/api/words/${created.body.id}/audio/generate`, { cookie: specialist, method: "POST" });
  const row = await one(`SELECT "audioWord" IS NOT NULL AS has FROM "Word" WHERE id = $1`, [created.body.id]);
  check("msedge-tts works from the host", gen.ok && row?.has === true, gen.ok ? "generated" : `HTTP ${gen.status}`);

  const served = await api(`/api/word-audio/${created.body.id}?kind=word`, { cookie: learner.cookie });
  check("the new clip is served back", served.ok, `HTTP ${served.status} ${served.headers.get("content-type")}`);
  await query(`DELETE FROM "Word" WHERE id = $1`, [created.body.id]);
}

/* ── 3. the deployed specialist access code ────────────────────────────── */
section("[3] the SPECIALIST_CODE configured on the host");
if (!SPECIALIST_CODE) {
  check("a code was supplied to test with", false, "pass it as the second argument");
} else {
  const email = `probe-sp-${Date.now()}@lexora.test`;
  const reg = await api("/api/auth/register", {
    method: "POST",
    body: { name: "Probe", email, password: "lexora123", role: "SPECIALIST", code: SPECIALIST_CODE },
  });
  const why = (await reg.json().catch(() => ({}))).error ?? "";
  check(
    "specialists can register with it",
    reg.status === 201,
    reg.status !== 403
      ? `HTTP ${reg.status}`
      : /disabled/i.test(why)
        ? "SPECIALIST_CODE is NOT set on the host — no specialist can register"
        : "the host has a different code than the one supplied"
  );
  await query(`DELETE FROM "User" WHERE email = $1`, [email]);
}

/* ── 4. exports ────────────────────────────────────────────────────────── */
section("[4] CSV exports");
for (const what of ["summary", "attempts", "sessions"]) {
  const res = await api(`/api/export?what=${what}`, { cookie: specialist });
  const rows = (await res.text()).trim().split("\n").length - 1;
  check(`${what} export downloads`, res.ok && rows >= 1, `${rows} rows`);
}

/* ── 5. concurrency ────────────────────────────────────────────────────── */
section("[5] concurrent use (a class reading at the same time)");
const words = await query(`SELECT id, text FROM "Word" WHERE level = 1 LIMIT 5`);
const t0 = Date.now();
const burst = await Promise.all(
  words.map((w) =>
    api("/api/attempts", {
      cookie: learner.cookie,
      method: "POST",
      body: { activityType: "READ_ALOUD", wordId: w.id, target: w.text, browserTranscript: w.text, responseMs: 1200 },
    }).then((r) => r.status)
  )
);
check("five concurrent attempts succeed", burst.every((s) => s === 200), `${burst.join(",")} in ${Date.now() - t0}ms`);

const pages = await Promise.all(
  ["/dashboard", "/reader", "/exercises", "/practice", "/reports"].map((path) =>
    api(path, { cookie: learner.cookie }).then((r) => r.status)
  )
);
check("five concurrent page loads succeed", pages.every((s) => s === 200), pages.join(","));

/* ── 6. study data integrity ───────────────────────────────────────────── */
section("[6] study data integrity");
const stats = await one(`
  SELECT
    (SELECT COUNT(*) FROM "Word")::int AS words,
    (SELECT COUNT(*) FROM "Word" WHERE "audioWord" IS NULL AND "audioWordHuman" IS NULL)::int AS no_audio,
    (SELECT COUNT(*) FROM "PhonItem")::int AS rhymes,
    (SELECT COUNT(*) FROM "Attempt" a
       WHERE NOT EXISTS (SELECT 1 FROM "LearnerProfile" lp WHERE lp.id = a."learnerId"))::int AS orphans
`);
check("word bank intact", stats.words >= 115, `${stats.words} words`);
check("every word has pronunciation audio", stats.no_audio === 0, `${stats.no_audio} missing`);
check("rhyme bank intact", stats.rhymes === 10, `${stats.rhymes} items`);
check("no orphaned rows", stats.orphans === 0, `${stats.orphans}`);

await deleteTestLearner(learner.email);
const leftover = await one(`SELECT COUNT(*)::int AS n FROM "User" WHERE email LIKE '%@lexora.test'`);
check("no test accounts left behind", leftover.n === 0, `${leftover.n}`);

const juan = await one(`
  SELECT lp.level, lp.stage, (SELECT COUNT(*)::int FROM "Attempt" WHERE "learnerId" = lp.id) AS attempts
  FROM "LearnerProfile" lp JOIN "User" u ON u.id = lp."userId" WHERE u.email = 'learner1@lexora.ph'`);
console.log(`  (demo learner: L${juan.level} S${juan.stage}, ${juan.attempts} attempts)`);

await closeDb();
report("Production smoke test");
