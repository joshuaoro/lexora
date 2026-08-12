/**
 * Threshold-calibration audit.
 *
 * LEXORA does not fine-tune the acoustic model — Whisper is pre-trained and
 * called through an API. What it does adapt is the decision on top: the
 * similarity at which a transcript counts as a correct reading, fitted to the
 * verdicts reading specialists have recorded. These figures are destined for a
 * Validation chapter, so the arithmetic is checked twice — once against values
 * worked out by hand (scripts/check-calibration.ts), and once here by
 * recomputing every statistic from the exported confusion matrix with a second,
 * independent implementation.
 *
 *   npm run audit:calibration -- https://your-app.vercel.app
 */
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  BASE, passwordFor, api, json, login, check, section, report, one, query,
  createTestLearner, endSuite,
} from "./helpers.mjs";

console.log(`Calibration audit against ${BASE}`);

const specialist = await login("specialist@lexora.ph");
if (!specialist) {
  console.error("Could not sign in as specialist@lexora.ph — is the database seeded?");
  process.exit(1);
}

/* ── 1. the arithmetic, against values computed by hand ────────────────── */
section("[1] metric arithmetic (scripts/check-calibration.ts)");

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const arithmeticOk = await new Promise((resolve) => {
  const child = spawn("npx", ["tsx", "scripts/check-calibration.ts"], {
    cwd: repoRoot,
    shell: process.platform === "win32",
    stdio: "ignore",
  });
  child.on("close", (code) => resolve(code === 0));
  child.on("error", () => resolve(false));
});
check(
  "κ, MCC and the threshold replay match hand-computed values",
  arithmeticOk,
  arithmeticOk ? "20 checks" : "run `npm run calibration:check` to see which failed"
);

/* ── 2. the page ───────────────────────────────────────────────────────── */
section("[2] the calibration page");

const page = await api("/specialist/calibration", { cookie: specialist });
const html = await page.text();
check("a specialist can open it", page.status === 200, `HTTP ${page.status}`);
check("it explains what is and is not being adapted", /nothing\s+is fine-tuned/i.test(html), "stated");
check(
  "and says it will not move the threshold by itself",
  /never changes the setting/i.test(html),
  "stated"
);

const learner = await createTestLearner("calib");
const denied = await api("/specialist/calibration", { cookie: learner.cookie });
const deniedBody = await denied.text();
/**
 * Asserted on the body, not the status.
 *
 * A Next.js server-component redirect is streamed *inside* a 200 — the browser
 * is told to navigate by the payload, not by a 3xx. So `status !== 200` looks
 * like a security check and is really a check on a framework detail; it fails
 * on a page that is perfectly well guarded, and would pass on one that leaked
 * its contents behind a 200. What matters is that none of the cohort's figures
 * reach a learner.
 */
check(
  "a learner is redirected away rather than shown it",
  /\/dashboard/.test(deniedBody),
  `HTTP ${denied.status}, redirect in payload`
);
check(
  "and none of the calibration reaches them",
  !/Scoring threshold calibration|Matthews|Best by MCC/i.test(deniedBody),
  "no figures in the response"
);

const deniedCsv = await api("/api/export?what=calibration", { cookie: learner.cookie });
check("nor export it", deniedCsv.status === 403, `HTTP ${deniedCsv.status}`);

/* ── 3. the export, recomputed independently ───────────────────────────── */
section("[3] the exported sweep, checked against a second implementation");

const res = await api("/api/export?what=calibration", { cookie: specialist });
check("the calibration CSV downloads", res.ok, `HTTP ${res.status}`);
check(
  "named for what it is",
  /filename="lexora-calibration-all-learners-\d{4}-\d{2}-\d{2}\.csv"/.test(
    res.headers.get("content-disposition") ?? ""
  ),
  res.headers.get("content-disposition") ?? ""
);

const csv = (await res.text()).replace(/^﻿/, "");
const [headerLine, ...dataLines] = csv.trim().split("\r\n");
const cols = headerLine.split(",");
const rows = dataLines.map((line) => {
  const cells = line.split(",");
  return Object.fromEntries(cols.map((c, i) => [c, cells[i]]));
});

check("one row per candidate threshold", rows.length === 51, `${rows.length} rows`);
check(
  "spanning 0.50 to 1.00",
  rows[0].threshold === "0.50" && rows[rows.length - 1].threshold === "1.00",
  `${rows[0].threshold}–${rows[rows.length - 1].threshold}`
);

/**
 * Second implementation of the two statistics, written from the textbook
 * definitions rather than by importing the app's. Two independent versions
 * agreeing on every row is a far stronger check than either alone — a
 * transposed term would survive a single implementation and land in the paper.
 */
function kappaFrom(tp, fp, tn, fn) {
  const n = tp + fp + tn + fn;
  if (!n) return 0;
  const po = (tp + tn) / n;
  const pe = ((tp + fp) / n) * ((tp + fn) / n) + ((fn + tn) / n) * ((fp + tn) / n);
  return pe === 1 ? 0 : (po - pe) / (1 - pe);
}
function mccFrom(tp, fp, tn, fn) {
  const d = Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn));
  return d === 0 ? 0 : (tp * tn - fp * fn) / d;
}

let kappaMismatch = null;
let mccMismatch = null;
let youdenMismatch = null;
let countMismatch = null;

for (const r of rows) {
  const tp = +r.true_positive, fp = +r.false_positive;
  const tn = +r.true_negative, fn = +r.false_negative;

  if (tp + fp + tn + fn !== +r.n_reviewed && !countMismatch) {
    countMismatch = `t=${r.threshold}: ${tp + fp + tn + fn} vs n=${r.n_reviewed}`;
  }
  if (Math.abs(kappaFrom(tp, fp, tn, fn) - +r.cohens_kappa) > 5e-5 && !kappaMismatch) {
    kappaMismatch = `t=${r.threshold}: ${kappaFrom(tp, fp, tn, fn).toFixed(4)} vs ${r.cohens_kappa}`;
  }
  if (Math.abs(mccFrom(tp, fp, tn, fn) - +r.matthews_mcc) > 5e-5 && !mccMismatch) {
    mccMismatch = `t=${r.threshold}: ${mccFrom(tp, fp, tn, fn).toFixed(4)} vs ${r.matthews_mcc}`;
  }
  const sens = tp + fn === 0 ? 0 : tp / (tp + fn);
  const spec = tn + fp === 0 ? 0 : tn / (tn + fp);
  if (Math.abs(sens + spec - 1 - +r.youden_j) > 5e-5 && !youdenMismatch) {
    youdenMismatch = `t=${r.threshold}: ${(sens + spec - 1).toFixed(4)} vs ${r.youden_j}`;
  }
}

check("the confusion matrix sums to the sample size on every row", !countMismatch, countMismatch ?? "consistent");
check("Cohen's κ matches an independent implementation", !kappaMismatch, kappaMismatch ?? "all 51 rows agree");
check("MCC matches an independent implementation", !mccMismatch, mccMismatch ?? "all 51 rows agree");
check("Youden's J matches sensitivity + specificity − 1", !youdenMismatch, youdenMismatch ?? "all 51 rows agree");

// Acceptance can only loosen as the bar drops, so the count of accepted
// readings must never increase with the threshold. A break here would mean the
// replay is not monotonic — the clearest sign it has stopped mirroring the
// scorer.
let monotonic = true;
for (let i = 1; i < rows.length; i++) {
  const prev = +rows[i - 1].true_positive + +rows[i - 1].false_positive;
  const curr = +rows[i].true_positive + +rows[i].false_positive;
  if (curr > prev) monotonic = false;
}
check("raising the threshold never accepts more readings", monotonic, "monotonic");

const marked = rows.filter((r) => r.marker.includes("current"));
check("the threshold in force is marked", marked.length === 1, marked.map((r) => r.threshold).join(","));

/* ── 4. what it reports depends honestly on how much data there is ─────── */
section("[4] the sample-size guard");

const reviewed = await one(
  `SELECT COUNT(*)::int AS n
     FROM "Attempt" a
     JOIN "AttemptReview" r ON r."attemptId" = a.id
     LEFT JOIN "Word" w ON w.id = a."wordId"
    WHERE a."isRetry" = false
      AND a."activityType" IN ('READ_ALOUD','PRACTICE')
      AND COALESCE(w."isPseudo", false) = false`
);
const hasFit = rows.some((r) => r.marker.includes("best_mcc"));

if (reviewed.n >= 30) {
  check("with enough reviewed readings, an operating point is recommended", hasFit, `n=${reviewed.n}`);
  check(
    "and the page reports the fitted point rather than a bare number",
    /Best by MCC/i.test(html),
    "shown"
  );
} else {
  check("below the minimum, no operating point is recommended", !hasFit, `n=${reviewed.n}`);
  check(
    "and the page says how many more are needed",
    /Not enough reviewed readings/i.test(html),
    "shortfall shown"
  );
}

/* ── 5. it actually detects a threshold set too strictly ───────────────── */
section("[5] end to end: a too-strict threshold is found in the data");

/**
 * The scenario the feature exists for.
 *
 * Forty readings are recorded and reviewed. Twenty are read perfectly, ten are
 * nothing like the word, and ten are a single substituted vowel — "buhay" for
 * *bahay*, similarity exactly 0.80 — which the specialist listens to and judges
 * **correct**, because the child said the word properly and the recogniser
 * mis-spelled it.
 *
 * At the 0.95 in force those ten are scored as misreadings. The calibration
 * should see that and put the optimum at or below 0.80. Asserted directionally
 * rather than on an exact figure, because the cohort already holds a handful of
 * real reviewed readings and the point is the finding, not a float.
 */
const cal = await createTestLearner("calibfit");

const record = async (target, heard, agrees) => {
  const posted = await api("/api/attempts", {
    cookie: cal.cookie,
    method: "POST",
    body: { activityType: "READ_ALOUD", target, browserTranscript: heard, responseMs: 1500 },
  });
  const { id } = await posted.json().catch(() => ({}));
  if (!id) return false;
  const reviewed = await api("/api/reviews", {
    cookie: specialist,
    method: "POST",
    body: { attemptId: id, agrees },
  });
  return reviewed.ok;
};

let recorded = 0;
for (let i = 0; i < 20; i++) if (await record("bahay", "bahay", true)) recorded++;
for (let i = 0; i < 10; i++) if (await record("bahay", "zzzzz", true)) recorded++;
// The interesting ten: system says wrong, specialist disagrees.
for (let i = 0; i < 10; i++) if (await record("bahay", "buhay", false)) recorded++;
check("40 readings recorded and reviewed", recorded === 40, `${recorded}/40`);

const fitted = await (await api("/api/export?what=calibration", { cookie: specialist })).text();
const fitRows = fitted
  .replace(/^﻿/, "")
  .trim()
  .split("\r\n")
  .slice(1)
  .map((line) => {
    const c = line.split(",");
    return { threshold: +c[0], mcc: +c[11], marker: c[13] };
  });

const best = fitRows.find((r) => r.marker.includes("best_mcc"));
check("an operating point is now recommended", Boolean(best), best ? `${best.threshold}` : "none");
check(
  "and it sits at or below 0.80, where the disputed readings are accepted",
  Boolean(best) && best.threshold <= 0.8,
  best ? `best = ${best.threshold.toFixed(2)}` : "none"
);

const at80 = fitRows.find((r) => r.threshold === 0.8);
const at95 = fitRows.find((r) => r.threshold === 0.95);
check(
  "0.80 agrees with the specialists better than the 0.95 in force",
  at80.mcc > at95.mcc,
  `MCC ${at80.mcc.toFixed(3)} at 0.80 vs ${at95.mcc.toFixed(3)} at 0.95`
);

const fittedPage = await (await api("/specialist/calibration", { cookie: specialist })).text();
check("the page shows the fitted point", /Best by MCC/i.test(fittedPage), "shown");
check(
  "and reports the bootstrap interval rather than a bare number",
  /95% CI/i.test(fittedPage),
  "interval shown"
);

/* ── 6. demo learners stay out of every aggregate ──────────────────────── */
section("[6] fabricated demo history is excluded by default");

const demoCount = await one(`SELECT COUNT(*)::int AS n FROM "LearnerProfile" WHERE "isDemo"`);
check("the seeded demo learners are flagged", demoCount.n >= 2, `${demoCount.n} flagged`);

const rowsOf = async (path) => {
  const text = await (await api(path, { cookie: specialist })).text();
  return text.replace(/^﻿/, "").trim().split("\r\n").length - 1;
};
const summaryDefault = await rowsOf("/api/export?what=summary");
const summaryWithDemo = await rowsOf("/api/export?what=summary&includeDemo=true");
check(
  "the summary export omits them unless asked",
  summaryWithDemo > summaryDefault,
  `${summaryDefault} rows default, ${summaryWithDemo} with includeDemo=true`
);

const listDefault = await (await api("/specialist", { cookie: specialist })).text();
const listWithDemo = await (await api("/specialist?demo=1", { cookie: specialist })).text();
const demoName = (
  await one(
    `SELECT u.name FROM "LearnerProfile" lp JOIN "User" u ON u.id = lp."userId" WHERE lp."isDemo" LIMIT 1`
  )
)?.name;
check(
  "the learners list hides them by default",
  demoName ? !listDefault.includes(`>${demoName}<`) : true,
  demoName ?? "none"
);
check(
  "and shows them, badged, behind the toggle",
  demoName ? listWithDemo.includes(`>${demoName}<`) && /demo<\/span>/i.test(listWithDemo) : true,
  "badged"
);

/* ── 7. blind review actually removes the anchors ──────────────────────── */
section("[7] blind review hides the machine's answer until a verdict exists");

/**
 * Asserted on the response body, not on a class name.
 *
 * A panel hidden with CSS is still in the document, still readable, and still
 * anchoring — so a test that checks for `hidden` or `sr-only` would pass on an
 * implementation that fixes nothing. What matters is that the transcript, the
 * verdict and the similarity are not sent at all.
 */
const anchorLearner = await createTestLearner("blind");
const anchorWords = await query(
  `SELECT id, text FROM "Word" WHERE level = 1 AND NOT "isPseudo" ORDER BY text LIMIT 3`
);
for (const w of anchorWords) {
  await api("/api/attempts", {
    cookie: anchorLearner.cookie,
    method: "POST",
    body: { activityType: "READ_ALOUD", wordId: w.id, target: w.text, browserTranscript: "zzzz", responseMs: 1500 },
  });
}

const blindPage = await (
  await api(`/specialist/learner/${anchorLearner.learnerId}`, { cookie: specialist })
).text();
const count = (h, re) => (h.match(re) ?? []).length;
check(
  "the review list defaults to blind",
  /Blind review/.test(blindPage) && /hidden until you decide/.test(blindPage),
  "banner + prompt present"
);
check(
  "no verdict chip is sent for an unreviewed reading",
  count(blindPage, /system: /g) === 0,
  `${count(blindPage, /system: /g)} leaked`
);
check(
  "no transcript is sent",
  count(blindPage, /Heard:/g) === 0,
  `${count(blindPage, /Heard:/g)} leaked`
);
check(
  "no similarity score is sent",
  count(blindPage, /Similarity to the target word/g) === 0,
  `${count(blindPage, /Similarity to the target word/g)} leaked`
);
check(
  "but the recording is still playable and the opt-out is offered",
  /Switch to quick review/.test(blindPage),
  "deliberate opt-out present"
);

/**
 * The word must not run into the next one.
 *
 * This prompt is the only text in the app that interpolates a word mid-sentence
 * between two literal spaces, and it shipped reading "read talocorrectly" — the
 * space after the tag was dropped. Checked on rendered text rather than the
 * payload, because that is where the join is visible at all.
 */
const blindBrowser = await chromium.launch({
  channel: process.env.AUDIT_BROWSER ?? "msedge",
  headless: true,
});
const blindView = await blindBrowser.newPage();
await blindView.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await blindView.fill("#email", "specialist@lexora.ph");
await blindView.fill("#password", passwordFor("specialist@lexora.ph"));
await blindView.click("button[type=submit]");
await blindView.waitForURL("**/specialist", { timeout: 30000 });
await blindView.goto(`${BASE}/specialist/learner/${anchorLearner.learnerId}`, {
  waitUntil: "networkidle",
});
const promptText = await blindView
  .locator("text=/Play the recording/")
  .first()
  .innerText()
  .catch(() => "");
await blindBrowser.close();
check(
  "the target word is spaced away from the words either side of it",
  /learner read \S+ correctly\./.test(promptText),
  promptText.slice(0, 80) || "prompt not found"
);

/* ── 8. the verdict records how it was made, and what was heard ────────── */
section("[8] blind flag and observation tags round-trip");

const toJudge = await one(
  `SELECT id, correct FROM "Attempt" WHERE "learnerId" = $1 ORDER BY "createdAt" LIMIT 1`,
  [anchorLearner.learnerId]
);
const judged = await json("/api/reviews", {
  cookie: specialist,
  method: "POST",
  body: { attemptId: toJudge.id, agrees: true, blind: true, tags: ["vowel", "stress"] },
});
check("a blind verdict with tags is accepted", judged.status < 300, `HTTP ${judged.status}`);

const stored = await one(
  `SELECT r.blind, COUNT(t.id)::int AS tags
     FROM "AttemptReview" r LEFT JOIN "ReviewErrorTag" t ON t."reviewId" = r.id
    WHERE r."attemptId" = $1 GROUP BY r.blind`,
  [toJudge.id]
);
check("blind is recorded on the review", stored.blind === true);
check("both tags are stored", stored.tags === 2, `${stored.tags} tags`);

// Re-tagging must replace, not accumulate — otherwise unticking a chip is
// impossible and the distribution inflates with every edit.
await json("/api/reviews", {
  cookie: specialist,
  method: "POST",
  body: { attemptId: toJudge.id, agrees: true, blind: true, tags: ["vowel"] },
});
const afterRetag = await one(
  `SELECT COUNT(*)::int AS n FROM "ReviewErrorTag" t
     JOIN "AttemptReview" r ON r.id = t."reviewId" WHERE r."attemptId" = $1`,
  [toJudge.id]
);
check("re-tagging replaces rather than accumulates", afterRetag.n === 1, `${afterRetag.n} tags`);

// A verdict saved without a `tags` field must not wipe tags recorded earlier.
await json("/api/reviews", {
  cookie: specialist,
  method: "POST",
  body: { attemptId: toJudge.id, agrees: true, blind: true, note: "a later note" },
});
const afterNote = await one(
  `SELECT COUNT(*)::int AS n FROM "ReviewErrorTag" t
     JOIN "AttemptReview" r ON r.id = t."reviewId" WHERE r."attemptId" = $1`,
  [toJudge.id]
);
check("saving a note alone leaves tags untouched", afterNote.n === 1, `${afterNote.n} tags`);

/**
 * Tagging must not rewrite how the verdict was formed.
 *
 * The client saves the whole review again when a chip is pressed, and the first
 * version recomputed `blind` at that moment — by which point the verdict had
 * been revealed, so a blind judgement was silently rewritten as an anchored one.
 * Nothing on screen changes when that happens; it only shows up as a shrinking
 * blind population in the analysis, months later.
 *
 * Driven through the browser because the bug lived in the client's bookkeeping,
 * not in the route: posting the right value by hand would prove nothing.
 */
const provBrowser = await chromium.launch({
  channel: process.env.AUDIT_BROWSER ?? "msedge",
  headless: true,
});
const provPage = await provBrowser.newPage();
await provPage.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await provPage.fill("#email", "specialist@lexora.ph");
await provPage.fill("#password", passwordFor("specialist@lexora.ph"));
await provPage.click("button[type=submit]");
await provPage.waitForURL("**/specialist", { timeout: 30000 });
await provPage.goto(`${BASE}/specialist/learner/${anchorLearner.learnerId}`, {
  waitUntil: "networkidle",
});

/**
 * These readings were transcribed as "zzzz", so the system marked them
 * incorrect. Agreeing with it is therefore the verdict that means "the child
 * misread this" — and only a misreading offers the observation chips, since a
 * correct reading has nothing to categorise.
 */
const agreeBtn = provPage.getByRole("button", { name: /I agree with the system/ }).first();
await agreeBtn.click();
await provPage.waitForTimeout(1500);
const chip = provPage.getByRole("button", { name: "Vowel" }).first();
const tagged = (await chip.count()) > 0;
if (tagged) {
  await chip.click();
  await provPage.waitForTimeout(1500);
}
await provBrowser.close();

check("the observation chips appear once a misreading is recorded", tagged, tagged ? "shown" : "no chips");
if (tagged) {
  // One row, not an aggregate: grouping by `blind` would collapse every review
  // for this learner into two buckets and report a total rather than this one.
  const prov = await one(
    `SELECT r.blind, COUNT(t.id)::int AS tags
       FROM "AttemptReview" r
       JOIN "Attempt" a ON a.id = r."attemptId"
       LEFT JOIN "ReviewErrorTag" t ON t."reviewId" = r.id
      WHERE a."learnerId" = $1
      GROUP BY r.id, r.blind
      HAVING COUNT(t.id) > 0
      ORDER BY COUNT(t.id) DESC LIMIT 1`,
    [anchorLearner.learnerId]
  );
  check(
    "tagging a blind verdict leaves it recorded as blind",
    prov?.blind === true,
    `blind=${prov?.blind}, tags=${prov?.tags}`
  );
  check("and the tag was still saved", (prov?.tags ?? 0) >= 1, `${prov?.tags ?? 0} tag(s)`);
}

const unknown = await json("/api/reviews", {
  cookie: specialist,
  method: "POST",
  body: { attemptId: toJudge.id, agrees: true, tags: ["vowel", "not_a_real_category"] },
});
check("an unknown category is dropped, not stored", unknown.status < 300 && unknown.body.tags?.length === 1,
  JSON.stringify(unknown.body.tags));

/* ── 9. the two labelling conditions are reported apart ────────────────── */
section("[9] the calibration separates blind from anchored labels");

const calCsvHeaders = await (await api("/api/export?what=calibration", { cookie: specialist })).text();
check("the calibration export still parses", calCsvHeaders.includes("cohens_kappa"), "intact");

const calPage = await (await api("/specialist/calibration", { cookie: specialist })).text();
check(
  "the calibration page explains what is and is not adapted",
  /nothing\s+is fine-tuned/i.test(calPage),
  "stated"
);
check(
  "and reports the blind-versus-anchored comparison rather than only computing it",
  /Blind versus anchored judgements/i.test(calPage),
  "surfaced"
);

/**
 * Its own table, deliberately.
 *
 * These two rows were briefly appended to the threshold sweep and broke four
 * parsers in this very suite, because a table that is one-row-per-threshold
 * stops being that the moment it carries an annotation. The sweep is checked
 * above for exactly 51 rows; this checks the conditions are still reachable.
 */
const condRes = await api("/api/export?what=agreement-conditions", { cookie: specialist });
const condCsv = (await condRes.text()).replace(/^﻿/, "").trim().split("\r\n");
check("the condition split has its own export", condRes.ok, `HTTP ${condRes.status}`);
check(
  "with one row per condition and nothing else",
  condCsv.length === 3 && /^blind,/.test(condCsv[1]) && /^anchored,/.test(condCsv[2]),
  `${condCsv.length - 1} rows`
);
check(
  "carrying κ and MCC for each",
  /cohens_kappa,matthews_mcc$/.test(condCsv[0]),
  condCsv[0].split(",").slice(-2).join(",")
);
const condDenied = await api("/api/export?what=agreement-conditions", { cookie: learner.cookie });
check("and a learner cannot export it", condDenied.status === 403, `HTTP ${condDenied.status}`);

/* ── 10. decoding vs recall, compared like with like ───────────────────── */
section("[10] the divergence panel refuses to draw on too little");

const emptyStateHtml = blindPage;
check("the panel is present", /Decoding or memorisation/i.test(emptyStateHtml), "shown");
check(
  "and shows the empty state with its counts at this data volume",
  /Not enough reviewed readings yet/i.test(emptyStateHtml) && /one full probe run/i.test(emptyStateHtml),
  "thresholds explained"
);

/* ── 11. the IEP draft states rather than prescribes ───────────────────── */
section("[11] the IEP draft");

const iep = await api(`/api/export?what=iep&learnerId=${anchorLearner.learnerId}`, {
  cookie: specialist,
});
const iepText = await iep.text();
check("it downloads as plain text", iep.ok && /text\/plain/.test(iep.headers.get("content-type") ?? ""), `HTTP ${iep.status}`);
check("named as a .txt for pasting into a document", /filename="lexora-iep-[^"]+\.txt"/.test(iep.headers.get("content-disposition") ?? ""), iep.headers.get("content-disposition") ?? "");
check("it states the word-level scope", /Connected text, reading fluency/i.test(iepText), "delimitation stated");
check(
  "suggestions are labelled as the teacher's judgement, not instructions",
  /for the teacher's professional judgement/i.test(iepText) &&
    /not clinical recommendations/i.test(iepText),
  "framed as prompts"
);
check("it carries the disclaimer", /does not diagnose dyslexia/i.test(iepText), "present");
check(
  "the error profile is sourced from listening, not transcripts",
  /from specialist listening, not automatic scoring/i.test(iepText),
  "sourced"
);

const demoLearner = await one(`SELECT id FROM "LearnerProfile" WHERE "isDemo" LIMIT 1`);
if (demoLearner) {
  const refused = await api(`/api/export?what=iep&learnerId=${demoLearner.id}`, { cookie: specialist });
  check(
    "and it refuses a demo learner, whose history is fabricated",
    refused.status === 404,
    `HTTP ${refused.status}`
  );
}

/* ── 12. the divergence chart must not filter on `blind` ───────────────── */
section("[12] decoding vs recall draws on anchored labels too");

/**
 * The obvious wrong implementation is the one that silently shows nothing.
 *
 * `blind` says whether the *machine's* verdict was visible. This chart compares
 * two sets of *human* verdicts, so the machine is not a term in the comparison
 * and filtering to blind-only would empty the panel for no benefit — every
 * review recorded before blind mode existed is `blind = false`.
 *
 * So the fixture below is deliberately all-anchored. If someone later adds
 * `blind: true` to the query, this section fails instead of the panel quietly
 * going blank in production.
 */
const divLearner = await createTestLearner("diverge");
const realPool = await query(
  `SELECT id, text FROM "Word" WHERE level = 1 AND NOT "isPseudo" ORDER BY text LIMIT 10`
);
const probePool = await query(`SELECT id, text FROM "Word" WHERE "isPseudo" ORDER BY text LIMIT 8`);

const recordReviewed = async (word, activityType, heard, agrees) => {
  const posted = await api("/api/attempts", {
    cookie: divLearner.cookie,
    method: "POST",
    body: { activityType, wordId: word.id, target: word.text, browserTranscript: heard, responseMs: 1500 },
  });
  const { id } = await posted.json().catch(() => ({}));
  if (!id) return false;
  // blind: false throughout — the whole point of this fixture.
  const saved = await json("/api/reviews", {
    cookie: specialist,
    method: "POST",
    body: { attemptId: id, agrees, blind: false },
  });
  return saved.status < 300;
};

let seeded = 0;
// Real words read well: 9 of 10 judged correct.
for (let i = 0; i < realPool.length; i++) {
  const ok = await recordReviewed(realPool[i], "READ_ALOUD", realPool[i].text, i !== 0);
  if (ok) seeded++;
}
// Probe words read poorly: 2 of 8 judged correct — the memorisation signature.
for (let i = 0; i < probePool.length; i++) {
  const ok = await recordReviewed(probePool[i], "PSEUDO_PROBE", "zzzz", i < 2);
  if (ok) seeded++;
}
check("18 anchored reviews seeded on both sides", seeded === 18, `${seeded}/18`);

/**
 * Read in a browser, not from the response body.
 *
 * A server-component page is served as an RSC flight payload, and text built
 * from interpolated values — `({correct}/{n})` — is serialised as separate
 * array elements rather than as the string a person sees. Matching "(9/10)"
 * against that payload fails on a panel that renders it perfectly well. What is
 * being asserted here is what a specialist reads, so the assertion has to run
 * where the reading happens.
 *
 * (Section 7 above deliberately does the opposite and greps the payload: there
 * the claim is that the transcript and similarity are never *sent*, which is a
 * stronger property than not being displayed.)
 */
const divBrowser = await chromium.launch({
  channel: process.env.AUDIT_BROWSER ?? "msedge",
  headless: true,
});
const divPage = await divBrowser.newPage();
await divPage.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await divPage.fill("#email", "specialist@lexora.ph");
await divPage.fill("#password", passwordFor("specialist@lexora.ph"));
await divPage.click("button[type=submit]");
await divPage.waitForURL("**/specialist", { timeout: 30000 });
await divPage.goto(`${BASE}/specialist/learner/${divLearner.learnerId}`, {
  waitUntil: "networkidle",
});
const divText = await divPage.locator("main").innerText();
await divBrowser.close();

check(
  "the chart renders even though no label was blind",
  !/Not enough reviewed readings yet/.test(divText),
  "drew figures"
);
check(
  "it reports the counts beside the percentages",
  /\(\d+\/10\)/.test(divText) && /\(\d+\/8\)/.test(divText),
  divText.match(/\(\d+\/(?:10|8)\)/g)?.join(" ") ?? "no denominators"
);
check(
  "it warns that the sample is thin",
  /Fewer than 20 readings/.test(divText),
  "caution shown"
);
check(
  "and names differential anchoring rather than assuming it away",
  /Judged blind: 0\/10 real words, 0\/8 probe words/.test(divText) &&
    /anchoring could affect the two sides unequally/.test(divText),
  divText.match(/Judged blind: [^.]+/)?.[0] ?? "composition missing"
);

/* ── 13. self-correction is a behaviour, not an error ──────────────────── */
section("[13] self-correction is reported apart from the error categories");

const scAttempt = await one(
  `SELECT a.id FROM "Attempt" a JOIN "AttemptReview" r ON r."attemptId" = a.id
    WHERE a."learnerId" = $1 AND a.correct = false ORDER BY a."createdAt" LIMIT 1`,
  [divLearner.learnerId]
);
if (scAttempt) {
  await json("/api/reviews", {
    cookie: specialist,
    method: "POST",
    body: { attemptId: scAttempt.id, agrees: false, blind: false, tags: ["self_corrected"] },
  });
  const scIep = await (
    await api(`/api/export?what=iep&learnerId=${divLearner.learnerId}`, { cookie: specialist })
  ).text();
  check(
    "it is reported as a behaviour, in its own sentence",
    /self-corrected within the recording/i.test(scIep) &&
      /reading behaviour rather than an error/i.test(scIep),
    "separated"
  );
  check(
    "and never listed among the error categories",
    !/^\s*Self-corrected in the recording: \d+/m.test(scIep),
    "not counted as an error"
  );
  check(
    "coverage is stated with the distribution, never a bare count",
    /Categories were recorded for \d+ of \d+ reviewed misreadings \(\d+%\)/.test(scIep),
    "denominator present"
  );
}

/* ── 14. baseline against endline ──────────────────────────────────────── */
section("[14] the pre/post comparison the study is built on");

/**
 * A learner with a tagged baseline, a tagged endline, and one reading that
 * belongs to neither.
 *
 * The probe side is the point: real-word accuracy rising is ambiguous because
 * the bank can be learned by sight, and non-word accuracy rising is not. This
 * fixture makes both improve so the table has something to show, and deliberately
 * leaves one reading unattached to a session so the untagged path is exercised
 * rather than assumed.
 */
const phaseLearner = await createTestLearner("phases");
const phaseWords = await query(
  `SELECT id, text FROM "Word" WHERE level = 1 AND NOT "isPseudo" ORDER BY text LIMIT 12`
);
const phaseProbes = await query(`SELECT id, text FROM "Word" WHERE "isPseudo" ORDER BY text LIMIT 8`);

async function taggedSession(type, phase) {
  const started = await json("/api/sessions", {
    cookie: phaseLearner.cookie,
    method: "POST",
    body: { type },
  });
  const id = started.body?.id;
  if (id) {
    await api(`/api/sessions/${id}/phase`, {
      cookie: specialist,
      method: "PATCH",
      body: { phase },
    });
  }
  return id;
}

/**
 * `saidCorrect` is the specialist's own verdict, not the stored `agrees`.
 *
 * The column records agreement with the machine, so the two are inverses
 * whenever the machine said "incorrect" — which it does for every "zzzz"
 * reading here. Writing the intended verdict and converting once is the only
 * way to keep a fixture legible; passing `agrees` directly inverted the probe
 * result and read as a bug in the code rather than in the test.
 */
async function readInto(sessionId, word, activityType, heard, saidCorrect) {
  const posted = await api("/api/attempts", {
    cookie: phaseLearner.cookie,
    method: "POST",
    body: {
      ...(sessionId ? { sessionId } : {}),
      activityType,
      wordId: word.id,
      target: word.text,
      browserTranscript: heard,
      responseMs: activityType === "PSEUDO_PROBE" ? 3000 : 4000,
    },
  });
  const { id } = await posted.json().catch(() => ({}));
  if (id && saidCorrect !== undefined) {
    // Every reading here is transcribed "zzzz", so the machine's verdict is
    // always "incorrect": agreeing with it means the child misread.
    await json("/api/reviews", {
      cookie: specialist,
      method: "POST",
      body: { attemptId: id, agrees: !saidCorrect, blind: true },
    });
  }
  return Boolean(id);
}

// Baseline: 12 real words, 4 of 12 correct. Probe: 8 read, 2 judged correct.
const baseRead = await taggedSession("READ_ALOUD", "BASELINE");
for (let i = 0; i < 12; i++) {
  await readInto(baseRead, phaseWords[i], "READ_ALOUD", i < 4 ? phaseWords[i].text : "zzzz");
}
const baseProbe = await taggedSession("PSEUDO_PROBE", "BASELINE");
for (let i = 0; i < 8; i++) {
  await readInto(baseProbe, phaseProbes[i], "PSEUDO_PROBE", "zzzz", i < 2);
}

// Endline: 12 real words, 11 correct. Probe: 8 read, 6 judged correct.
const endRead = await taggedSession("READ_ALOUD", "ENDLINE");
for (let i = 0; i < 12; i++) {
  await readInto(endRead, phaseWords[i], "READ_ALOUD", i < 11 ? phaseWords[i].text : "zzzz");
}
const endProbe = await taggedSession("PSEUDO_PROBE", "ENDLINE");
for (let i = 0; i < 8; i++) {
  await readInto(endProbe, phaseProbes[i], "PSEUDO_PROBE", "zzzz", i < 6);
}

// One reading with no session at all — complete data, simply no phase.
await readInto(null, phaseWords[0], "READ_ALOUD", phaseWords[0].text);

const phaseCsv = (
  await (
    await api(`/api/export?what=phase-comparison&learnerId=${phaseLearner.learnerId}`, {
      cookie: specialist,
    })
  ).text()
)
  .replace(/^﻿/, "")
  .trim()
  .split("\r\n");
const phaseCols = phaseCsv[0].split(",");
const asRow = (line) => Object.fromEntries(phaseCols.map((c, i) => [c, line.split(",")[i]]));
const base = asRow(phaseCsv[1]);
const end = asRow(phaseCsv[2]);

check("the phase export is one row per compared phase", phaseCsv.length === 3, `${phaseCsv.length - 1} rows`);
check("baseline first, endline second", base.phase === "BASELINE" && end.phase === "ENDLINE");
check(
  "word accuracy is split by phase",
  base.accuracy_pct === "33" && end.accuracy_pct === "92",
  `${base.accuracy_pct}% → ${end.accuracy_pct}%`
);
check(
  "and so is the probe — the comparison the study turns on",
  base.probe_accuracy_pct === "25" && end.probe_accuracy_pct === "75",
  `${base.probe_accuracy_pct}% → ${end.probe_accuracy_pct}%`
);
check(
  "the unattached reading is counted, not absorbed into a phase",
  +base.untagged_readings === 1 && +end.untagged_readings === 1,
  `untagged=${base.untagged_readings}`
);
check(
  "and it is not silently added to either phase's total",
  +base.readings === 12 && +end.readings === 12,
  `${base.readings} / ${end.readings}`
);

const phaseBrowser = await chromium.launch({
  channel: process.env.AUDIT_BROWSER ?? "msedge",
  headless: true,
});
const phaseView = await phaseBrowser.newPage();
await phaseView.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await phaseView.fill("#email", "specialist@lexora.ph");
await phaseView.fill("#password", passwordFor("specialist@lexora.ph"));
await phaseView.click("button[type=submit]");
await phaseView.waitForURL("**/specialist", { timeout: 30000 });
await phaseView.goto(`${BASE}/specialist/learner/${phaseLearner.learnerId}`, {
  waitUntil: "networkidle",
});
const phaseText = await phaseView.locator("main").innerText();
await phaseBrowser.close();

check("the panel draws the comparison", /Baseline to endline/.test(phaseText), "shown");
check(
  "it reports no p-value, and says why",
  !/p\s*[=<]\s*0?\.\d/.test(phaseText) && /distinguishable from chance/i.test(phaseText),
  "descriptives only"
);

/**
 * The wording, asserted rather than intended.
 *
 * These readings are complete — score, transcript, timing all recorded — and
 * are counted in every other figure. Calling them errors or failures would tell
 * a specialist their child's session went wrong when nothing did. Copy that is
 * not checked drifts, so the neutral phrasing is a test.
 */
check(
  "unattached readings are described as not linked to a session",
  /not linked to\s+a session/i.test(phaseText),
  phaseText.match(/\d+ reading[^.]*not linked to\s+a session/i)?.[0]?.slice(0, 60) ?? "phrase missing"
);
// Scoped to the sentence itself, anchored on its own opening. Slicing from
// "not linked to" *to the end of the page* swept in everything below —
// including the report's own "Word-level error patterns" heading — so the check
// was judging text it was never meant to read.
const untaggedSentence =
  phaseText.match(
    /\d+ readings? (?:is|are) not linked to a session[\s\S]{0,400}?on this page\./i
  )?.[0] ?? "";
const forbidden = untaggedSentence.match(/\b(error|errors|failure|failures|invalid|bad)\b/gi);
check(
  "and never as errors, failures or invalid data",
  untaggedSentence !== "" && forbidden === null,
  untaggedSentence === ""
    ? "sentence not found"
    : forbidden
      ? `found: ${forbidden.join(", ")}`
      : "neutral"
);

/* ── 15. the language toggle reaches the whole workspace ───────────────── */
section("[15] Filipino covers the specialist workspace, not just its pages");

/**
 * The toggle used to change the pages and leave the components in English,
 * which reads as a broken control on exactly the screens the reading
 * specialists score for Interaction Capability. Type-checking guarantees no
 * dictionary key is missing; only a render proves the components use them.
 */
const filBrowser = await chromium.launch({
  channel: process.env.AUDIT_BROWSER ?? "msedge",
  headless: true,
});
const filCtx = await filBrowser.newContext();
const filPage = await filCtx.newPage();
await filPage.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await filPage.fill("#email", "specialist@lexora.ph");
await filPage.fill("#password", passwordFor("specialist@lexora.ph"));
await filPage.click("button[type=submit]");
await filPage.waitForURL("**/specialist", { timeout: 30000 });
await filPage.getByRole("button", { name: "Filipino" }).first().click();
await filPage.waitForTimeout(500);

// Deterministic: LIMIT 1 without ORDER BY picked a different learner run to
// run, and one of them has no reviewable readings, so the review list rendered
// its empty state and the check failed on nothing being wrong.
const anyLearner = await one(
  `SELECT lp.id FROM "LearnerProfile" lp
     JOIN "Attempt" a ON a."learnerId" = lp.id
    WHERE a."activityType" IN ('READ_ALOUD','PRACTICE') AND NOT a."isRetry"
    GROUP BY lp.id ORDER BY COUNT(a.id) DESC LIMIT 1`
);
await filPage.goto(`${BASE}/specialist/learner/${anyLearner.id}?demo=1`, {
  waitUntil: "networkidle",
});
const filLearnerText = await filPage.locator("main").innerText();
await filPage.goto(`${BASE}/specialist/cohort?demo=1`, { waitUntil: "networkidle" });
const filCohortText = await filPage.locator("main").innerText();
await filBrowser.close();

// One representative string per newly translated component.
for (const [component, fil, en] of [
  ["SessionPhases", "Timeline ng pag-aaral", "Study timeline"],
  ["ThresholdCalibration", "Mga borderline na pagbasa", "Borderline readings"],
  ["DivergencePanel", "Pagdedekowd ba o pagkabisado", "Decoding or memorisation"],
  ["PhaseComparison", "Baseline hanggang endline", "Baseline to endline"],
  // Not "Blind review": that phrase is deliberately identical in both
  // languages, so asserting on it would pass whatever the toggle did.
  ["ReviewList", "nakatago ang hatol ng sistema", "the system's verdict is hidden"],
]) {
  check(
    `${component} follows the toggle`,
    filLearnerText.includes(fil) && (en === null || !filLearnerText.includes(en)),
    filLearnerText.includes(fil) ? "in Filipino" : `still English: ${en}`
  );
}
check(
  "DemoToggle follows the toggle",
  /Itago ang demo data|Ipakita ang demo data/.test(filCohortText),
  "in Filipino"
);
check(
  "and the cohort page itself does too",
  filCohortText.includes("Pangkalahatang tanaw ng cohort") &&
    !filCohortText.includes("Cohort overview"),
  "in Filipino"
);

report("Calibration audit");
await endSuite();
