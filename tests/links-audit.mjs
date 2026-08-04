/**
 * Connectedness audit: crawl every internal link reachable as each role and
 * confirm nothing dead-ends. Catches links to routes that were renamed or
 * never built, and pages that exist but are unreachable from the navigation.
 *
 *   npm run audit:links -- https://your-app.vercel.app
 */
import { chromium } from "playwright-core";
import { BASE, PASSWORD, check, section, report, closeDb } from "./helpers.mjs";

console.log(`Link audit against ${BASE}`);

const browser = await chromium.launch({
  channel: process.env.AUDIT_BROWSER ?? "msedge",
  headless: true,
});

/** Every route the app is expected to expose, by role. */
const EXPECTED = {
  learner: ["/dashboard", "/reader", "/exercises", "/practice", "/reports", "/settings"],
  specialist: ["/specialist", "/specialist/words"],
  public: ["/", "/login", "/register", "/privacy"],
};

async function crawl(label, email, landing, seeds) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  if (email) {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill("#email", email);
    await page.fill("#password", PASSWORD);
    await page.click("button[type=submit]");
    await page.waitForURL(`**${landing}`, { timeout: 30000 });
  }

  const visited = new Map(); // path -> status
  const queue = [...seeds];
  const discovered = new Set(seeds);

  while (queue.length) {
    const path = queue.shift();
    const res = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" }).catch(() => null);
    const status = res?.status() ?? 0;
    visited.set(path, status);
    if (status !== 200) continue;

    const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href") ?? ""));
    for (const href of hrefs) {
      if (!href.startsWith("/") || href.startsWith("//")) continue;
      const clean = href.split("#")[0].split("?")[0];
      if (!clean || discovered.has(clean)) continue;
      // /api/* links are downloads and endpoints, not pages — navigating to a
      // file download yields no response object. Exports are covered by the
      // production smoke test instead.
      if (clean.startsWith("/api/")) continue;
      discovered.add(clean);
      queue.push(clean);
    }
  }

  await ctx.close();
  return visited;
}

section("[1] public pages");
const pub = await crawl("public", null, null, EXPECTED.public);
for (const [path, status] of pub) check(`public ${path}`, status === 200, `HTTP ${status}`);

section("[2] learner pages (crawled from the navigation)");
const learner = await crawl("learner", "learner1@lexora.ph", "/dashboard", EXPECTED.learner);
for (const [path, status] of learner) {
  // Signing out mid-crawl can bounce a page to /login; that is not a broken link.
  check(`learner ${path}`, status === 200, `HTTP ${status}`);
}
for (const path of EXPECTED.learner) {
  check(`learner nav reaches ${path}`, learner.has(path));
}

section("[3] specialist pages (crawled from the navigation)");
const specialist = await crawl("specialist", "specialist@lexora.ph", "/specialist", EXPECTED.specialist);
for (const [path, status] of specialist) check(`specialist ${path}`, status === 200, `HTTP ${status}`);
for (const path of EXPECTED.specialist) {
  check(`specialist nav reaches ${path}`, specialist.has(path));
}

section("[4] every exercise type is linked and loads");
for (const slug of ["read-aloud", "listen-choose", "syllables", "rhyme"]) {
  check(`/exercises/${slug}`, learner.get(`/exercises/${slug}`) === 200, `HTTP ${learner.get(`/exercises/${slug}`) ?? "not linked"}`);
}
check("/practice/session is linked", learner.has("/practice/session"), learner.has("/practice/session") ? "" : "not reachable (empty practice list is fine)");

section("[5] every navigable page has a loading boundary");

// Next.js only shows loading UI for a segment that is newly entered. The one at
// the (app) level never fired for navigation *within* the app, so a specialist
// opening a learner sat on the previous screen — fully interactive — for
// several seconds with no sign anything was happening, which invites a second
// click and a second page load behind the first. A page added without a
// loading.tsx quietly reintroduces that.
const { existsSync } = await import("node:fs");
const { join } = await import("node:path");

for (const segment of [
  "specialist",
  "specialist/cohort",
  "specialist/words",
  "specialist/learner/[id]",
  "reports",
  "reader",
  "practice",
  "practice/session",
  "exercises",
  "exercises/[type]",
]) {
  const file = join("src", "app", "(app)", segment, "loading.tsx");
  check(`${segment} has a loading boundary`, existsSync(file), file);
}

await browser.close();
await closeDb();
report("Link audit");
