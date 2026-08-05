/**
 * Decoding-measure audit: the two things added because accuracy on a fixed bank
 * of real words is not, on its own, evidence that a child has learned to decode.
 *
 *   - the non-word probe, and the walls that keep it separate from practice
 *   - decoding latency as an outcome, including its hold on level-up
 *   - the stress caveat on words the transcript cannot tell apart
 *
 *   npm run audit:decoding -- https://your-app.vercel.app
 */
import { chromium } from "playwright-core";
import {
  BASE, PASSWORD, api, json, login, check, section, report, query, one,
  createTestLearner, endSuite,
} from "./helpers.mjs";

console.log(`Decoding audit against ${BASE}`);

const specialist = await login("specialist@lexora.ph");
if (!specialist) {
  console.error("Could not sign in as specialist@lexora.ph — is the database seeded?");
  process.exit(1);
}

/* ── 1. the probe bank itself ──────────────────────────────────────────── */
section("[1] the probe bank is separate, silent, and genuinely made up");

const pseudo = await query(`SELECT id, text, stage, level FROM "Word" WHERE "isPseudo" ORDER BY text`);
check("the probe bank is populated", pseudo.length >= 20, `${pseudo.length} non-words`);

const withGloss = await one(
  `SELECT COUNT(*)::int AS n FROM "Word" WHERE "isPseudo" AND "meaningEn" IS NOT NULL AND "meaningEn" <> ''`
);
check("no probe word carries a meaning", withGloss.n === 0, `${withGloss.n} with a gloss`);

const audible = await one(
  `SELECT COUNT(*)::int AS n FROM "Word"
    WHERE "isPseudo" AND ("audioWord" IS NOT NULL OR "audioSyll" IS NOT NULL
       OR "audioWordHuman" IS NOT NULL OR "audioSyllHuman" IS NOT NULL)`
);
check(
  "no probe word can be listened to",
  audible.n === 0,
  audible.n ? `${audible.n} would hand the child the answer` : "silent"
);

// The one failure mode that would be invisible: a "non-word" that is really a
// word. It would be read from memory like any other and the probe would quietly
// measure the thing it exists to rule out.
const collision = await one(
  `SELECT COUNT(*)::int AS n FROM "Word" a
     JOIN "Word" b ON lower(a.text) = lower(b.text) AND a."isPseudo" AND NOT b."isPseudo"`
);
check("no probe word duplicates a real bank word", collision.n === 0, `${collision.n} collisions`);

/* ── 2. probe words stay out of ordinary practice ──────────────────────── */
section("[2] a probe word never reaches an ordinary exercise");

const learner = await createTestLearner("probe");
const profile = () =>
  one(`SELECT level, stage FROM "LearnerProfile" WHERE id = $1`, [learner.learnerId]);

// Level 5 / stage 7 is the widest the pool ever gets, so if a probe word can
// leak into a session it leaks here.
await query(`UPDATE "LearnerProfile" SET level = 5, stage = 7 WHERE id = $1`, [learner.learnerId]);

const pseudoTexts = new Set(pseudo.map((w) => w.text));
let leaked = null;
for (const slug of ["read-aloud", "listen-choose", "syllables"]) {
  for (let run = 0; run < 4 && !leaked; run++) {
    const res = await api(`/exercises/${slug}`, { cookie: learner.cookie });
    const html = await res.text();
    for (const text of pseudoTexts) {
      // Word-boundary match: a bare substring would fire on any page chrome
      // that happens to contain the letters.
      if (new RegExp(`>\\s*${text}\\s*<|"${text}"`).test(html)) {
        leaked = `${text} in ${slug}`;
        break;
      }
    }
  }
}
check("12 exercise draws at the widest pool contain no probe word", leaked === null, leaked ?? "clean");

/* ── 3. a probe reading is recorded but changes nothing ────────────────── */
section("[3] a probe reading is measured, never taught from");

await query(`UPDATE "LearnerProfile" SET level = 1, stage = 3 WHERE id = $1`, [learner.learnerId]);
const before = await profile();

const probeSession = await json("/api/sessions", {
  cookie: learner.cookie,
  method: "POST",
  body: { type: "PSEUDO_PROBE" },
});
check("a probe session can be started", probeSession.status === 201, `HTTP ${probeSession.status}`);

const probeWord = pseudo.find((w) => w.stage <= 3) ?? pseudo[0];
const probeRead = await json("/api/attempts", {
  cookie: learner.cookie,
  method: "POST",
  body: {
    sessionId: probeSession.body.id,
    activityType: "PSEUDO_PROBE",
    wordId: probeWord.id,
    target: probeWord.text,
    browserTranscript: probeWord.text,
    responseMs: 2200,
  },
});
check("a probe reading is accepted", probeRead.status === 200, `HTTP ${probeRead.status}`);
check(
  "no verdict is returned to the child",
  probeRead.body.correct === undefined && probeRead.body.pending === true,
  JSON.stringify(probeRead.body).slice(0, 90)
);

// Ten misread probe items in a row: enough to trip the level-down rule if the
// probe were feeding the adaptive window, which it must not.
for (const w of pseudo.slice(0, 10)) {
  await json("/api/attempts", {
    cookie: learner.cookie,
    method: "POST",
    body: {
      sessionId: probeSession.body.id,
      activityType: "PSEUDO_PROBE",
      wordId: w.id,
      target: w.text,
      browserTranscript: "zzzz",
      responseMs: 3000,
    },
  });
}
const after = await profile();
check("ten missed probe items do not move the level", after.level === before.level, `L${after.level}`);

const onPracticeList = await one(
  `SELECT COUNT(*)::int AS n FROM "PracticeItem" pi
     JOIN "Word" w ON w.id = pi."wordId"
    WHERE pi."learnerId" = $1 AND w."isPseudo"`,
  [learner.learnerId]
);
check(
  "a missed probe word is never scheduled for teaching",
  onPracticeList.n === 0,
  `${onPracticeList.n} on the practice list`
);

const inAccuracy = await one(
  `SELECT COUNT(*)::int AS n FROM "Attempt"
    WHERE "learnerId" = $1 AND "activityType" IN ('READ_ALOUD','PRACTICE')`,
  [learner.learnerId]
);
check("probe readings sit outside the measured activity types", inAccuracy.n === 0, `${inAccuracy.n}`);

const stored = await one(
  `SELECT COUNT(*)::int AS n FROM "Attempt" WHERE "learnerId" = $1 AND "activityType" = 'PSEUDO_PROBE'`,
  [learner.learnerId]
);
check("but they are all recorded for the specialist", stored.n === 11, `${stored.n} stored`);

/* ── 4. the specialist's verdict, and how it reads back ────────────────── */
section("[4] the probe is scored by ear, and the verdict survives the round trip");

const toScore = await one(
  `SELECT id, correct FROM "Attempt"
    WHERE "learnerId" = $1 AND "activityType" = 'PSEUDO_PROBE' ORDER BY "createdAt" LIMIT 1`,
  [learner.learnerId]
);

// The specialist says "the child read it correctly". That is stored as whether
// they agree with the machine, so the value written depends on what the machine
// said — and must read back out as "read correctly" either way.
const verdict = await json("/api/reviews", {
  cookie: specialist,
  method: "POST",
  body: { attemptId: toScore.id, agrees: toScore.correct === true },
});
check("a specialist can score a probe reading", verdict.status < 300, `HTTP ${verdict.status}`);

const readBack = await one(
  `SELECT a.correct, r.agrees FROM "Attempt" a JOIN "AttemptReview" r ON r."attemptId" = a.id WHERE a.id = $1`,
  [toScore.id]
);
check(
  "'read it correctly' reads back as correct regardless of the machine's verdict",
  (readBack.agrees === readBack.correct) === true,
  `system=${readBack.correct}, agrees=${readBack.agrees}`
);

const page = await api(`/specialist/learner/${learner.learnerId}`, { cookie: specialist });
const pageHtml = await page.text();
check("the learner page shows a decoding-probe section", /Decoding probe/i.test(pageHtml));
check(
  "and tells the specialist to decide from the recording, not the transcript",
  /decide by ear/i.test(pageHtml),
  "caveat present"
);

/* ── 5. stress-contrastive words carry their caveat ────────────────────── */
section("[5] words whose meaning turns on unwritten stress are flagged");

const stressWords = await query(
  `SELECT text, "stressNote" FROM "Word" WHERE "stressNote" IS NOT NULL ORDER BY text`
);
check("the stress pairs are marked", stressWords.length >= 6, stressWords.map((w) => w.text).join(", "));

// bukas is the clearest case: búkas "tomorrow" against bukás "open". Both
// readings transcribe to the same letters, so the scorer cannot separate them.
const bukas = stressWords.find((w) => w.text === "bukas");
check("bukas is among them", Boolean(bukas), bukas?.stressNote ?? "missing");

const stressLearner = await createTestLearner("stress");
const bukasRow = await one(`SELECT id FROM "Word" WHERE text = 'bukas'`);
await json("/api/attempts", {
  cookie: stressLearner.cookie,
  method: "POST",
  body: {
    activityType: "READ_ALOUD",
    wordId: bukasRow.id,
    target: "bukas",
    browserTranscript: "bukas",
    responseMs: 1800,
  },
});
const stressPage = await api(`/specialist/learner/${stressLearner.learnerId}`, { cookie: specialist });
const stressHtml = await stressPage.text();
check(
  "the caveat reaches the specialist reviewing that reading",
  /b[uú]kas/i.test(stressHtml) && /stress/i.test(stressHtml),
  "shown in the review row"
);

/* ── 6. decoding latency is reported as an outcome ─────────────────────── */
section("[6] decoding time is an outcome, not a footnote");

const timed = await createTestLearner("latency");
const realWords = await query(
  `SELECT id, text FROM "Word" WHERE level = 1 AND NOT "isPseudo" ORDER BY text LIMIT 8`
);
for (const w of realWords) {
  await json("/api/attempts", {
    cookie: timed.cookie,
    method: "POST",
    body: {
      activityType: "READ_ALOUD",
      wordId: w.id,
      target: w.text,
      browserTranscript: w.text,
      responseMs: 4000,
    },
  });
}

const reports = await api("/reports", { cookie: timed.cookie });
const reportHtml = await reports.text();
check(
  "the report leads with typical time per word",
  /Typical time per word/i.test(reportHtml),
  "headline chip present"
);
check("and shows a figure, not a dash", /4\.0s|3\.\ds|4\.\ds/.test(reportHtml), "median rendered");

const summaryCsv = await (await api("/api/export?what=summary", { cookie: specialist })).text();
const header = summaryCsv.split("\r\n")[0];
for (const col of [
  "median_decode_ms",
  "timed_readings",
  "pseudo_items",
  "pseudo_scored",
  "pseudo_correct",
  "pseudo_accuracy_pct",
]) {
  check(`summary export carries ${col}`, header.includes(col));
}

const attemptsCsv = await (await api("/api/export?what=attempts", { cookie: specialist })).text();
const attemptsHeader = attemptsCsv.split("\r\n")[0];
for (const col of ["is_pseudoword", "specialist_correct", "stress_pair"]) {
  check(`attempts export carries ${col}`, attemptsHeader.includes(col));
}

/* ── 7. the latency guard on level-up ──────────────────────────────────── */
section("[7] a learner who is accurate but slowing down is not promoted");

/**
 * Both learners below read at 100% accuracy — well past the 85% the level rule
 * asks for. The only difference is what happens to their decoding time across
 * the window: one steady, one climbing.
 *
 * This is the whole point of the guard. In a transparent orthography like
 * Filipino a dyslexic child can hold accuracy at ceiling while decoding stays
 * effortful, and a rule that reads only accuracy will promote them level after
 * level until the words are far beyond them.
 */
async function readRun(who, timings) {
  const pool = await query(
    `SELECT id, text FROM "Word" WHERE level = 1 AND NOT "isPseudo" ORDER BY text LIMIT $1`,
    [timings.length]
  );
  for (let i = 0; i < timings.length; i++) {
    const w = pool[i];
    await json("/api/attempts", {
      cookie: who.cookie,
      method: "POST",
      body: {
        activityType: "READ_ALOUD",
        wordId: w.id,
        target: w.text,
        browserTranscript: w.text,
        responseMs: timings[i],
      },
    });
  }
}

const steady = await createTestLearner("steady");
await readRun(steady, [2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000]);
const steadyLevel = await one(`SELECT level FROM "LearnerProfile" WHERE id = $1`, [steady.learnerId]);
check("steady decoding still levels up on accuracy", steadyLevel.level === 2, `L${steadyLevel.level}`);

const slowing = await createTestLearner("slowing");
// Same ten correct readings, but the second half takes roughly three times as
// long as the first — comfortably past the 25% tolerance.
await readRun(slowing, [1500, 1500, 1500, 1500, 1500, 5000, 5000, 5000, 5000, 5000]);
const slowingLevel = await one(`SELECT level FROM "LearnerProfile" WHERE id = $1`, [slowing.learnerId]);
check(
  "accuracy alone does not promote a learner whose decoding is slowing",
  slowingLevel.level === 1,
  `L${slowingLevel.level} at 100% accuracy`
);

// The guard delays; it must never demote, and it must never be able to strand
// someone. Once the pace settles back the promotion goes through.
await readRun(slowing, [1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500]);
const recovered = await one(`SELECT level FROM "LearnerProfile" WHERE id = $1`, [slowing.learnerId]);
check(
  "and the promotion arrives once the pace settles",
  recovered.level === 2,
  `L${recovered.level}`
);

/* ── 8. what the child actually sees ───────────────────────────────────── */
section("[8] the probe on screen: no verdict, no correction, no stars");

const browser = await chromium.launch({
  channel: process.env.AUDIT_BROWSER ?? "msedge",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const pageErrors = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
p.on("pageerror", (e) => pageErrors.push(String(e)));
p.on("console", (m) => m.type() === "error" && pageErrors.push(m.text()));

const child = await createTestLearner("probe-ui");
await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p.fill("#email", child.email);
await p.fill("#password", PASSWORD);
await p.click("button[type=submit]");
await p.waitForURL("**/dashboard", { timeout: 30000 });

await p.goto(`${BASE}/exercises`, { waitUntil: "networkidle" });
check(
  "the probe is offered on the exercises page",
  await p.getByRole("link", { name: /Silly words/i }).isVisible(),
  "card present"
);

await p.goto(`${BASE}/exercises/silly-words`, { waitUntil: "networkidle" });
const introText = await p.locator("main").innerText();
check("the intro tells the child the words are made up", /made up/i.test(introText), "framing shown");

await p.getByRole("button", { name: /Start!/i }).click();
await p.getByRole("button", { name: /Skip this word/i }).waitFor({ timeout: 30000 });

// Skip records the reading with no transcript, which is the same path a real
// spoken answer takes on the way back — so the feedback screen it produces is
// the one a child would see.
const shown = await p.locator("main").innerText();
const wordOnScreen = pseudo.map((w) => w.text).filter((t) => new RegExp(`\\b${t}\\b`, "i").test(shown));
check("a probe non-word is on screen", wordOnScreen.length > 0, wordOnScreen.join(", ") || "none found");
check("no listen button offers to say it first", (await p.getByRole("button", { name: /Hear/i }).count()) === 0);

await p.getByRole("button", { name: /Skip this word/i }).click();
await p.getByRole("button", { name: /Next|Finish/i }).waitFor({ timeout: 30000 });
const feedback = await p.locator("main").innerText();
check("the child is acknowledged, not judged", /Got it/i.test(feedback), feedback.split("\n").slice(0, 3).join(" / "));
check(
  "no correct or incorrect verdict is shown",
  !/Correct!|Not quite|Nice reading/i.test(feedback),
  "neutral"
);
check("and the right word is not modelled for them", !/Hear it again/i.test(feedback), "no correction");

// Run out the rest of the round to reach the results screen. Finishing awaits a
// flush before the phase changes, so the loop waits for the results heading
// rather than reading the page the moment the last button is clicked — reading
// too early is how this assertion passed against the item screen.
const doneHeading = p.getByText(/All done/i);
for (let i = 0; i < 15; i++) {
  if (await doneHeading.count()) break;
  const next = p.getByRole("button", { name: /Next|Finish/i });
  if (!(await next.count())) break;
  await next.first().click();
  const skip = p.getByRole("button", { name: /Skip this word/i });
  if (await skip.count()) {
    await skip.click();
    await p.getByRole("button", { name: /Next|Finish/i }).waitFor({ timeout: 30000 });
  }
}
await doneHeading.waitFor({ timeout: 30000 });

const done = await p.locator("main").innerText();
check("the results screen avoids a score", !/\d+\/\d+/.test(done), done.split("\n").slice(0, 3).join(" / "));
check("and says a teacher will listen", /teacher will listen/i.test(done), "handoff explained");

await p.goto(`${BASE}/exercises`, { waitUntil: "networkidle" });
check(
  "once done, the probe rests instead of staying clickable",
  (await p.getByRole("link", { name: /Silly words/i }).count()) === 0 &&
    /Resting/i.test(await p.locator("main").innerText()),
  "cooldown in effect"
);

check("no page errors during the probe", pageErrors.length === 0, pageErrors.slice(0, 2).join(" | ") || "clean");

/* ── 9. a probe session must never read as eight failures ──────────────── */
section("[9] an unscored session is shown as a count, not as 0/n");

// The child above completed a probe run. Nothing about it has been marked, so
// its session row carries correct = 0 — which the generic "correct/total"
// rendering turned into "0/8" on the child's own dashboard.
await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
const dash = await p.locator("main").innerText();
check("the child's dashboard does not show 0/8 for the probe", !/0\/8/.test(dash), "no false zero");
check("it shows how many were read instead", /8 read/i.test(dash), "count shown");

const spCtx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
const spPage = await spCtx.newPage();
await spPage.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await spPage.fill("#email", "specialist@lexora.ph");
await spPage.fill("#password", PASSWORD);
await spPage.click("button[type=submit]");
await spPage.waitForURL("**/specialist", { timeout: 30000 });
await spPage.goto(`${BASE}/specialist/learner/${child.learnerId}`, { waitUntil: "networkidle" });
const spText = await spPage.locator("main").innerText();
check(
  "the specialist's session list does not show 0/8 either",
  !/pseudo probe · 0\/8/i.test(spText),
  "no false zero"
);

/* ── 10. probe words a specialist adds ─────────────────────────────────── */
section("[10] a specialist can author probe words");

const suggested = await json(`/api/words/suggest?stage=4&count=8`, { cookie: specialist });
check("suggestions are offered", suggested.status === 200 && suggested.body.candidates?.length > 0,
  `${suggested.body.candidates?.length ?? 0} candidates`);

const bankTexts = new Set(
  (await query(`SELECT text FROM "Word"`)).map((w) => w.text.toLowerCase())
);
check(
  "no suggestion duplicates a word already in the bank",
  (suggested.body.candidates ?? []).every((c) => !bankTexts.has(c.text)),
  "all new"
);
check(
  "every suggestion uses only letters taught by that stage",
  (suggested.body.candidates ?? []).every((c) => /^[msaioubetklyng]+$/.test(c.text)),
  (suggested.body.candidates ?? []).map((c) => c.text).join(", ")
);
check(
  "and its syllable split spells the word",
  (suggested.body.candidates ?? []).every((c) => c.syllables.split("-").join("") === c.text),
  "consistent"
);

const mine = "zt" + Array.from({ length: 4 }, () => "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)]).join("");
const added = await json("/api/words", {
  cookie: specialist,
  method: "POST",
  body: {
    text: mine,
    syllables: mine.slice(0, 2) + "-" + mine.slice(2),
    pattern: "CVCV",
    stage: 7,
    level: 1,
    isPseudo: true,
  },
});
check("a specialist can add a probe word", added.status === 201, `HTTP ${added.status}`);
if (added.body?.id) {
  const row = await one(
    `SELECT "isPseudo", "meaningEn", "audioWord" FROM "Word" WHERE id = $1`,
    [added.body.id]
  );
  check("it is stored as a probe word", row.isPseudo === true);
  check("with no gloss and no audio", row.meaningEn === null && row.audioWord === null, "silent");
  await query(`DELETE FROM "Word" WHERE id = $1`, [added.body.id]);
}

// The mistake that would silently break the probe: registering a real word.
const clash = await json("/api/words", {
  cookie: specialist,
  method: "POST",
  body: { text: "bahay", syllables: "ba-hay", pattern: "CVCVC", stage: 6, level: 2, isPseudo: true },
});
check(
  "a real word is refused as a probe word",
  clash.status === 409 && /already a real word/i.test(clash.body.error ?? ""),
  clash.body.error ?? `HTTP ${clash.status}`
);

/* ── 11. exports are named for what they contain ───────────────────────── */
section("[11] each CSV download is named for its type and its scope");

const named = async (path) => {
  const res = await api(path, { cookie: specialist });
  return res.headers.get("content-disposition") ?? "";
};
const allName = await named("/api/export?what=attempts");
const oneName = await named(`/api/export?what=attempts&learnerId=${child.learnerId}`);
const sessName = await named("/api/export?what=sessions");
check("a whole-cohort export says so", /attempts-all-learners-/.test(allName), allName);
check("a single-learner export carries the name", /attempts-auditbot-/.test(oneName), oneName);
check("and the type still varies", /sessions-all-learners-/.test(sessName), sessName);
check("the two attempt exports are named differently", allName !== oneName, "distinct");

/* ── 12. the specialist workspace follows the language toggle ──────────── */
section("[12] switching to Filipino changes the specialist pages too");

await spPage.goto(`${BASE}/specialist`, { waitUntil: "networkidle" });

/**
 * Press the toggle, then reload before reading the page.
 *
 * The toggle sets a cookie and calls router.refresh(). Whether that repaint has
 * landed at any given millisecond is timing, and asserting on it made this
 * section pass and fail on alternate runs against identical code — which is
 * worse than no test, because the flake looks exactly like the bug.
 *
 * What was actually broken, and what this checks, is different: these pages had
 * no Filipino strings at all and never received the language, so they rendered
 * in English no matter what the cookie said. Reloading separates that question
 * from refresh timing, which the learner-side suite already covers.
 */
const fil = spPage.getByRole("button", { name: "Filipino" }).first();
await fil.click();

const langCookie = (await spCtx.cookies()).find((c) => c.name === "lexora_lang");
check("the toggle records Filipino", langCookie?.value === "fil", langCookie?.value ?? "unset");

await spPage.reload({ waitUntil: "networkidle" });
const filText = await spPage.locator("main").innerText();
check(
  "the learners table is translated",
  /Mga mag-aaral ko/i.test(filText),
  filText.slice(0, 90).replace(/\n+/g, " | ")
);
check("and it is no longer the English heading", !/My learners/i.test(filText), "switched");

await spPage.goto(`${BASE}/specialist/learner/${child.learnerId}`, { waitUntil: "networkidle" });
const filLearner = await spPage.locator("main").innerText();
check(
  "the learner page header is translated",
  /Mga kontrol sa interbensyon/i.test(filLearner),
  "controls heading in Filipino"
);
check(
  "and the report inside it is too, which it never was before",
  /Kabuuang accuracy|Karaniwang oras kada salita/i.test(filLearner),
  "report follows the toggle"
);

await browser.close();

report("Decoding audit");
await endSuite();
