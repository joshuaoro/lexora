/**
 * Prove the credentials in this repository's public history no longer work.
 *
 *   npm run secrets:check                      # against http://localhost:3000
 *   npm run secrets:check -- https://app.url   # against the deployment
 *
 * Why this is a script and not a checklist item
 * ---------------------------------------------
 * `SPECIALIST_CODE` and the demo password were committed to a public repository
 * and are still readable in its history. Rotating them does not remove them —
 * nothing does, short of rewriting history that may already be cloned. Rotation
 * *invalidates* them, and the only way to know it worked is to present the old
 * value and be refused.
 *
 * The specialist code is the one that matters most. Anyone holding it can
 * register themselves as a reading specialist and then read every child's
 * records and play back every recording, without needing an account to start
 * with.
 *
 * The third check is the one that keeps the fix fixed: it searches the tracked
 * tree *and every commit* for the values currently in use, so a rotation cannot
 * be quietly undone by pasting a new secret into a file that gets committed.
 * A rotation that lands in git is not a rotation; it is a slower leak.
 *
 * No secret is ever printed. Failures say which check failed and why, never the
 * value involved.
 */
import "dotenv/config";
import pg from "pg";
import { appearsInRepo } from "./git-history";

const BASE = process.argv[2] ?? process.env.AUDIT_BASE_URL ?? "http://localhost:3000";

/** Values that were published in git history and must no longer be accepted. */
const LEAKED_SPECIALIST_CODE = "READINGOWL";
const LEAKED_PASSWORD = "lexora123";
const DEMO_SPECIALIST = "specialist@lexora.ph";

let failures = 0;

function check(name: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failures++;
}

async function post(path: string, body: unknown) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    return res.status;
  } catch {
    return 0;
  }
}

/* ── 1. the published specialist code no longer opens the door ──────────── */

/**
 * Remove an account this script created.
 *
 * If the leaked code still works, the probe above has just registered a live
 * specialist — one that can read every child's record. Leaving that behind
 * would make the check itself a vulnerability, so the cleanup runs whatever the
 * outcome, and says so loudly if it cannot.
 */
async function deleteAccount(email: string): Promise<boolean> {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) return false;
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    await client.query(`DELETE FROM "User" WHERE email = $1`, [email]);
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

async function checkSpecialistCode() {
  console.log("\n[1] the leaked specialist access code is refused");

  // A throwaway address, so a pass leaves nothing behind and a failure is
  // traceable in the user table if the cleanup below ever fails.
  const email = `secrets-check-${Date.now()}@lexora.test`;
  const status = await post("/api/auth/register", {
    name: "SecretsCheck",
    email,
    password: "a-long-enough-password",
    role: "SPECIALIST",
    code: LEAKED_SPECIALIST_CODE,
  });

  if (status === 0) {
    check("could reach the deployment", false, `no response from ${BASE}`);
    return;
  }

  const created = status === 200 || status === 201;

  check(
    "registering a specialist with the published code is rejected",
    status === 403,
    created
      ? "ACCEPTED — the code in git history is still live. Rotate SPECIALIST_CODE."
      : `HTTP ${status}`
  );

  if (created) {
    const removed = await deleteAccount(email);
    check(
      "the specialist account this check created was removed again",
      removed,
      removed
        ? "cleaned up"
        : `COULD NOT DELETE — remove ${email} by hand; it is a live specialist account`
    );
  }
}

/* ── 2. the published demo password no longer signs anyone in ───────────── */

async function checkDemoPassword() {
  console.log("\n[2] the leaked demo password is refused");

  const status = await post("/api/auth/login", {
    email: DEMO_SPECIALIST,
    password: LEAKED_PASSWORD,
  });

  if (status === 0) {
    check("could reach the deployment", false, `no response from ${BASE}`);
    return;
  }

  check(
    `${DEMO_SPECIALIST} cannot sign in with the published password`,
    status === 401,
    status === 200
      ? "ACCEPTED — this account reads every learner's records and recordings. Change its password."
      : `HTTP ${status}`
  );
}

/* ── 3. this machine's own .env is not still on a published value ───────── */

/**
 * Checks the **local** environment, which is a different question from checks
 * 1 and 2 above.
 *
 * Those two ask the deployment whether it still accepts a published credential.
 * This one asks what is sitting in the `.env` on this machine — and the two can
 * disagree, which is precisely what happened: the deployment was rotated while
 * `.env` kept `READINGOWL`, and the summary line read as though nothing had been
 * rotated at all.
 *
 * The drift is not cosmetic. `npm run dev` and `npm start` read this file and
 * write to the *same* database the deployment uses, so a local instance running
 * on the old code accepts the publicly-known access code and creates real
 * specialist accounts in the live study database. Naming the two scopes apart is
 * the only way that shows up.
 */
function checkNotCommitted() {
  console.log("\n[3] this machine's .env (separate from the deployment above)");

  const current = process.env.SPECIALIST_CODE;

  if (!current) {
    console.log(
      "  --   SPECIALIST_CODE not set locally — nothing to check here. Note that\n" +
        "       specialist registration is disabled entirely when it is unset."
    );
    return;
  }

  if (current === LEAKED_SPECIALIST_CODE) {
    check(
      "the SPECIALIST_CODE in this .env is not the published one",
      false,
      "it is still READINGOWL. The deployment may already be rotated — checks 1 and 2 " +
        "above answer that — but `npm run dev`/`npm start` read this file and write to " +
        "the SAME database, so running locally reopens the door. Copy the rotated value " +
        "from Vercel into .env."
    );
    return;
  }

  const where = appearsInRepo(current);
  check(
    "the current SPECIALIST_CODE is not committed anywhere",
    where === null,
    where === "tree"
      ? "found in a tracked file — remove it and rotate again, it is now public"
      : where === "history"
        ? "found in an earlier commit — rotate again, this value is already published"
        : ""
  );

  // The specialist password is stored only as a bcrypt hash, so the only copy
  // this script can inspect is the one the audit suite signs in with. Checking
  // it closes the same loop: a rotated password pasted into a committed file is
  // no better rotated than the one it replaced.
  const auditPassword = process.env.AUDIT_SPECIALIST_PASSWORD;
  if (!auditPassword) {
    console.log(
      "  --   AUDIT_SPECIALIST_PASSWORD not set, so the specialist password could not be checked"
    );
    return;
  }
  if (auditPassword === LEAKED_PASSWORD) {
    check("the specialist password has actually been rotated", false, "still the published value");
    return;
  }
  const pwWhere = appearsInRepo(auditPassword);
  check(
    "the current specialist password is not committed anywhere",
    pwWhere === null,
    pwWhere === "tree"
      ? "found in a tracked file — rotate again, it is now public"
      : pwWhere === "history"
        ? "found in an earlier commit — rotate again, this value is already published"
        : ""
  );
}

/* ── 4. does this .env agree with the deployment? ───────────────────────── */

/**
 * Drift between the local access code and the deployed one.
 *
 * Rotating in Vercel and forgetting `.env` leaves no visible symptom: the
 * deployment is correct, the local app still starts, and the two disagree
 * silently. It is only dangerous because both write to the same database — a
 * local instance holding the old published code will happily mint a real
 * specialist account in the live study data.
 *
 * Detected by trying the *local* code against the deployment. A 403 means the
 * deployment does not recognise it, so the two have drifted. A success means
 * they match — and the account that proves it is deleted immediately.
 */
async function checkEnvMatchesDeployment() {
  console.log("\n[4] this machine's .env agrees with the deployment");

  const local = process.env.SPECIALIST_CODE;
  if (!local) {
    console.log("  --   no local SPECIALIST_CODE to compare");
    return;
  }
  if (local === LEAKED_SPECIALIST_CODE) {
    console.log("  --   local code is the published one; check 3 covers that");
    return;
  }

  const email = `envdrift-check-${Date.now()}@lexora.test`;
  const status = await post("/api/auth/register", {
    name: "EnvDriftCheck",
    email,
    password: "a-long-enough-password",
    role: "SPECIALIST",
    code: local,
  });

  if (status === 0) {
    check("could reach the deployment", false, `no response from ${BASE}`);
    return;
  }

  const matched = status === 200 || status === 201;
  check(
    "the local SPECIALIST_CODE is the one the deployment accepts",
    matched,
    matched
      ? "in step"
      : `the deployment refused it (HTTP ${status}) — .env and Vercel hold different ` +
        "values. Copy the deployed one into .env, or local runs will behave differently " +
        "from production against the same database."
  );

  if (matched) {
    const removed = await deleteAccount(email);
    check(
      "the account this check created was removed again",
      removed,
      removed ? "cleaned up" : `COULD NOT DELETE — remove ${email} by hand`
    );
  }
}

/* ── run ────────────────────────────────────────────────────────────────── */

async function main() {
  console.log(`Secrets check against ${BASE}`);

  await checkSpecialistCode();
  await checkDemoPassword();
  checkNotCommitted();
  await checkEnvMatchesDeployment();

  console.log(
    failures === 0
      ? "\nAll clear: the published values are refused, and the current ones are not in the repository."
      : `\n${failures} check(s) failed. These gate every child's record — fix before enrolling anyone.`
  );
  // exitCode rather than exit(), so the pg socket closes cleanly — exit() mid
  // teardown trips a libuv assertion on Windows and buries the report above.
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error("Secrets check could not run:", err instanceof Error ? err.message : err);
  process.exit(1);
});
