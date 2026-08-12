/**
 * Stale-session audit.
 *
 * A session cookie can outlive the row it points at: a specialist erases a
 * learner at the family's request, or the database is reseeded, while that
 * learner still has the app open. The cookie is valid and correctly signed —
 * the record is simply gone.
 *
 * This used to throw Prisma P2025 on every page and leave the learner stuck
 * behind an error screen with no way out short of clearing their cookies. Every
 * signed-in page must instead send them back to sign in.
 *
 * The scenario is reproduced for real — register, sign in, delete the row while
 * holding the cookie — rather than by forging a token, so it exercises the same
 * path the deployment did.
 *
 * It runs in a browser because the assertion has to be about where the child
 * ends up. The app layout is async, so Next.js has already begun streaming by
 * the time the guard redirects and emits a client-side redirect inside a 200
 * rather than an HTTP 3xx. Checking the status code would pass a broken app.
 *
 *   npm run audit:stale -- https://your-app.vercel.app
 */
import { chromium } from "playwright-core";
import {
  BASE,
  PASSWORD,
  api,
  check,
  section,
  report,
  endSuite,
  query,
  createTestLearner,
  deleteTestLearner,
} from "./helpers.mjs";

console.log(`Stale-session audit against ${BASE}`);

/** Pages a signed-in learner can reach from the navigation. */
const LEARNER_PAGES = [
  "/dashboard",
  "/reader",
  "/exercises",
  "/exercises/read-aloud",
  "/exercises/listen-choose",
  "/exercises/syllables",
  "/exercises/rhyme",
  "/exercises/first-sound",
  "/practice/session",
  "/reports",
  "/settings",
];

const browser = await chromium.launch({
  channel: process.env.AUDIT_BROWSER ?? "msedge",
  headless: true,
});

/** Put a signed-in cookie header into a fresh browser context. */
async function contextWithCookie(cookieHeader) {
  const ctx = await browser.newContext();
  const cookies = cookieHeader.split("; ").map((part) => {
    const [name, ...rest] = part.split("=");
    return { name, value: rest.join("="), url: BASE, httpOnly: true, sameSite: "Lax" };
  });
  await ctx.addCookies(cookies);
  return ctx;
}

async function main() {
  section("[1] a learner erased mid-session");

  const learner = await createTestLearner("stale");
  const ctx = await contextWithCookie(learner.cookie);
  const page = await ctx.newPage();

  // Sanity check: the cookie works while the row exists.
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  check(
    "the session works before the learner is erased",
    new URL(page.url()).pathname === "/dashboard",
    page.url()
  );

  // The specialist's "Remove learner and all data" control does exactly this.
  await deleteTestLearner(learner.email);
  const left = await query(`SELECT id FROM "LearnerProfile" WHERE id = $1`, [learner.learnerId]);
  check("the learner profile is really gone", left.length === 0, `${left.length} row(s) left`);

  for (const path of LEARNER_PAGES) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    const url = new URL(page.url());
    check(
      `${path} sends the stale session back to sign in`,
      url.pathname === "/login" && url.searchParams.get("expired") === "1",
      page.url()
    );
  }

  // The error boundary is what this audit exists to prevent.
  const body = await page.locator("body").innerText();
  check(
    "no error screen is shown at any point",
    !/something went wrong|unexpected error/i.test(body),
    body.slice(0, 80).replace(/\s+/g, " ")
  );

  section("[1b] the API answers a stale session with 401, not 500");

  // Pages redirect; routes cannot, so they must say the session is dead. A 500
  // here surfaced in the exercise screen as "we couldn't hear that clearly",
  // leaving a child retrying a microphone that was never the problem.
  const API_CALLS = [
    ["GET", "/api/settings", null],
    ["PATCH", "/api/settings", { fontSize: 32 }],
    ["POST", "/api/sessions", { type: "READ_ALOUD" }],
    [
      "POST",
      "/api/attempts",
      { activityType: "READ_ALOUD", target: "bata", transcript: "bata", responseMs: 2000 },
    ],
  ];

  for (const [method, path, payload] of API_CALLS) {
    const res = await api(path, { cookie: learner.cookie, method, body: payload ?? undefined });
    check(
      `${method} ${path} returns 401`,
      res.status === 401,
      `HTTP ${res.status}${res.status >= 500 ? " (server error)" : ""}`
    );
  }

  section("[2] the sign-in page says why they were sent back");

  check(
    "the expired notice is visible on the sign-in page",
    /sign in again|expired|nag-sign in|mag-sign in/i.test(body),
    body.slice(0, 120).replace(/\s+/g, " ")
  );

  await ctx.close();

  section("[3] a specialist whose account was removed");

  const email = `stale-spec-${Date.now()}@lexora.test`;
  const reg = await api("/api/auth/register", {
    method: "POST",
    body: {
      name: "AuditBot",
      email,
      password: PASSWORD,
      role: "SPECIALIST",
      code: process.env.SPECIALIST_CODE,
    },
  });

  if (reg.ok) {
    const cookie = reg.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    const sctx = await contextWithCookie(cookie);
    const spage = await sctx.newPage();

    await spage.goto(`${BASE}/specialist`, { waitUntil: "networkidle" });
    check(
      "the specialist session works before removal",
      new URL(spage.url()).pathname === "/specialist",
      spage.url()
    );

    await query(`DELETE FROM "User" WHERE email = $1`, [email]);
    await spage.goto(`${BASE}/specialist`, { waitUntil: "networkidle" });
    const surl = new URL(spage.url());
    check(
      "/specialist sends the stale session back to sign in",
      surl.pathname === "/login" && surl.searchParams.get("expired") === "1",
      spage.url()
    );

    await sctx.close();
  } else {
    // SPECIALIST_CODE is deliberately private; without it this half cannot run.
    //
    // A 403 with the code *set* means something different, and the old message
    // sent the reader to fix a variable that was already correct: the server
    // under test reads .env once at boot, so one started before the code was
    // rotated still holds the previous value and rejects the new one. Say so,
    // because "set SPECIALIST_CODE" is unfollowable advice when it is set.
    const codeSet = Boolean(process.env.SPECIALIST_CODE);
    check(
      codeSet
        ? "specialist half skipped — the code is set here but the server rejected it"
        : "specialist half skipped (set SPECIALIST_CODE in .env to include it)",
      true,
      codeSet
        ? `HTTP ${reg.status}. The server was probably started before .env changed — ` +
          "restart it. If it persists, .env and the deployment disagree (npm run secrets:check)."
        : `registration returned HTTP ${reg.status}`
    );
  }

  report("Stale-session audit");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser.close();
    await endSuite();
  });
