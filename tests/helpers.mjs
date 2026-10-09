/**
 * Shared helpers for the LEXORA audit suites.
 *
 * The suites run against a live server — localhost or the deployed URL — and
 * assert against the database directly where a behaviour is only observable
 * there (adaptive level changes, cascade deletes, and so on).
 */
import "dotenv/config";
import pg from "pg";
import { readFileSync } from "node:fs";

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

/** Sent with every learner registration; undefined (so omitted) when unset. */
export const ENROLMENT_CODE = process.env.ENROLMENT_CODE || undefined;

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

/**
 * One HTTP request to the app — retried if the host's firewall answered instead.
 *
 * A suite fires requests faster than any person, and Vercel's firewall
 * sometimes answers one with its own 403 challenge page
 * (`x-vercel-mitigated: challenge`) without the request reaching LEXORA. Read
 * as the app's answer, that is a false finding: on 8 October it failed the
 * calibration export ("HTTP 403") and crashed the suite on the empty CSV. A
 * challenged request never ran, so sending it again is safe whatever the
 * method; a pause usually lets it through.
 */
export async function api(path, { cookie, method = "GET", body, headers } = {}) {
  for (let attempt = 1; ; attempt++) {
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
    if (!res.headers.get("x-vercel-mitigated") || attempt === 3) return res;
    await res.body?.cancel();
    await new Promise((r) => setTimeout(r, 5000 * attempt));
  }
}

export async function json(path, opts) {
  const res = await api(path, opts);
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

/** Sign in and return the cookie header, or null when the credentials fail. */
/**
 * Sign in as the specialist, or explain accurately why it failed and stop.
 *
 * Every suite starts here, and the message this prints is the first thing anyone
 * sees when the suite breaks — so it has to name the real cause. It used to say
 * "is the database seeded?", which was true when the only way to fail was an
 * empty database. Once the seeded password was rotated off the published
 * `lexora123`, that message sent the reader to reseed a database that was
 * perfectly fine — and reseeding wipes every table, so the advice was not merely
 * unhelpful but destructive.
 *
 * The fix is to tell the difference. If the account exists, the password is
 * wrong; if it does not, the database really is unseeded.
 */
export async function requireSpecialistLogin() {
  const cookie = await login("specialist@lexora.ph");
  if (cookie) return cookie;

  // Distinguish "wrong password" from "no such account" — a login route answers
  // 401 to both, on purpose, so ask the database instead.
  let exists = null;
  try {
    exists = Boolean(await one(`SELECT id FROM "User" WHERE email = 'specialist@lexora.ph'`));
  } catch {
    /* no DIRECT_URL, or unreachable — fall through to the generic advice */
  }

  console.error("\nCould not sign in as specialist@lexora.ph.\n");
  if (exists === true) {
    console.error(
      "The account exists, so the password is what does not match.\n" +
        (process.env.AUDIT_SPECIALIST_PASSWORD
          ? "AUDIT_SPECIALIST_PASSWORD is set but is not this account's password.\n"
          : "AUDIT_SPECIALIST_PASSWORD is not set, so the suite tried the default `lexora123`.\n" +
            "If the password has been rotated with `npm run password:set`, put the new\n" +
            "value in AUDIT_SPECIALIST_PASSWORD in .env.\n") +
        "\nDo NOT reseed. `prisma db seed` wipes every table, including study data."
    );
  } else if (exists === false) {
    console.error("No such account in the database — this one really does need seeding.");
  } else {
    console.error(
      "Could not reach the database to tell whether the account exists.\n" +
        "Check DIRECT_URL, then AUDIT_SPECIALIST_PASSWORD."
    );
  }
  await closeDb().catch(() => {});
  process.exit(1);
}

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
    // Encrypted and verified, as the app is: the certificate is read out of
    // src/lib/db-ssl.ts so there is one copy of it.
    const host = new URL(connectionString.replace(/^postgres(ql)?:/, "http:")).hostname;
    const ca = /\.supabase\.(com|co)$/.test(host)
      ? readFileSync(new URL("../src/lib/db-ssl.ts", import.meta.url), "utf8").match(
          /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/
        )?.[0]
      : undefined;
    pool = new pg.Pool({
      connectionString,
      max: 2,
      ssl: ca ? { ca, rejectUnauthorized: true } : undefined,
    });
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
    // ENROLMENT_CODE gates learner registration when the server has it set.
    body: { name: "AuditBot", email, password: PASSWORD, role: "LEARNER", code: ENROLMENT_CODE },
  });
  let cookie;
  if (res.ok) {
    cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  } else if (res.status === 403 && !ENROLMENT_CODE) {
    // The deployment gates learner registration with an enrolment code this
    // machine does not hold — rightly: it is the reading centre's, and set on
    // Vercel only. The throwaway learner is then made the way registration
    // makes one (a user and an empty learner profile; the database supplies
    // every default) and signs in through the real login route, so everything
    // after this point is tested exactly as before.
    const { default: bcrypt } = await import("bcryptjs");
    const id = `audit${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    await query(
      `INSERT INTO "User" (id, email, password, name, role) VALUES ($1, $2, $3, 'AuditBot', 'LEARNER')`,
      [id, email, await bcrypt.hash(PASSWORD, 10)]
    );
    await query(`INSERT INTO "LearnerProfile" (id, "userId") VALUES ($1, $2)`, [`${id}p`, id]);
    const login = await api("/api/auth/login", { method: "POST", body: { email, password: PASSWORD } });
    if (!login.ok) throw new Error(`could not sign in the test learner: HTTP ${login.status}`);
    cookie = login.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  } else {
    throw new Error(
      `could not create test learner: HTTP ${res.status}` +
        (res.status === 403 ? " — set ENROLMENT_CODE in .env to the server's value" : "")
    );
  }
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

/**
 * A silent tenth of a second, as a WAV data URL: what a suite puts in for a
 * letter sound no specialist has recorded, so Change the sound has pairs to
 * play. Silence on purpose — if one were ever left behind, a child would hear
 * nothing rather than a wrong sound — and the sweep below removes it anyway.
 */
export const STAND_IN_SOUND = (() => {
  const samples = 1600;
  const b = Buffer.alloc(44 + samples * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + samples * 2, 4);
  b.write("WAVE", 8);
  b.write("fmt ", 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(16000, 24);
  b.writeUInt32LE(32000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(samples * 2, 40);
  return `data:audio/wav;base64,${b.toString("base64")}`;
})();

/**
 * Put in stand-ins for whichever of these sounds nobody has recorded, and
 * return the ones put in. A specialist's own recording is never replaced.
 */
export async function standInSounds(sounds) {
  const added = [];
  for (const sound of sounds) {
    const rows = await query(
      `INSERT INTO "LetterSound" (sound, audio, "updatedAt") VALUES ($1, $2, NOW())
       ON CONFLICT (sound) DO NOTHING RETURNING sound`,
      [sound, STAND_IN_SOUND]
    );
    if (rows.length) added.push(sound);
  }
  return added;
}

/** Safety net: never let a suite delete real study accounts. */
export async function cleanupTestAccounts() {
  // Stand-in sounds go too, and only those: matched on the silent clip itself.
  await getPool().query(`DELETE FROM "LetterSound" WHERE audio = $1`, [STAND_IN_SOUND]);
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
