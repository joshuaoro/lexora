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
  BASE, PASSWORD, check, section, report, one,
  createTestLearner, deleteTestLearner, closeDb,
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
  await page.fill("#password", PASSWORD);
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
  await p.waitForTimeout(900);

  // each item needs two passes: answer, then advance
  for (let guard = 0; guard < 60; guard++) {
    if (await p.locator("text=/Amazing!|Great work!|Good try!/").count()) break;
    const next = p.locator("button:has-text('Next word'), button:has-text('Finish')");
    if (await next.count()) {
      await next.first().click();
      await p.waitForTimeout(650);
      continue;
    }
    const options = p.locator("div.grid > button, div.flex-wrap > button.h-20");
    if (!(await options.count())) break;
    await options.first().click();
    await p.waitForTimeout(850);
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
const clips = [];
p.on("response", (r) => r.url().includes("/api/word-audio/") && clips.push(r.status()));
await p.locator("p.wrap-break-word button").first().click();
await p.waitForTimeout(2000);
// 206 Partial Content is also a success — the browser range-requests audio.
check("a stored clip is streamed", clips.length > 0 && [200, 206].includes(clips[0]), clips.join(", ") || "none");

section("[4] language toggle");
await p.locator('button[aria-label="Filipino"]:visible').click();
await p.waitForTimeout(1500);
check("Reader switches to Filipino", (await p.locator("h1").first().innerText()).trim() === "Pagbasa");
await p.locator('button[aria-label="English"]:visible').click();
await p.waitForTimeout(1200);

section("[5] sign out and route guards");
// Give the Reader's idle flush time to save the session before the cookie goes.
await p.waitForTimeout(7000);
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

await sp.click("text=Juan");
await sp.waitForSelector("text=Scoring reliability check", { timeout: 20000 });
const juanId = sp.url().split("/").pop();
const levelBefore = (await one(`SELECT level FROM "LearnerProfile" WHERE id = $1`, [juanId])).level;

await sp.selectOption("select", "3");
await sp.waitForTimeout(2000);
check("level dropdown updates the learner",
  (await one(`SELECT level FROM "LearnerProfile" WHERE id = $1`, [juanId])).level === 3);
await sp.selectOption("select", String(levelBefore));
await sp.waitForTimeout(1500);

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
    await rp.waitForTimeout(500);
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
await closeDb();

report("UI audit");
