/**
 * Performance audit against the minimum end-user device in the study's
 * hardware specification: a dual-core 2.0 GHz machine on a 5 Mbps connection.
 *
 * A slow first paint on the centre's actual laptops and tablets would show up
 * directly in the children's user-acceptance ratings, so this measures what
 * they would really experience rather than what a dev machine sees.
 *
 *   npm run audit:perf -- https://your-app.vercel.app
 */
import { chromium } from "playwright-core";
import { BASE, PASSWORD, check, section, report, closeDb } from "./helpers.mjs";

// Table 5 minimum: dual-core 2.0 GHz, 5 Mbps. 4x CPU throttling approximates a
// low-end dual-core against a modern development machine.
const CPU_THROTTLE = 4;
const DOWNLOAD_BPS = (5 * 1024 * 1024) / 8; // 5 Mbps
const UPLOAD_BPS = (1 * 1024 * 1024) / 8;
const LATENCY_MS = 40;

// Budgets chosen so a child is looking at content, not a blank screen.
const FCP_BUDGET = 3000;
const LCP_BUDGET = 4000;
const JS_BUDGET_KB = 400;

console.log(`Performance audit against ${BASE}`);
console.log(`Emulating ${CPU_THROTTLE}x CPU throttle, 5 Mbps, ${LATENCY_MS}ms latency\n`);

const browser = await chromium.launch({ channel: process.env.AUDIT_BROWSER ?? "msedge", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const page = await ctx.newPage();

/* sign in on an unthrottled connection so the measurements are of the pages */
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", "learner1@lexora.ph");
await page.fill("#password", PASSWORD);
await page.click("button[type=submit]");
await page.waitForURL("**/dashboard", { timeout: 30000 });

const cdp = await ctx.newCDPSession(page);

async function measure(path) {
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: LATENCY_MS,
    downloadThroughput: DOWNLOAD_BPS,
    uploadThroughput: UPLOAD_BPS,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_THROTTLE });

  await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 120000 });
  // let LCP settle
  await page.waitForTimeout(2500);

  // Resource Timing reports the real compressed bytes, which content-length
  // headers do not when the host streams a compressed response.
  const paint = await page.evaluate(() => {
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null;
    const lcpEntries = performance.getEntriesByType("largest-contentful-paint");
    const lcp = lcpEntries.length ? lcpEntries[lcpEntries.length - 1].startTime : null;
    const nav = performance.getEntriesByType("navigation")[0];

    const bytes = { total: nav?.transferSize ?? 0, js: 0, css: 0, font: 0, img: 0 };
    for (const r of performance.getEntriesByType("resource")) {
      const size = r.transferSize || r.encodedBodySize || 0;
      bytes.total += size;
      if (r.initiatorType === "script" || /\.js(\?|$)/.test(r.name)) bytes.js += size;
      else if (r.initiatorType === "css" || /\.css(\?|$)/.test(r.name)) bytes.css += size;
      else if (/\.(woff2?|ttf|otf)(\?|$)/.test(r.name)) bytes.font += size;
      else if (/\.(png|jpe?g|svg|webp|ico)(\?|$)/.test(r.name)) bytes.img += size;
    }
    const fonts = performance
      .getEntriesByType("resource")
      .filter((r) => /\.woff2?(\?|$)/.test(r.name)).length;

    return { fcp, lcp, load: nav?.loadEventEnd ?? null, bytes, fonts };
  });
  const bytes = paint.bytes;

  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
  });


  const kb = (n) => Math.round(n / 1024);
  return {
    path,
    fcp: Math.round(paint.fcp ?? 0),
    lcp: Math.round(paint.lcp ?? paint.fcp ?? 0),
    load: Math.round(paint.load ?? 0),
    totalKb: kb(bytes.total),
    jsKb: kb(bytes.js),
    cssKb: kb(bytes.css),
    fontKb: kb(bytes.font),
    fontFiles: paint.fonts,
  };
}

const PAGES = ["/login", "/dashboard", "/reader", "/exercises", "/exercises/read-aloud", "/reports"];
const rows = [];
for (const path of PAGES) rows.push(await measure(path));

console.log("  page                    FCP     LCP    load    total     JS    CSS   fonts  files");
console.log("  " + "-".repeat(83));
for (const r of rows) {
  console.log(
    `  ${r.path.padEnd(22)}${String(r.fcp + "ms").padStart(7)}${String(r.lcp + "ms").padStart(8)}` +
      `${String(r.load + "ms").padStart(8)}${String(r.totalKb + "KB").padStart(9)}` +
      `${String(r.jsKb + "KB").padStart(7)}${String(r.cssKb + "KB").padStart(7)}` +
      `${String(r.fontKb + "KB").padStart(8)}${String(r.fontFiles).padStart(7)}`
  );
}

section("\nbudgets on the minimum specified device");
const worstFcp = Math.max(...rows.map((r) => r.fcp));
const worstLcp = Math.max(...rows.map((r) => r.lcp));
const worstJs = Math.max(...rows.map((r) => r.jsKb));
const worstFont = Math.max(...rows.map((r) => r.fontKb));
check(`first contentful paint under ${FCP_BUDGET}ms everywhere`, worstFcp <= FCP_BUDGET, `worst ${worstFcp}ms`);
check(`largest contentful paint under ${LCP_BUDGET}ms everywhere`, worstLcp <= LCP_BUDGET, `worst ${worstLcp}ms`);
check(`JavaScript under ${JS_BUDGET_KB}KB per page`, worstJs <= JS_BUDGET_KB, `worst ${worstJs}KB`);
console.log(`       heaviest font payload on a single page: ${worstFont}KB`);

await browser.close();
await closeDb();
report("Performance audit");
