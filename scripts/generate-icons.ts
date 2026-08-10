/**
 * Render the LEXORA mark to the raster sizes that need one.
 *
 *   npx tsx scripts/generate-icons.ts
 *
 * The browser tab is served the SVG directly, which stays crisp at any size.
 * The home-screen icon cannot be: Next.js only accepts jpg/jpeg/png for
 * `apple-icon`, and an apple-icon.svg is silently ignored — it 404s and no link
 * tag is emitted, so the tablet falls back to a screenshot of the page. Since
 * the study runs on tablets, and adding the app to the home screen is a
 * realistic thing for a specialist to do, that one is rendered to PNG here.
 *
 * Uses the same headless browser the audits use, so no image library is added
 * for a job done a handful of times.
 */
import { chromium } from "playwright-core";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const SOURCE = join("src", "app", "icon.svg");

/** Home-screen icons are masked and composited on an opaque tile by the OS. */
const TARGETS = [{ out: join("src", "app", "apple-icon.png"), size: 180, inset: 26 }];

async function main() {
  const svg = await readFile(SOURCE, "utf8");
  const browser = await chromium.launch({
    channel: process.env.AUDIT_BROWSER ?? "msedge",
    headless: true,
  });

  for (const { out, size, inset } of TARGETS) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });

    // The mark is inset and the tile filled edge to edge, because iOS applies
    // its own rounded mask and drops transparency — a mark drawn to the corners
    // would be clipped.
    const scale = (size - inset * 2) / 64;
    await page.setContent(
      `<style>html,body{margin:0;padding:0;background:#3d5a80;width:${size}px;height:${size}px;overflow:hidden}
       .m{position:absolute;left:${inset}px;top:${inset}px;transform:scale(${scale});transform-origin:0 0}</style>
       <div class="m">${svg.replace(/<rect[^>]*rx="16"[^>]*\/>/, "")}</div>`,
      { waitUntil: "load" }
    );

    await page.screenshot({ path: out, omitBackground: false });
    await page.close();
    const bytes = (await readFile(out)).length;
    console.log(`  ${out}  ${size}×${size}  ${Math.round(bytes / 1024)}KB`);
  }

  await browser.close();
  console.log("\nRe-run this after changing src/app/icon.svg.");
}

main().catch((err) => {
  console.error("Icon generation failed:", err);
  process.exit(1);
});
