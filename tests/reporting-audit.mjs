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
  cleanupTestAccounts,
  until,
} from "./helpers.mjs";

console.log(`Reporting audit against ${BASE}`);

const cuid = (p) => `${p}${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;

const browser = await chromium.launch({
  channel: process.env.AUDIT_BROWSER ?? "msedge",
  headless: true,
  // A synthetic microphone, so the re-read can actually be taken in the audit.
  // It emits silence, which scores as no response — the point of the check is
  // where the row lands, not whether the reading was right.
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});

async function contextWithCookie(cookieHeader, opts = {}) {
  const ctx = await browser.newContext(opts);
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
async function insertAttempt(
  learnerId,
  { target, ms, correct = true, score = 1, ageMinutes = 0, isRetry = false }
) {
  await query(
    `INSERT INTO "Attempt"
       (id, "learnerId", "activityType", target, transcript, score, correct,
        "responseMs", "errorType", engine, "isRetry", "createdAt")
     VALUES ($1, $2, 'READ_ALOUD', $3, $3, $4, $5, $6, NULL, 'server', $8,
             NOW() - ($7 || ' minutes')::interval)`,
    [cuid("att"), learnerId, target, score, correct, ms, String(ageMinutes), isRetry]
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

  /* ── 4. retries never reach a measurement ───────────────────────────── */

  section("[4] a corrective re-read is recorded but never measured");

  // A fresh learner, so the arithmetic is unambiguous: two first readings, one
  // right and one wrong, is 50%. Piling on correct retries must not move it.
  const rl = await createTestLearner("retry");
  await insertAttempt(rl.learnerId, { target: "bata", ms: 3000, correct: true, ageMinutes: 30 });
  await insertAttempt(rl.learnerId, {
    target: "araw",
    ms: 3000,
    correct: false,
    score: 0.2,
    ageMinutes: 29,
  });

  const accuracyOf = async () => {
    const [row] = await query(
      `SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE correct)::int ok
         FROM "Attempt" WHERE "learnerId" = $1 AND "isRetry" = false`,
      [rl.learnerId]
    );
    return Math.round((row.ok / row.total) * 100);
  };
  check("accuracy starts at 50% over two first readings", (await accuracyOf()) === 50, "1/2");

  for (let i = 0; i < 6; i++) {
    await insertAttempt(rl.learnerId, {
      target: "araw",
      ms: 1200,
      correct: true,
      isRetry: true,
      ageMinutes: 28 - i,
    });
  }
  check("six correct retries leave measured accuracy at 50%", (await accuracyOf()) === 50, "still 1/2");

  const [stored] = await query(
    `SELECT COUNT(*)::int c FROM "Attempt" WHERE "learnerId" = $1 AND "isRetry" = true`,
    [rl.learnerId]
  );
  check("the retries are still recorded", stored.c === 6, `${stored.c} rows`);

  // The learner's own report must agree with the raw arithmetic.
  const rctx = await contextWithCookie(rl.cookie);
  const rpage = await rctx.newPage();
  await rpage.goto(`${BASE}/reports`, { waitUntil: "networkidle" });
  const reportText = await rpage.locator("body").innerText();
  check(
    "the learner's report shows 50%, not 87%",
    /\b50\s*%/.test(reportText) && !/\b87\s*%/.test(reportText),
    "retries excluded from the displayed accuracy"
  );
  await rctx.close();

  section("[4b] the child is actually offered the re-read");

  // The whole point of the feature is the closing step of the corrective
  // sequence. If the button never appears, the flag above is measuring nothing.
  const ui = await createTestLearner("retryui");
  const uctx = await contextWithCookie(ui.cookie, { permissions: ["microphone"] });
  const upage = await uctx.newPage();

  await upage.goto(`${BASE}/exercises/read-aloud`, { waitUntil: "networkidle" });
  await upage.getByRole("button", { name: /Start!/i }).click();
  const skip = upage.getByRole("button", { name: /Skip this word/i });
  await skip.waitFor({ timeout: 30000 });
  // Skipping counts as no response, which is a miss — the same path as a
  // misread word, without needing to synthesise speech.
  await skip.click();

  const sayIt = upage.getByRole("button", { name: /^Say it$/ });
  await sayIt.waitFor({ timeout: 45000 });
  const missText = await upage.locator("body").innerText();
  check("a missed word offers 'Now you try it!'", missText.includes("Now you try it!"), "");

  await sayIt.click();
  // The take runs to its own timeout on a silent device, then is scored, so the
  // row appears well after the click. Poll for it rather than sleeping past it.
  const uiRows = await until(
    async () => {
      const rows = await query(
        `SELECT correct, "isRetry" FROM "Attempt" WHERE "learnerId" = $1 ORDER BY "createdAt"`,
        [ui.learnerId]
      );
      return rows.length >= 2 ? rows : null;
    },
    { timeout: 60000 }
  );
  check(
    "the re-read is stored as a retry of the same word",
    uiRows?.length === 2 && uiRows[0].isRetry === false && uiRows[1].isRetry === true,
    JSON.stringify(uiRows ?? "timed out waiting for the retry row")
  );

  const afterRetry = await upage.locator("body").innerText();
  check(
    "the re-read does not advance the exercise",
    /1\/8/.test(afterRetry),
    "still on the first of eight words"
  );

  await uctx.close();
  await deleteTestLearner(ui.email);

  if (login.ok) {
    const specCookie = login.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");

    /* ── 5. study phase tagging ───────────────────────────────────────── */

    section("[5] sessions can be tagged for pre/post comparison");

    const sid = cuid("ses");
    await query(
      `INSERT INTO "ActivitySession" (id, "learnerId", type, correct, total, "createdAt")
       VALUES ($1, $2, 'READ_ALOUD', 6, 8, NOW() - interval '10 days')`,
      [sid, rl.learnerId]
    );

    const [fresh] = await query(`SELECT phase FROM "ActivitySession" WHERE id = $1`, [sid]);
    check("a new session defaults to REGULAR", fresh.phase === "REGULAR", fresh.phase);

    const tagged = await api(`/api/sessions/${sid}/phase`, {
      cookie: specCookie,
      method: "PATCH",
      body: { phase: "BASELINE" },
    });
    const [after] = await query(`SELECT phase FROM "ActivitySession" WHERE id = $1`, [sid]);
    check(
      "a specialist can tag it as the baseline",
      tagged.ok && after.phase === "BASELINE",
      `HTTP ${tagged.status} → ${after.phase}`
    );

    // Tagging decides what the paper compares, so a learner must not do it.
    const byLearner = await api(`/api/sessions/${sid}/phase`, {
      cookie: rl.cookie,
      method: "PATCH",
      body: { phase: "ENDLINE" },
    });
    const [unchanged] = await query(`SELECT phase FROM "ActivitySession" WHERE id = $1`, [sid]);
    check(
      "a learner cannot retag their own session",
      byLearner.status === 403 && unchanged.phase === "BASELINE",
      `HTTP ${byLearner.status}, phase still ${unchanged.phase}`
    );

    const bogus = await api(`/api/sessions/${sid}/phase`, {
      cookie: specCookie,
      method: "PATCH",
      body: { phase: "MIDLINE" },
    });
    check("an unknown phase is rejected", bogus.status === 400, `HTTP ${bogus.status}`);

    /* ── 6. both flags reach the export ───────────────────────────────── */

    section("[6] the export carries the flags the analysis needs");

    const csv = await (await api("/api/export?what=attempts", { cookie: specCookie })).text();
    const header = csv.split("\r\n")[0];
    check("attempts CSV has is_retry", header.includes("is_retry"), header.slice(-60));
    check("attempts CSV has study_phase", header.includes("study_phase"), header.slice(-60));

    const sessionsCsv = await (
      await api("/api/export?what=sessions", { cookie: specCookie })
    ).text();
    const sessionRow = sessionsCsv.split("\r\n").find((r) => r.includes(sid));
    check(
      "the tagged session exports as BASELINE",
      Boolean(sessionRow?.includes("BASELINE")),
      sessionRow?.slice(0, 80) ?? "(row not found)"
    );

    const summary = await (await api("/api/export?what=summary", { cookie: specCookie })).text();
    check(
      "summary CSV reports self-correction separately",
      summary.includes("retry_success_pct"),
      summary.split("\r\n")[0].slice(-60)
    );

    /* ── 7. the re-reads are audible somewhere ────────────────────────── */

    section("[7] self-correction recordings are reachable");

    // Retries are excluded from accuracy and from the reliability sample, which
    // left their audio stored but unplayable. It has its own panel now — audio
    // held for children and never listenable would be storage without purpose.
    const rid = cuid("att");
    await query(
      `INSERT INTO "Attempt"
         (id, "learnerId", "activityType", target, transcript, score, correct,
          "responseMs", engine, "isRetry", audio, "createdAt")
       VALUES ($1, $2, 'READ_ALOUD', 'zzcorrected', 'zzcorrected', 1, true,
               2500, 'server', true, 'data:audio/webm;base64,AAAA', NOW())`,
      [rid, id]
    );

    const spage2 = await (await contextWithCookie(specCookie)).newPage();
    await spage2.goto(`${BASE}/specialist/learner/${id}`, { waitUntil: "networkidle" });
    const panel2 = await panelText(spage2, "Self-correction");

    check("the self-correction panel is shown", panel2.length > 0, "section present");
    check("the re-read word is listed", panel2.includes("zzcorrected"), "");
    check(
      "the re-read has a play control",
      (await spage2.getByRole("button", { name: /Play the re-read of zzcorrected/i }).count()) > 0,
      "audio is reachable"
    );
    await spage2.context().close();

    /* ── 8. the cohort view ───────────────────────────────────────────── */

    section("[8] the cohort view compares every learner");

    const cpage = await (await contextWithCookie(specCookie)).newPage();
    await cpage.goto(`${BASE}/specialist/cohort`, { waitUntil: "networkidle" });
    const cohort = await cpage.locator("main").innerText();

    check("the cohort page loads", /Cohort overview/i.test(cohort), "");
    check(
      "it lists the pattern grid the group is compared on",
      /Accuracy by syllable pattern/i.test(cohort),
      ""
    );
    check(
      "a learner is reachable from it",
      (await cpage.getByRole("link", { name: "AuditBot" }).count()) > 0,
      "learner links present"
    );
    await cpage.context().close();
  }

  /* ── 9. recordings are retired on schedule ──────────────────────────── */

  section("[9] recordings past the retention window are dropped");

  const days = Number(process.env.RECORDING_RETENTION_DAYS ?? 180);
  const keeper = cuid("att");
  const expired = cuid("att");

  // One recording well inside the window, one well past it.
  for (const [attId, age] of [
    [keeper, Math.max(1, Math.floor(days / 2))],
    [expired, days + 30],
  ]) {
    await query(
      `INSERT INTO "Attempt"
         (id, "learnerId", "activityType", target, transcript, score, correct,
          "responseMs", engine, audio, "createdAt")
       VALUES ($1, $2, 'READ_ALOUD', 'zzretention', 'zzretention', 1, true, 2000,
               'server', 'data:audio/webm;base64,AAAA', NOW() - ($3 || ' days')::interval)`,
      [attId, rl.learnerId, String(age)]
    );
  }

  if (days === 0) {
    check("retention is switched off, so nothing is swept", true, "RECORDING_RETENTION_DAYS=0");
  } else {
    // Starting an activity triggers the sweep.
    await api("/api/sessions", {
      cookie: rl.cookie,
      method: "POST",
      body: { type: "READ_ALOUD" },
    });

    const [old] = await query(
      `SELECT audio, score, correct, transcript FROM "Attempt" WHERE id = $1`,
      [expired]
    );
    const [recent] = await query(`SELECT audio FROM "Attempt" WHERE id = $1`, [keeper]);

    check("an expired recording is deleted", old.audio === null, `${days + 30} days old`);
    check(
      "its score and transcript survive the deletion",
      old.score === 1 && old.correct === true && old.transcript === "zzretention",
      "no reported figure moves"
    );
    check(
      "a recording inside the window is kept",
      recent.audio !== null,
      `${Math.max(1, Math.floor(days / 2))} days old, window is ${days}`
    );
  }

  await deleteTestLearner(rl.email);
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
    // A suite that throws partway skips its own deletes and leaves throwaway
    // accounts in the study database. Sweeping here means a failed run cleans
    // up after itself instead of leaving the next person to notice.
    const removed = await cleanupTestAccounts().catch(() => 0);
    if (removed) console.log(`\nCleaned up ${removed} leftover test account(s).`);
    await closeDb();
  });
