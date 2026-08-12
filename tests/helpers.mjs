/**
 * Shared helpers for the LEXORA audit suites.
 *
 * The suites run against a live server — localhost or the deployed URL — and
 * assert against the database directly where a behaviour is only observable
 * there (adaptive level changes, cascade deletes, and so on).
 */
import "dotenv/config";
import pg from "pg";

export const BASE = process.env.AUDIT_BASE_URL ?? process.argv[2] ?? "http://localhost:3000";

/**
 * The password for throwaway accounts this suite creates and deletes.
 *
 * A fixed value is right here: these are `@lexora.test` rows that exist for the
 * length of one run and are swept on the way out. It is deliberately *not* used
 * for the seeded accounts any more — see below.
 */
export const PASSWORD = "lexora123";

/**
 * The seeded accounts' passwords, once they have been rotated.
 *
 * `lexora123` is published in this repository's git history, so the seeded
 * accounts have to move off it before any real child is enrolled. The moment
 * they do, every suite that signs in as one of them stops working — and fails at
 * its opening login with "Could not sign in — is the database seeded?", which
 * points at entirely the wrong cause and would cost an evening.
 *
 * Set AUDIT_SPECIALIST_PASSWORD (and AUDIT_DEMO_PASSWORD, if the demo learners
 * are rotated too) alongside the rotation and nothing else has to change.
 */
export const SPECIALIST_PASSWORD = process.env.AUDIT_SPECIALIST_PASSWORD ?? PASSWORD;
export const DEMO_PASSWORD = process.env.AUDIT_DEMO_PASSWORD ?? PASSWORD;

/**
 * Which password belongs to an account, worked out from its address.
 *
 * Resolving it here rather than at each call site is what keeps this from
 * rotting: a suite that signs someone in passes the email it already has, and a
 * new call site is correct without anyone remembering this distinction exists.
 */
export function passwordFor(email) {
  if (email === "specialist@lexora.ph") return SPECIALIST_PASSWORD;
  if (email?.endsWith("@lexora.ph")) return DEMO_PASSWORD; // learner1, learner2
  return PASSWORD; // @lexora.test, created by this suite
}

/* ── result collection ─────────────────────────────────────────────────── */

const results = [];

export function check(name, ok, detail = "") {
  results.push({ ok: Boolean(ok), name });
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${detail ? "  — " + detail : ""}`);
  return Boolean(ok);
}

export function section(title) {
  console.log(`\n${title}`);
}

/** Print the tally and set a non-zero exit code if anything failed. */
export function report(suiteName) {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${suiteName}: ${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log("FAILURES:\n" + failed.map((f) => "  - " + f.name).join("\n"));
    process.exitCode = 1;
  }
  return failed.length === 0;
}

/* ── HTTP ──────────────────────────────────────────────────────────────── */

export async function api(path, { cookie, method = "GET", body, headers } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  return res;
}

export async function json(path, opts) {
  const res = await api(path, opts);
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

/** Sign in and return the cookie header, or null when the credentials fail. */
export async function login(email, password = passwordFor(email)) {
  const res = await api("/api/auth/login", { method: "POST", body: { email, password } });
  if (!res.ok) return null;
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

/* ── database ──────────────────────────────────────────────────────────── */

let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("Set DATABASE_URL (and ideally DIRECT_URL) in .env to run the audits.");
    }
    pool = new pg.Pool({ connectionString, max: 2 });
  }
  return pool;
}

/** Run a query and return the rows. Identifiers are quoted (Prisma uses PascalCase). */
export async function query(sql, params = []) {
  const { rows } = await getPool().query(sql, params);
  return rows;
}

export async function one(sql, params = []) {
  return (await query(sql, params))[0];
}

export async function closeDb() {
  if (pool) await pool.end();
  pool = undefined;
}

/* ── waiting ───────────────────────────────────────────────────────────── */

/**
 * Poll until `probe` returns something truthy, or give up.
 *
 * For the cases a DOM wait cannot cover: a keepalive request sent as the page
 * unmounts lands in the database with no on-screen signal that it arrived. A
 * fixed sleep there is tuned to whichever machine it was written on — it passed
 * locally and failed against the deployment more than once — and, worse, an
 * assertion that runs before the write lands can pass for the wrong reason.
 *
 * Returns the probe's value, or null if the deadline passed.
 */
export async function until(probe, { timeout = 30000, interval = 500 } = {}) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = await probe();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await new Promise((r) => setTimeout(r, interval));
  }
}

/* ── fixtures ──────────────────────────────────────────────────────────── */

/** Register a throwaway learner and return { email, cookie, learnerId }. */
export async function createTestLearner(prefix = "audit") {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@lexora.test`;
  const res = await api("/api/auth/register", {
    method: "POST",
    body: { name: "AuditBot", email, password: PASSWORD, role: "LEARNER" },
  });
  if (!res.ok) throw new Error(`could not create test learner: HTTP ${res.status}`);
  const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const row = await one(
    `SELECT lp.id FROM "LearnerProfile" lp JOIN "User" u ON u.id = lp."userId" WHERE u.email = $1`,
    [email]
  );
  return { email, cookie, learnerId: row.id };
}

/** Remove a throwaway account and everything it owns. */
export async function deleteTestLearner(email) {
  await query(`DELETE FROM "User" WHERE email = $1`, [email]);
}

/** Safety net: never let a suite delete real study accounts. */
export async function cleanupTestAccounts() {
  const { rowCount } = await getPool().query(`DELETE FROM "User" WHERE email LIKE '%@lexora.test'`);
  return rowCount;
}

/**
 * End a suite: remove any throwaway accounts it left behind, then close the
 * pool.
 *
 * A suite that throws partway skips its own deletes, so the accounts stay in
 * the study database — which is how three of them came to be sitting in
 * production. Sweeping on the way out means a failed run tidies up after
 * itself rather than leaving it for whoever next reads the smoke test.
 *
 * Only ever touches @lexora.test addresses, so a real participant is never at
 * risk. Suites run one at a time, so a sweep cannot pull the rug from another.
 */
export async function endSuite() {
  const removed = await cleanupTestAccounts().catch(() => 0);
  if (removed) console.log(`\nCleaned up ${removed} leftover test account(s).`);
  await closeDb();
}
