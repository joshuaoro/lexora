/**
 * Reporting audit — decoding time, threshold calibration, session cleanup.
 *
 * These three features exist to support the paper rather than the child's
 * practice, so their correctness is a data-integrity question:
 *
 *  1. Decoding time reports how long a *correct* single-word reading takes.
 *     It must ignore implausible timings and refuse to report at all on a
 *     sample too small to mean anything — a median over three attempts would
 *     look authoritative and be noise.
 *  2. Threshold calibration surfaces readings that scored just below the
 *     acceptance line, so a specialist can hear whether the line is set right.
 *     If it silently showed the wrong band the calibration would be worthless.
 *  3. Abandoned sessions (opened, nothing attempted) must not survive to be
 *     counted as practice in the session totals the study reports.
 *
 * Rows are inserted directly because the timings and scores being asserted
 * cannot be produced reliably through the UI.
 *
 * The page assertions run in a browser and read the text of a specific section.
 * Searching the raw HTML instead would be unsound: a streamed Next.js response
 * interleaves rendered markup with the flight payload, so a word can appear in
 * one panel's props while being absent from another panel's markup — and "6.0"
 * turns up inside an icon's SVG path data.
 *
 *   npm run audit:reporting -- https://your-app.vercel.app
 */
import { chromium } from "playwright-core";
import {
  BASE,
  PASSWORD,
  api,
  check,
  section,
  report,
  closeDb,
  query,
  one,
  createTestLearner,
  deleteTestLearner,
} from "./helpers.mjs";

console.log(`Reporting audit against ${BASE}`);

const cuid = (p) => `${p}${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;

const browser = await chromium.launch({
  channel: process.env.AUDIT_BROWSER ?? "msedge",
  headless: true,
});

async function contextWithCookie(cookieHeader) {
  const ctx = await browser.newContext();
  await ctx.addCookies(
    cookieHeader.split("; ").map((part) => {
      const [name, ...rest] = part.split("=");
      return { name, value: rest.join("="), url: BASE, httpOnly: true, sameSite: "Lax" };
    })
  );
  return ctx;
}

/** Visible text of the panel whose heading matches, or "" when absent. */
async function panelText(page, heading) {
  const panel = page.locator("section", { hasText: heading }).last();
  return (await panel.count()) ? panel.innerText() : "";
}

/** Insert a scored oral reading. `ageMinutes` backdates it. */
async function insertAttempt(learnerId, { target, ms, correct = true, score = 1, ageMinutes = 0 }) {
  await query(
    `INSERT INTO "Attempt"
       (id, "learnerId", "activityType", target, transcript, score, correct,
        "responseMs", "errorType", engine, "createdAt")
     VALUES ($1, $2, 'READ_ALOUD', $3, $3, $4, $5, $6, NULL, 'server',
             NOW() - ($7 || ' minutes')::interval)`,
    [cuid("att"), learnerId, target, score, correct, ms, String(ageMinutes)]
  );
}

const DECODING_HEADING = "How long a correct word takes";
const BORDERLINE_HEADING = "Borderline readings";

async function main() {
  /* ── 1. decoding time ────────────────────────────────────────────────── */

  section("[1] decoding time");

  const learner = await createTestLearner("decoding");
  const id = learner.learnerId;
  const ctx = await contextWithCookie(learner.cookie);
  const page = await ctx.newPage();

  // Under five usable readings, no median should be reported. These four are
  // also the start of the slow "earlier" half below, so they must be slow.
  for (let i = 0; i < 4; i++) {
    await insertAttempt(id, { target: "bata", ms: 6000, ageMinutes: 100 - i });
  }
  await page.goto(`${BASE}/reports`, { waitUntil: "networkidle" });
  let text = await panelText(page, DECODING_HEADING);
  check(
    "no median is reported on a sample of four",
    /Needs a few more readings/i.test(text) && !/\d+\.\d+\s*s\b/.test(text),
    text.replace(/\s+/g, " ").slice(0, 90)
  );

  // Timings outside the plausible range are stopwatch artefacts, not decoding.
  await insertAttempt(id, { target: "bata", ms: 50, ageMinutes: 95 });
  await insertAttempt(id, { target: "bata", ms: 120000, ageMinutes: 94 });

  // Eight slow readings, then eight fast ones: the median of the earlier half
  // is 6.0s and of the later half 3.0s, so the trend must read 50% faster.
  for (let i = 0; i < 4; i++) {
    await insertAttempt(id, { target: "araw", ms: 6000, ageMinutes: 90 - i });
  }
  for (let i = 0; i < 4; i++) {
    await insertAttempt(id, { target: "araw", ms: 3000, ageMinutes: 40 - i });
  }
  for (let i = 0; i < 4; i++) {
    await insertAttempt(id, { target: "bata", ms: 3000, ageMinutes: 36 - i });
  }
  // Read correctly but well above the median — still being decoded, not known.
  await insertAttempt(id, { target: "paaralan", ms: 14000, ageMinutes: 30 });
  await insertAttempt(id, { target: "paaralan", ms: 15000, ageMinutes: 29 });
  // An incorrect reading must never count toward decoding time.
  await insertAttempt(id, { target: "kalabaw", ms: 30000, correct: false, score: 0.4, ageMinutes: 28 });

  await page.goto(`${BASE}/reports`, { waitUntil: "networkidle" });
  text = await panelText(page, DECODING_HEADING);

  check(
    "the median decoding time is reported",
    /\b6\.0\s*s\b/.test(text.replace(/\n/g, " ")),
    text.replace(/\s+/g, " ").slice(0, 90)
  );
  check(
    "the 50ms and 120s readings are excluded as implausible",
    /from 18 correct readings/i.test(text),
    "20 correct rows inserted, 18 usable"
  );
  check("the effortful word is listed", text.includes("paaralan"), "~2.4x the median");
  check(
    "an incorrect reading is not treated as decoding time",
    !text.includes("kalabaw"),
    "30s incorrect attempt excluded"
  );
  check(
    "speeding up is reported as a faster trend",
    /50% faster/i.test(text),
    "6.0s earlier vs 3.0s later"
  );

  await ctx.close();

  /* ── 2. threshold calibration ────────────────────────────────────────── */

  section("[2] threshold calibration");

  const threshold = Number(process.env.SCORE_THRESHOLD ?? 0.95);
  const band = 0.15;

  // Targets that appear nowhere else in the word bank, so finding one in the
  // panel proves the panel listed it rather than some other section.
  const nearMiss = "zzbanded";
  const farMiss = "zzoutside";
  await insertAttempt(id, {
    target: nearMiss,
    ms: 4000,
    correct: false,
    score: threshold - 0.05, // inside the band
    ageMinutes: 20,
  });
  await insertAttempt(id, {
    target: farMiss,
    ms: 4000,
    correct: false,
    score: threshold - band - 0.2, // clearly wrong, well outside the band
    ageMinutes: 19,
  });

  const login = await api("/api/auth/login", {
    method: "POST",
    body: { email: "specialist@lexora.ph", password: PASSWORD },
  });

  if (login.ok) {
    const specCookie = login.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    const sctx = await contextWithCookie(specCookie);
    const spage = await sctx.newPage();
    await spage.goto(`${BASE}/specialist/learner/${id}`, { waitUntil: "networkidle" });

    const panel = await panelText(spage, BORDERLINE_HEADING);

    check("the borderline panel is shown", panel.length > 0, "section present");
    check(
      "the active threshold is displayed",
      panel.includes(threshold.toFixed(2)),
      `threshold ${threshold.toFixed(2)}`
    );
    check(
      "a reading just below the line is listed",
      panel.includes(nearMiss),
      `scored ${(threshold - 0.05).toFixed(2)}`
    );
    check(
      "a clearly wrong reading is not listed as borderline",
      !panel.includes(farMiss),
      `scored ${(threshold - band - 0.2).toFixed(2)}, outside the band`
    );

    await sctx.close();
  } else {
    check("specialist half skipped (demo specialist not available)", true, "login failed");
  }

  /* ── 3. abandoned sessions ───────────────────────────────────────────── */

  section("[3] abandoned sessions are not counted as practice");

  const staleId = cuid("ses");
  const recentId = cuid("ses");
  const finishedId = cuid("ses");

  // Opened over an hour ago, nothing ever attempted.
  await query(
    `INSERT INTO "ActivitySession" (id, "learnerId", type, correct, total, "createdAt")
     VALUES ($1, $2, 'READ_ALOUD', 0, 0, NOW() - interval '3 hours')`,
    [staleId, id]
  );
  // Opened moments ago and still empty — the learner may be mid-exercise.
  await query(
    `INSERT INTO "ActivitySession" (id, "learnerId", type, correct, total, "createdAt")
     VALUES ($1, $2, 'READ_ALOUD', 0, 0, NOW() - interval '2 minutes')`,
    [recentId, id]
  );
  // A finished session must survive regardless of age.
  await query(
    `INSERT INTO "ActivitySession" (id, "learnerId", type, correct, total, "createdAt")
     VALUES ($1, $2, 'READ_ALOUD', 5, 8, NOW() - interval '5 hours')`,
    [finishedId, id]
  );

  // Starting a new session triggers the sweep.
  const started = await api("/api/sessions", {
    cookie: learner.cookie,
    method: "POST",
    body: { type: "READ_ALOUD" },
  });
  check("a new session can be started", started.ok, `HTTP ${started.status}`);

  const stale = await one(`SELECT id FROM "ActivitySession" WHERE id = $1`, [staleId]);
  const recent = await one(`SELECT id FROM "ActivitySession" WHERE id = $1`, [recentId]);
  const finished = await one(`SELECT id FROM "ActivitySession" WHERE id = $1`, [finishedId]);

  check("an abandoned empty session is swept", !stale, `${staleId} (3h old, 0/0)`);
  check("a session opened moments ago is left alone", Boolean(recent), `${recentId} (2m old, 0/0)`);
  check("a completed session is never swept", Boolean(finished), `${finishedId} (5h old, 5/8)`);

  await deleteTestLearner(learner.email);
  report("Reporting audit");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser.close();
    await closeDb();
  });
