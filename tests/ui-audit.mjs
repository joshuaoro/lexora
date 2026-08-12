/**
 * Browser audit: complete learner journeys, specialist workflows, and a
 * responsive sweep. Uses Microsoft Edge via playwright-core (no browser
 * download needed on Windows).
 *
 *   npm run audit:ui                       # against localhost
 *   npm run audit:ui -- https://app.url    # against a deployment
 */
import { chromium } from "playwright-core";
import {
  BASE, passwordFor, check, section, report, one, query,
  createTestLearner, deleteTestLearner, endSuite,
} from "./helpers.mjs";

console.log(`UI audit against ${BASE}`);

const CHANNEL = process.env.AUDIT_BROWSER ?? "msedge";
const browser = await chromium.launch({
  channel: CHANNEL,
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const errors = [];

function watch(page, label) {
  page.on("pageerror", (e) => errors.push(`${label}: ${e}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${label}: ${m.text()}`));
}

async function signIn(page, email, landing) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", passwordFor(email));
  await page.click("button[type=submit]");
  await page.waitForURL(`**${landing}`, { timeout: 30000 });
}

/* ── 1. learner journeys ───────────────────────────────────────────────── */
const learner = await createTestLearner("ui");
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const p = await ctx.newPage();
watch(p, "learner");
await signIn(p, learner.email, "/dashboard");

section("[1] choice-based exercises play to completion");
for (const [slug, type, label] of [
  ["listen-choose", "LISTEN_CHOOSE", "listen & choose"],
  ["syllables", "SYLLABLES", "count the syllables"],
  ["rhyme", "RHYME", "rhyme time"],
]) {
  await p.goto(`${BASE}/exercises/${slug}`, { waitUntil: "networkidle" });
  await p.locator("button:has-text('Start!')").click();

  // Wait on real state rather than fixed sleeps: answer buttons disable while
  // the attempt is being scored, and a deployed server is far slower than a
  // local one, so any hard-coded delay is wrong on one of the two.
  const finished = p.locator("text=/Amazing!|Great work!|Good try!/");
  const advance = p.locator("button:has-text('Next word'), button:has-text('Finish')");
  const answerable = p.locator(
    "div.grid > button:not([disabled]), div.flex-wrap > button.h-20:not([disabled])"
  );

  for (let guard = 0; guard < 40; guard++) {
    if (await finished.count()) break;

    if (await advance.count()) {
      await advance.first().click();
      // the next item's options, or the results screen
      await Promise.race([
        answerable.first().waitFor({ state: "visible", timeout: 30000 }).catch(() => {}),
        finished.first().waitFor({ state: "visible", timeout: 30000 }).catch(() => {}),
      ]);
      continue;
    }

    await answerable.first().waitFor({ state: "visible", timeout: 30000 });
    await answerable.first().click();
    // scoring round-trip completes when the advance button appears
    await advance.first().waitFor({ state: "visible", timeout: 45000 });
  }

  const done = await p.locator("text=/Amazing!|Great work!|Good try!/").count();
  const saved = await one(
    `SELECT total, correct FROM "ActivitySession" WHERE "learnerId" = $1 AND type = $2 AND total > 0 LIMIT 1`,
    [learner.learnerId, type]
  );
  check(`${label}: reaches the results screen`, done > 0);
  check(`${label}: session recorded`, !!saved, saved ? `${saved.correct}/${saved.total}` : "none");
}

section("[2] display settings persist and apply to the Reader");
await p.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
await p.click("button:has-text('Atkinson Hyperlegible')");
await p.locator("input[type=range]").first().fill("48");
await p.click("button[aria-label='yellow']");
await p.click("button:has-text('Save settings')");
await p.waitForSelector("text=Saved", { timeout: 15000 });

const saved = JSON.parse(
  (await one(`SELECT settings FROM "LearnerProfile" WHERE id = $1`, [learner.learnerId])).settings || "{}"
);
check("saved to the database", saved.font === "atkinson" && saved.fontSize === 48 && saved.overlay === "yellow");

await p.goto(`${BASE}/reader`, { waitUntil: "networkidle" });
const style = await p.locator("p.wrap-break-word").first().evaluate((el) => {
  const cs = getComputedStyle(el);
  return { font: cs.fontFamily, size: cs.fontSize };
});
check("Reader uses the chosen font", /atkinson/i.test(style.font), style.font.split(",")[0]);
check("Reader uses the chosen size", style.size === "48px", style.size);
const overlay = await p.locator("div.relative.mt-5").first().evaluate((el) => getComputedStyle(el).backgroundColor);
check("Reader uses the colour overlay", overlay === "rgb(253, 246, 201)", overlay);

section("[3] Reader plays the stored Filipino audio");
// Wait for the actual response rather than guessing a duration.
// 206 Partial Content is also a success — the browser range-requests audio.
const clipResponse = p
  .waitForResponse((r) => r.url().includes("/api/word-audio/"), { timeout: 30000 })
  .catch(() => null);
await p.locator("p.wrap-break-word button").first().click();
const clip = await clipResponse;
check("a stored clip is streamed", clip !== null && [200, 206].includes(clip.status()),
  clip ? String(clip.status()) : "no request");

section("[4] language toggle");
await p.locator('button[aria-label="Filipino"]:visible').click();
const filipino = await p
  .locator("h1", { hasText: "Pagbasa" })
  .first()
  .waitFor({ state: "visible", timeout: 30000 })
  .then(() => true)
  .catch(() => false);
check("Reader switches to Filipino", filipino);
await p.locator('button[aria-label="English"]:visible').click();
await p.locator("h1", { hasText: "Reader" }).first().waitFor({ state: "visible", timeout: 30000 }).catch(() => {});

section("[5] sign out and route guards");
// The Reader saves its session a few seconds after the last word plays; wait
// for that PATCH so signing out does not race it.
await p
  .waitForResponse((r) => /\/api\/sessions\/[^/]+$/.test(r.url()) && r.request().method() === "PATCH", { timeout: 20000 })
  .catch(() => {});
await p.click("text=Sign out");
await p.waitForURL("**/login", { timeout: 20000 });
await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
check("protected pages redirect when signed out", p.url().includes("/login"));
await ctx.close();

/* ── 6. specialist workflows ───────────────────────────────────────────── */
section("[6] specialist workflows");
const sctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
const sp = await sctx.newPage();
watch(sp, "specialist");
await signIn(sp, "specialist@lexora.ph", "/specialist");

// Juan is a demo account, and demo accounts are excluded from the learners list
// by default now — their reading history is fabricated and must not reach a
// cohort figure. This suite uses Juan deliberately as a fixture, so it opts in.
await sp.goto(`${BASE}/specialist?demo=1`, { waitUntil: "networkidle" });
await sp.click("text=Juan");
await sp.waitForSelector("text=Scoring reliability check", { timeout: 20000 });
const juanId = sp.url().split("/").pop();
const before = await one(`SELECT level, stage FROM "LearnerProfile" WHERE id = $1`, [juanId]);
const levelBefore = before.level;

/** Poll the database until it reflects a UI action, or give up. */
async function waitForLevel(id, want, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const row = await one(`SELECT level FROM "LearnerProfile" WHERE id = $1`, [id]);
    if (row?.level === want) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

await sp.selectOption("select", "3");
check("level dropdown updates the learner", await waitForLevel(juanId, 3));
await sp.selectOption("select", String(levelBefore));
await waitForLevel(juanId, levelBefore);
// Raising the level widens the Marungko stage, and stage never shrinks by
// design — so restore it directly or the demo learner drifts on every run.
await query(`UPDATE "LearnerProfile" SET stage = $2 WHERE id = $1`, [juanId, before.stage]);

check("data-protection panel is present", (await sp.locator("text=Data protection").count()) === 1);

await sp.goto(`${BASE}/specialist/words`, { waitUntil: "networkidle" });
check("word bank shows accepted spellings", (await sp.locator("text=Accepted spellings").count()) === 1);
await sctx.close();

/* ── 7. responsive sweep ───────────────────────────────────────────────── */
section("[7] responsive sweep (phone, tablet, desktop)");
const PAGES = ["/dashboard", "/reader", "/exercises", "/practice", "/reports", "/settings"];
for (const [label, viewport, mobile] of [
  ["phone", { width: 390, height: 844 }, true],
  ["tablet", { width: 820, height: 1180 }, true],
  ["desktop", { width: 1440, height: 900 }, false],
]) {
  const rctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  const rp = await rctx.newPage();
  watch(rp, label);
  await signIn(rp, "learner1@lexora.ph", "/dashboard");
  let worst = 0;
  for (const path of PAGES) {
    await rp.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    // Fonts change text metrics, so measuring overflow before they land reads
    // the fallback face's widths rather than the ones a learner will see.
    await rp.evaluate(() => document.fonts.ready);
    worst = Math.max(
      worst,
      await rp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    );
  }
  check(`${label}: no horizontal overflow on ${PAGES.length} pages`, worst === 0, `${worst}px`);
  await rctx.close();
}

check("no uncaught console/page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
await deleteTestLearner(learner.email);
await endSuite();

report("UI audit");
