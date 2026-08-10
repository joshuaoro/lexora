/**
 * Accessibility audit (axe-core, WCAG 2.1 A + AA).
 *
 * This matters more here than in most apps: LEXORA's users are children with a
 * reading disability, and ISO/IEC 25010:2023 scores accessibility under the
 * Interaction Capability characteristic the reading specialists evaluate.
 *
 *   npm run audit:a11y -- https://your-app.vercel.app
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";
import { BASE, PASSWORD, check, section, report, closeDb } from "./helpers.mjs";

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

console.log(`Accessibility audit against ${BASE}`);

const browser = await chromium.launch({
  channel: process.env.AUDIT_BROWSER ?? "msedge",
  headless: true,
});

async function scan(page, label) {
  await page.addScriptTag({ content: axeSource });
  const result = await page.evaluate(async () =>
    // @ts-expect-error injected at runtime
    await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    })
  );
  const serious = result.violations.filter((v) => ["serious", "critical"].includes(v.impact));
  const minor = result.violations.filter((v) => !["serious", "critical"].includes(v.impact));

  check(
    `${label}: no serious or critical violations`,
    serious.length === 0,
    serious.length ? serious.map((v) => `${v.id}(${v.nodes.length})`).join(", ") : "clean"
  );
  if (minor.length) {
    console.log(`       minor: ${minor.map((v) => `${v.id}(${v.nodes.length})`).join(", ")}`);
  }
  return result.violations;
}

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const allViolations = [];

section("[1] public pages");
for (const path of ["/", "/login", "/register", "/privacy"]) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  allViolations.push(...(await scan(page, path)));
}

section("[2] learner pages");
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", "learner1@lexora.ph");
await page.fill("#password", PASSWORD);
await page.click("button[type=submit]");
await page.waitForURL("**/dashboard", { timeout: 30000 });

for (const path of ["/dashboard", "/reader", "/exercises", "/practice", "/reports", "/settings"]) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  allViolations.push(...(await scan(page, path)));
}

/**
 * The specialist workspace was never scanned, and it should have been.
 *
 * Reading specialists are the people who score this app against ISO/IEC 25010,
 * and accessibility sits under the Interaction Capability characteristic they
 * rate — so an AA failure on their own pages is both a real barrier and a mark
 * against the study's own instrument. Leaving these out found nothing for
 * months and then found 256 contrast failures on the word bank in one sweep:
 * a single dimmed class, repeated once per word.
 */
section("[3] specialist pages");
const sctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
const spage = await sctx.newPage();
await spage.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await spage.fill("#email", "specialist@lexora.ph");
await spage.fill("#password", PASSWORD);
await spage.click("button[type=submit]");
await spage.waitForURL("**/specialist", { timeout: 30000 });

// Demo learners are hidden by default; this scan wants any learner page at
// all, so it asks for them explicitly rather than silently skipping the route.
await spage.goto(`${BASE}/specialist?demo=1`, { waitUntil: "networkidle" });
const learnerHref = await spage
  .locator('a[href^="/specialist/learner/"]')
  .first()
  .getAttribute("href")
  .catch(() => null);

for (const path of [
  "/specialist",
  "/specialist/cohort",
  "/specialist/calibration",
  "/specialist/words",
  ...(learnerHref ? [learnerHref] : []),
]) {
  await spage.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  allViolations.push(...(await scan(spage, path)));
}
await sctx.close();

section("[4] an exercise in progress (the screen children use most)");
await page.goto(`${BASE}/exercises/listen-choose`, { waitUntil: "networkidle" });
await page.locator("button:has-text('Start!')").click();
await page
  .locator("div.grid > button:not([disabled])")
  .first()
  .waitFor({ state: "visible", timeout: 30000 });
allViolations.push(...(await scan(page, "/exercises/listen-choose (mid-exercise)")));

section("[5] keyboard-only navigation");
await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
const reachable = await page.evaluate(() => {
  const sel =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const els = [...document.querySelectorAll(sel)].filter((el) => {
    const s = getComputedStyle(el);
    return s.display !== "none" && s.visibility !== "hidden";
  });
  return els.length;
});
check("dashboard exposes focusable controls", reachable > 5, `${reachable} focusable`);

await page.keyboard.press("Tab");
const focusVisible = await page.evaluate(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const s = getComputedStyle(el);
  return { tag: el.tagName, outline: s.outlineWidth, style: s.outlineStyle };
});
check(
  "the first tab stop shows a visible focus ring",
  focusVisible !== null && focusVisible.outline !== "0px",
  focusVisible ? `${focusVisible.tag} outline ${focusVisible.outline}` : "nothing focused"
);

section("[6] reduced motion");
const reduced = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  reducedMotion: "reduce",
});
const rp = await reduced.newPage();
await rp.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await rp.fill("#email", "learner1@lexora.ph");
await rp.fill("#password", PASSWORD);
await rp.click("button[type=submit]");
await rp.waitForURL("**/dashboard", { timeout: 30000 });
// The reset uses the usual 0.01ms rather than 0s so that transitionend and
// animationend still fire; measure the real duration instead of the string.
const animating = await rp.evaluate(() => {
  const seconds = (v) =>
    Math.max(0, ...String(v).split(",").map((d) => (d.trim().endsWith("ms")
      ? parseFloat(d) / 1000
      : parseFloat(d) || 0)));
  const PERCEPTIBLE = 0.05; // 50ms — below this there is no perceived motion
  return [...document.querySelectorAll("*")].filter((el) => {
    const s = getComputedStyle(el);
    const anim = s.animationName !== "none" && seconds(s.animationDuration) > PERCEPTIBLE;
    const trans = s.transitionProperty !== "none" && seconds(s.transitionDuration) > PERCEPTIBLE;
    return anim || trans;
  }).length;
});
check(
  "animation is suppressed when the user asks for reduced motion",
  animating === 0,
  `${animating} element(s) still animate perceptibly`
);
await reduced.close();

await browser.close();
await closeDb();

/* summary of distinct rules broken, most impactful first */
const byRule = new Map();
for (const v of allViolations) {
  const prev = byRule.get(v.id) ?? { impact: v.impact, nodes: 0, help: v.help };
  prev.nodes += v.nodes.length;
  byRule.set(v.id, prev);
}
if (byRule.size) {
  console.log("\nDistinct rules broken:");
  [...byRule.entries()]
    .sort((a, b) => b[1].nodes - a[1].nodes)
    .forEach(([id, v]) => console.log(`  ${(v.impact ?? "?").padEnd(8)} ${id.padEnd(34)} ${v.nodes} node(s) — ${v.help}`));
}

report("Accessibility audit");
