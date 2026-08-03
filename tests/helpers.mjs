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
export const PASSWORD = "lexora123";

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
export async function login(email, password = PASSWORD) {
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
    pool = new pg.Pool({ connectionString, max: 4 });
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
