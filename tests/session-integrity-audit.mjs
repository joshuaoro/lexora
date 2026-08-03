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

async function main() {
  /* ── 1. the language toggle must not change the words ────────────────── */

  section("[1] switching language mid-exercise keeps the same word");

  const learner = await createTestLearner("langswitch");
  const { ctx, page } = await pageFor(learner.cookie);

  await page.goto(`${BASE}/exercises/read-aloud`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Start!/i }).click();
  await page.waitForTimeout(1000);

  const before = await shownWord(page);
  check("a word is shown to read", before.length > 0, `“${before}”`);

  await page.getByRole("button", { name: "Filipino" }).click();
  await page.waitForTimeout(1500);
  const afterFil = await shownWord(page);
  check("the word is unchanged after switching to Filipino", afterFil === before, `“${afterFil}”`);
  check(
    "the interface did switch language",
    /Pindutin|Basahin|Laktawan/i.test(await page.locator("main").innerText()),
    "Filipino copy is showing"
  );

  await page.getByRole("button", { name: "English" }).click();
  await page.waitForTimeout(1500);
  const afterEn = await shownWord(page);
  check("the word is still unchanged after switching back", afterEn === before, `“${afterEn}”`);

  /* ── 2. the same, while feedback is on screen ────────────────────────── */

  section("[2] switching language while feedback is showing");

  // Skipping counts as no response — a miss, without synthesising speech.
  await page.getByRole("button", { name: /Skip this word/i }).click();
  await page.waitForTimeout(2500);

  const inFeedback = await page.locator("main").innerText();
  check("feedback is on screen", /Not quite/i.test(inFeedback), "missed the word");

  await page.getByRole("button", { name: "Filipino" }).click();
  await page.waitForTimeout(1500);

  const feedbackFil = await page.locator("main").innerText();
  const wordDuringFeedback = await shownWord(page);
  check(
    "the word under the feedback did not change",
    wordDuringFeedback === before || feedbackFil.includes(before),
    `“${wordDuringFeedback}” vs “${before}”`
  );
  check(
    "the feedback is still showing, now in Filipino",
    /Hindi tama|Muntik na|Subukan|Ngayon/i.test(feedbackFil),
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
  await qpage.waitForTimeout(1000);

  // Answer two of the eight words, then walk away to the dashboard.
  for (let i = 0; i < 2; i++) {
    await qpage.getByRole("button", { name: /Skip this word/i }).click();
    await qpage.waitForTimeout(2200);
    await qpage.getByRole("button", { name: /Next word/i }).click();
    await qpage.waitForTimeout(600);
  }
  await qpage.getByRole("link", { name: /^Dashboard$/ }).first().click();
  await qpage.waitForURL(/\/dashboard/, { timeout: 15000 });
  await qpage.waitForTimeout(2500);

  const partial = await one(
    `SELECT total, correct, "durationMs", "completedAt"
       FROM "ActivitySession" WHERE "learnerId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
    [quitter.learnerId]
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
  await qpage.waitForTimeout(800);

  for (let i = 0; i < 8; i++) {
    await qpage.locator("main button").filter({ hasText: /^[1-4]$/ }).first().click();
    await qpage.waitForTimeout(700);
    const done = qpage.getByRole("button", { name: /Finish/i });
    if (await done.isVisible().catch(() => false)) {
      await done.click();
      break;
    }
    await qpage.getByRole("button", { name: /Next word/i }).click();
    await qpage.waitForTimeout(400);
  }
  await qpage.waitForTimeout(2500);

  const finished = await one(
    `SELECT total, "completedAt" FROM "ActivitySession"
      WHERE "learnerId" = $1 AND type = 'SYLLABLES' ORDER BY "createdAt" DESC LIMIT 1`,
    [quitter.learnerId]
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

  report("Session-integrity audit");
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
