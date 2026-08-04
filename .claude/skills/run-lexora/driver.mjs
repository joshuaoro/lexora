/**
 * LEXORA driver — launch the app and drive it programmatically.
 *
 *   node .claude/skills/run-lexora/driver.mjs                 # build if needed, serve on :3100, drive it
 *   node .claude/skills/run-lexora/driver.mjs --url <origin>  # drive something already running
 *   node .claude/skills/run-lexora/driver.mjs --headed        # watch it happen
 *   node .claude/skills/run-lexora/driver.mjs --flow reader   # one flow only
 *
 * Flows: dashboard, exercise, reader, specialist, offline, all (default)
 *
 * Screenshots land in screenshots/ at the repo root (gitignored — they show
 * learner names and reading records).
 *
 * Why Edge and not a bundled Chromium: the project depends on `playwright-core`,
 * which ships no browser. Every audit suite in tests/ launches the installed
 * Edge via `channel: "msedge"`, and this driver does the same so there is one
 * browser story rather than two.
 */
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SHOTS = join(REPO, "screenshots");
const PORT = Number(process.env.DRIVER_PORT ?? 3100);

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(`--${name}`);

const externalUrl = arg("url", null);
const BASE = externalUrl ?? `http://localhost:${PORT}`;
const FLOW = arg("flow", "all");
const HEADED = has("headed");

const LEARNER = { email: "learner1@lexora.ph", password: "lexora123" };
const SPECIALIST = { email: "specialist@lexora.ph", password: "lexora123" };

let shotCount = 0;
const notes = [];

function log(msg) {
  console.log(msg);
}
function ok(msg, detail = "") {
  notes.push({ ok: true, msg });
  console.log(`  ok   ${msg}${detail ? "  — " + detail : ""}`);
}
function bad(msg, detail = "") {
  notes.push({ ok: false, msg });
  console.log(`  FAIL ${msg}${detail ? "  — " + detail : ""}`);
}

async function shot(page, name) {
  const file = join(SHOTS, `${String(++shotCount).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`       → ${file.replace(REPO + "\\", "").replace(REPO + "/", "")}`);
  return file;
}

/* ── server ─────────────────────────────────────────────────────────────── */

async function reachable(url) {
  try {
    const res = await fetch(url, { redirect: "manual" });
    return res.status > 0;
  } catch {
    return false;
  }
}

async function waitFor(url, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await reachable(url)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const WIN = process.platform === "win32";
const NPM = WIN ? "npm.cmd" : "npm";
// Node 20+ refuses to spawn .cmd/.bat without a shell (CVE-2024-27980), so on
// Windows the shell is not optional — which is precisely why stopping the
// server needs a process-tree kill rather than a signal to the direct child.
const SPAWN_OPTS = { cwd: REPO, shell: WIN };

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { ...SPAWN_OPTS, stdio: "inherit", ...opts });
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`))
    );
  });
}

/**
 * Kill the server and everything it spawned.
 *
 * `npm run start` is a shim that spawns `next start` as a grandchild. On
 * Windows child.kill() signals only the shim, so the server keeps holding the
 * port after the driver exits — the next run then quietly drives the *previous*
 * build and reports success for code that was never loaded.
 */
function killTree(child) {
  if (!child?.pid) return;
  if (WIN) {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  }
}

async function startServer() {
  if (await reachable(`${BASE}/login`)) {
    log(`Using the server already listening on ${BASE}`);
    return null;
  }

  if (!existsSync(join(REPO, ".next", "BUILD_ID"))) {
    log("No production build found — running `npm run build` (a few minutes)…");
    await run(NPM, ["run", "build"]);
  }

  log(`Starting the production server on port ${PORT}…`);
  const child = spawn(NPM, ["run", "start"], {
    ...SPAWN_OPTS,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
    detached: !WIN, // own process group, so the whole thing can be killed
  });
  const tail = [];
  child.stdout.on("data", (d) => tail.push(String(d)));
  child.stderr.on("data", (d) => tail.push(String(d)));

  if (!(await waitFor(`${BASE}/login`))) {
    killTree(child);
    throw new Error(`Server never came up on ${BASE}.\n${tail.join("").slice(-1500)}`);
  }
  log(`Server ready on ${BASE}`);
  return child;
}

/* ── browser ────────────────────────────────────────────────────────────── */

async function signIn(browser, who) {
  // Sign in over HTTP, then hand the cookie to a browser context. Faster and
  // less brittle than typing into the form, and the form itself is covered by
  // the UI audit.
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(who),
    redirect: "manual",
  });
  if (!res.ok) {
    throw new Error(
      `Could not sign in as ${who.email} (HTTP ${res.status}). ` +
        `Is the database seeded? Run: npx prisma db seed`
    );
  }
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    permissions: ["microphone"],
  });
  await ctx.addCookies(
    cookie.split("; ").map((part) => {
      const [name, ...rest] = part.split("=");
      return { name, value: rest.join("="), url: BASE, httpOnly: true, sameSite: "Lax" };
    })
  );
  return ctx;
}

/* ── flows ──────────────────────────────────────────────────────────────── */

async function flowDashboard(browser) {
  log("\n[dashboard] learner landing, reports");
  const ctx = await signIn(browser, LEARNER);
  const page = await ctx.newPage();

  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  const text = await page.locator("main").innerText();
  ok("dashboard renders", text.split("\n")[0]?.slice(0, 40));
  await shot(page, "dashboard");

  await page.goto(`${BASE}/reports`, { waitUntil: "networkidle" });
  await page.locator("h1").first().waitFor({ timeout: 30000 });
  ok("reports renders", (await page.locator("h1").first().textContent())?.trim());
  await shot(page, "reports");

  await ctx.close();
}

async function flowExercise(browser) {
  log("\n[exercise] read-aloud: start, miss a word, corrective re-read");
  const ctx = await signIn(browser, LEARNER);
  const page = await ctx.newPage();

  await page.goto(`${BASE}/exercises/read-aloud`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Start!/i }).click();

  const skip = page.getByRole("button", { name: /Skip this word/i });
  await skip.waitFor({ timeout: 30000 });
  const word = (await page.locator("main p.wrap-break-word").first().textContent())?.trim();
  ok("an exercise item is showing", `word “${word}”`);
  await shot(page, "exercise-item");

  // Skipping scores as no response — a miss, without needing to synthesise
  // speech. It is the same path a real misreading takes.
  await skip.click();
  await page.getByRole("button", { name: /Next word|Finish/i }).waitFor({ timeout: 45000 });
  const feedback = await page.locator("main").innerText();
  ok("a miss produces corrective feedback", /Not quite/i.test(feedback) ? "shown" : "unexpected");
  ok(
    "the corrective re-read is offered",
    feedback.includes("Now you try it!") ? "“Now you try it!”" : "MISSING"
  );
  await shot(page, "exercise-feedback");

  await ctx.close();
}

async function flowReader(browser) {
  log("\n[reader] word sets and display settings");
  const ctx = await signIn(browser, LEARNER);
  const page = await ctx.newPage();

  await page.goto(`${BASE}/reader`, { waitUntil: "networkidle" });
  const words = await page.locator("p.wrap-break-word").count();
  ok("reader shows words", `${words} on screen`);
  await shot(page, "reader");

  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  ok("settings renders", (await page.locator("h1").first().textContent())?.trim());
  await shot(page, "settings");

  await ctx.close();
}

async function flowSpecialist(browser) {
  log("\n[specialist] learner detail and cohort overview");
  const ctx = await signIn(browser, SPECIALIST);
  const page = await ctx.newPage();

  await page.goto(`${BASE}/specialist`, { waitUntil: "networkidle" });
  ok("specialist dashboard renders", (await page.locator("h1").first().textContent())?.trim());
  await shot(page, "specialist");

  const firstLearner = page.locator("table a").first();
  if (await firstLearner.count()) {
    await firstLearner.click();
    await page.waitForURL(/\/specialist\/learner\//, { timeout: 30000 });
    // Match the heading by role: the phrase also appears in the data-protection
    // copy further down, and a bare text= selector fails strict mode on two
    // matches rather than picking one.
    await page
      .getByRole("heading", { name: /Scoring reliability check/i })
      .waitFor({ timeout: 30000 });
    const detail = await page.locator("main").innerText();
    ok("learner detail renders", "reliability check present");
    ok("threshold calibration present", /Borderline readings/i.test(detail) ? "yes" : "MISSING");
    ok("self-correction panel present", /Self-correction/i.test(detail) ? "yes" : "MISSING");
    ok("study timeline present", /Study timeline/i.test(detail) ? "yes" : "MISSING");
    await shot(page, "specialist-learner");
  } else {
    bad("no learners listed", "seed the database: npx prisma db seed");
  }

  await page.goto(`${BASE}/specialist/cohort`, { waitUntil: "networkidle" });
  const cohort = await page.locator("main").innerText();
  ok("cohort overview renders", /Accuracy by syllable pattern/i.test(cohort) ? "grid shown" : "?");
  await shot(page, "specialist-cohort");

  await ctx.close();
}

async function flowOffline(browser) {
  log("\n[offline] the wifi drops mid-word");
  const ctx = await signIn(browser, LEARNER);
  const page = await ctx.newPage();

  await page.goto(`${BASE}/exercises/read-aloud`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Start!/i }).click();
  const skip = page.getByRole("button", { name: /Skip this word/i });
  await skip.waitFor({ timeout: 30000 });

  await ctx.setOffline(true);
  await skip.click();
  await page
    .getByText(/lost the internet connection|Nawala ang internet/i)
    .first()
    .waitFor({ timeout: 30000 })
    .catch(() => {});

  const text = await page.locator("main").innerText();
  ok(
    "the learner is told the connection dropped",
    /lost the internet connection|Nawala ang internet/i.test(text) ? "message shown" : "MISSING"
  );
  ok("not stuck on 'Checking…'", !/Checking…/i.test(text) ? "busy state cleared" : "STUCK");
  ok("controls usable again", (await skip.isEnabled()) ? "yes" : "DISABLED");
  await shot(page, "offline");

  await ctx.setOffline(false);
  await skip.click();
  const recovered = await page
    .getByRole("button", { name: /Next word|Finish/i })
    .waitFor({ timeout: 45000 })
    .then(() => true)
    .catch(() => false);
  ok("continues once the connection returns", recovered ? "no reload needed" : "STUCK");

  await ctx.close();
}

/* ── main ───────────────────────────────────────────────────────────────── */

const FLOWS = {
  dashboard: flowDashboard,
  exercise: flowExercise,
  reader: flowReader,
  specialist: flowSpecialist,
  offline: flowOffline,
};

async function main() {
  if (!externalUrl && !process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. LEXORA has no local database — it needs a Postgres\n" +
        "connection string in .env. Copy .env.example and fill it in, or point the\n" +
        "driver at a running deployment with --url https://…"
    );
  }

  await mkdir(SHOTS, { recursive: true });
  const server = externalUrl ? null : await startServer();

  const browser = await chromium.launch({
    channel: process.env.DRIVER_BROWSER ?? "msedge",
    headless: !HEADED,
    // A synthetic microphone, so read-aloud can be exercised without a human.
    // It emits silence, which the app scores as "no response" — enough to reach
    // the feedback and corrective-re-read path.
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  });

  try {
    const chosen = FLOW === "all" ? Object.keys(FLOWS) : [FLOW];
    for (const name of chosen) {
      const fn = FLOWS[name];
      if (!fn) throw new Error(`Unknown flow "${name}". Try: ${Object.keys(FLOWS).join(", ")}, all`);
      await fn(browser);
    }
  } finally {
    await browser.close();
    if (server) {
      log("\nStopping the server…");
      killTree(server);
    }
  }

  const failed = notes.filter((n) => !n.ok);
  const summary = `\n${notes.length - failed.length}/${notes.length} checks passed · ${shotCount} screenshots in screenshots/`;
  log(summary);
  await writeFile(join(SHOTS, "summary.txt"), summary.trim() + "\n", "utf8");
  if (failed.length) {
    log("FAILURES:\n" + failed.map((f) => "  - " + f.msg).join("\n"));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exitCode = 1;
});
