/**
 * Session-integrity audit.
 *
 * Two faults that only appear once a learner does something ordinary partway
 * through an activity:
 *
 *  1. Switching the UI language mid-exercise. The toggle calls router.refresh(),
 *     which re-runs the server component; the words are picked at random per
 *     request, so a refresh dealt a different set into a component that stayed
 *     mounted. The run's state survived while the words changed underneath —
 *     feedback showing for a word no longer on screen, and the next answer
 *     recorded against a word the child never saw. Language belongs to the
 *     interface; the words belong to the run.
 *
 *  2. Leaving an exercise partway. Totals were written only on the final
 *     screen, so the minutes were discarded — the words and accuracy survived,
 *     because attempts save one by one, but the time did not. It now flushes on
 *     the way out, and marks the activity completed only when it really is.
 *
 * Both are checked in a browser, because both are about what survives a real
 * navigation.
 *
 *   npm run audit:integrity -- https://your-app.vercel.app
 */
import { chromium } from "playwright-core";
import {
  BASE,
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

console.log(`Session-integrity audit against ${BASE}`);

const browser = await chromium.launch({
  channel: process.env.AUDIT_BROWSER ?? "msedge",
  headless: true,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});

async function pageFor(cookieHeader) {
  const ctx = await browser.newContext({ permissions: ["microphone"] });
  await ctx.addCookies(
    cookieHeader.split("; ").map((part) => {
      const [name, ...rest] = part.split("=");
      return { name, value: rest.join("="), url: BASE, httpOnly: true, sameSite: "Lax" };
    })
  );
  return { ctx, page: await ctx.newPage() };
}

/** The big word currently on screen. */
async function shownWord(page) {
  return (await page.locator("main p.wrap-break-word").first().textContent())?.trim() ?? "";
}

/**
 * Switch the interface language and wait until the new copy is actually on
 * screen.
 *
 * The toggle triggers a server round-trip, so a fixed sleep is both flaky and
 * unsound: if it elapses before the refresh lands, "the word did not change" is
 * true only because nothing has happened yet, and the assertion passes without
 * testing anything. Waiting for the copy to change proves the refresh completed
 * — which is the moment the words were at risk of being swapped.
 */
async function switchLanguage(page, to) {
  const marker =
    to === "fil" ? /Pindutin|Basahin|Laktawan/i : /Press the mic|Read this word aloud|Skip this word/i;
  await page.getByRole("button", { name: to === "fil" ? "Filipino" : "English" }).click();
  await page.locator("main").getByText(marker).first().waitFor({ timeout: 30000 });
}

async function main() {
  /* ── 1. the language toggle must not change the words ────────────────── */

  section("[1] switching language mid-exercise keeps the same word");

  const learner = await createTestLearner("langswitch");
  const { ctx, page } = await pageFor(learner.cookie);

  await page.goto(`${BASE}/exercises/read-aloud`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Start!/i }).click();
  await page.getByRole("button", { name: /Skip this word/i }).waitFor({ timeout: 30000 });

  const before = await shownWord(page);
  check("a word is shown to read", before.length > 0, `“${before}”`);

  // The wait inside switchLanguage is the proof the refresh landed; the
  // assertion that follows is therefore about a real re-render, not a no-op.
  await switchLanguage(page, "fil");
  const afterFil = await shownWord(page);
  check("the word is unchanged after switching to Filipino", afterFil === before, `“${afterFil}”`);

  await switchLanguage(page, "en");
  const afterEn = await shownWord(page);
  check("the word is still unchanged after switching back", afterEn === before, `“${afterEn}”`);

  /* ── 2. the same, while feedback is on screen ────────────────────────── */

  section("[2] switching language while feedback is showing");

  // Skipping counts as no response — a miss, without synthesising speech.
  await page.getByRole("button", { name: /Skip this word/i }).click();
  await page.getByRole("button", { name: /Next word|Finish/i }).waitFor({ timeout: 45000 });

  const inFeedback = await page.locator("main").innerText();
  check("feedback is on screen", /Not quite/i.test(inFeedback), "missed the word");

  // In the feedback phase the word is shown as syllables, so wait on the
  // Filipino feedback copy rather than the item-phase prompts.
  await page.getByRole("button", { name: "Filipino" }).click();
  await page.locator("main").getByText(/Hindi pa tama|Ngayon, subukan mo/i).first().waitFor({
    timeout: 30000,
  });

  const feedbackFil = await page.locator("main").innerText();
  check(
    "the word under the feedback did not change",
    feedbackFil.includes(before),
    `looking for “${before}” in the feedback panel`
  );
  check(
    "the feedback is still showing, now in Filipino",
    /Hindi pa tama|Ngayon, subukan mo/i.test(feedbackFil),
    feedbackFil.replace(/\s+/g, " ").slice(0, 70)
  );

  await ctx.close();
  await deleteTestLearner(learner.email);

  /* ── 3. leaving partway still records the practice ───────────────────── */

  section("[3] leaving an exercise partway keeps the minutes");

  const quitter = await createTestLearner("partial");
  const { ctx: qctx, page: qpage } = await pageFor(quitter.cookie);

  await qpage.goto(`${BASE}/exercises/read-aloud`, { waitUntil: "networkidle" });
  await qpage.getByRole("button", { name: /Start!/i }).click();

  const skip = qpage.getByRole("button", { name: /Skip this word/i });
  const advance = qpage.getByRole("button", { name: /Next word|Finish/i });

  // Answer two of the eight words, then walk away to the dashboard.
  for (let i = 0; i < 2; i++) {
    await skip.waitFor({ timeout: 30000 });
    await skip.click();
    await advance.waitFor({ timeout: 45000 });
    await advance.click();
  }
  await qpage.getByRole("link", { name: /^Dashboard$/ }).first().click();
  await qpage.waitForURL(/\/dashboard/, { timeout: 15000 });

  // The flush goes out as the exercise unmounts, so there is nothing on screen
  // to wait for — poll until it lands rather than guessing how long it takes.
  const partial = await until(() =>
    one(
      `SELECT total, correct, "durationMs", "completedAt"
         FROM "ActivitySession"
        WHERE "learnerId" = $1 AND total > 0 ORDER BY "createdAt" DESC LIMIT 1`,
      [quitter.learnerId]
    )
  );

  check("the partial session recorded the words answered", partial?.total === 2, `total=${partial?.total}`);
  check(
    "the time spent was saved, not discarded",
    (partial?.durationMs ?? 0) > 0,
    `${partial?.durationMs}ms`
  );
  check(
    "the activity is not marked completed",
    partial?.completedAt === null,
    String(partial?.completedAt)
  );

  // The run above lasts seconds, which honestly rounds to zero minutes. To
  // check that partial sessions reach the dashboard at all, give this learner
  // one with real time on it — abandoned, so it must count towards minutes
  // practiced but not towards activities completed.
  await query(
    `INSERT INTO "ActivitySession"
       (id, "learnerId", type, correct, total, "durationMs", "createdAt", "completedAt")
     VALUES ($1, $2, 'READ_ALOUD', 3, 5, 420000, NOW() - interval '1 hour', NULL)`,
    [`ses${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`, quitter.learnerId]
  );

  await qpage.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  const dash = await qpage.locator("main").innerText();
  const readNumber = (label) => Number(dash.match(new RegExp(`(\\d+)\\s*\\n?\\s*${label}`, "i"))?.[1] ?? -1);

  check(
    "an abandoned session's minutes still reach the dashboard",
    readNumber("Minutes practiced") >= 7,
    `minutes reads ${readNumber("Minutes practiced")} (7 minutes abandoned)`
  );
  check(
    "an abandoned session is not counted as an activity completed",
    readNumber("Activities completed") === 0,
    `activities reads ${readNumber("Activities completed")}`
  );

  /* ── 4. finishing marks it completed ─────────────────────────────────── */

  section("[4] finishing an activity marks it completed");

  await qpage.goto(`${BASE}/exercises/syllables`, { waitUntil: "networkidle" });
  await qpage.getByRole("button", { name: /Start!/i }).click();

  const option = qpage.locator("main button").filter({ hasText: /^[1-4]$/ }).first();

  for (let i = 0; i < 8; i++) {
    await option.waitFor({ state: "visible", timeout: 30000 });
    await option.click();
    // Wait for the scoring round-trip to land rather than guessing at it: the
    // last item's button reads "Finish", not "Next word", and a fixed sleep
    // that expires before either appears sends the run after a button that
    // will never exist.
    await advance.waitFor({ state: "visible", timeout: 45000 });
    const label = (await advance.textContent()) ?? "";
    await advance.click();
    if (/Finish/i.test(label)) break;
  }

  await qpage.locator("text=/Amazing!|Great work!|Good try!/").first().waitFor({ timeout: 30000 });

  const finished = await until(() =>
    one(
      `SELECT total, "completedAt" FROM "ActivitySession"
        WHERE "learnerId" = $1 AND type = 'SYLLABLES' AND "completedAt" IS NOT NULL
        ORDER BY "createdAt" DESC LIMIT 1`,
      [quitter.learnerId]
    )
  );
  check("the finished activity is marked completed", Boolean(finished?.completedAt), String(finished?.completedAt));

  const counted = await one(
    `SELECT COUNT(*)::int c FROM "ActivitySession"
      WHERE "learnerId" = $1 AND "completedAt" IS NOT NULL`,
    [quitter.learnerId]
  );
  check(
    "only the finished one counts as an activity completed",
    counted.c === 1,
    `${counted.c} completed of 2 sessions`
  );

  await qctx.close();
  await deleteTestLearner(quitter.email);

  /* ── 5. a dropped connection mid-word ────────────────────────────────── */

  section("[5] the wifi drops in the middle of a word");

  // The study runs on school wifi and tablets, so this is an expected
  // condition. It used to leave the child staring at "Checking…" with every
  // control disabled, no message, and no recovery when the link came back —
  // the rejected fetch skipped the rest of the handler, so the busy flag was
  // never cleared. Only a page reload escaped, which a seven-year-old will not
  // think to do and which loses the session.
  const dropped = await createTestLearner("offline");
  const { ctx: octx, page: opage } = await pageFor(dropped.cookie);

  await opage.goto(`${BASE}/exercises/read-aloud`, { waitUntil: "networkidle" });
  await opage.getByRole("button", { name: /Start!/i }).click();
  const oskip = opage.getByRole("button", { name: /Skip this word/i });
  await oskip.waitFor({ timeout: 30000 });

  const pageErrors = [];
  opage.on("pageerror", (e) => pageErrors.push(String(e)));

  await octx.setOffline(true);
  await oskip.click();
  await opage
    .getByText(/lost the internet connection|Nawala ang internet/i)
    .first()
    .waitFor({ timeout: 30000 })
    .catch(() => {});

  const offlineText = await opage.locator("main").innerText();
  check(
    "the child is told the connection dropped",
    /lost the internet connection|Nawala ang internet/i.test(offlineText),
    offlineText.replace(/\s+/g, " ").slice(0, 80)
  );
  check(
    "the screen is not stuck on 'Checking…'",
    !/Checking…|Sinusuri/i.test(offlineText),
    "busy state cleared"
  );
  check(
    "the controls are usable again",
    await oskip.isEnabled(),
    "the learner can answer once the link is back"
  );
  check("no unhandled error is thrown", pageErrors.length === 0, pageErrors.slice(0, 1).join(" "));

  await octx.setOffline(false);
  await oskip.click();
  const recovered = await opage
    .getByRole("button", { name: /Next word|Finish/i })
    .waitFor({ timeout: 45000 })
    .then(() => true)
    .catch(() => false);
  check("the exercise carries on once the wifi returns", recovered, "no reload needed");

  await octx.close();
  await deleteTestLearner(dropped.email);

  report("Session-integrity audit");
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
