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
import { execFileSync } from "node:child_process";
import pg from "pg";

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

/* ── 3. the values now in use are nowhere in the repository ─────────────── */

/**
 * Run git and return its stdout, treating "found nothing" as a result.
 *
 * `git grep` exits 1 when it matches nothing, which execFileSync raises as an
 * exception. Letting that propagate past the *first* search would skip the
 * second one entirely and report a value as clean because it was absent from
 * the working tree — while it sat in history, which is the only case this check
 * exists for. So exit 1 is translated to an empty string here, per call, and
 * anything else still throws.
 */
function git(args: string[]): string {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 32 * 1024 * 1024,
    }).trim();
  } catch (err) {
    if ((err as { status?: number }).status === 1) return ""; // matched nothing
    throw err;
  }
}

/**
 * Search the working tree and then the full history for a value.
 *
 * The history pass is the one that matters: a secret deleted in the latest
 * commit is still readable in the one before it, and a repository that has been
 * cloned or forked keeps it forever.
 *
 * All three outcomes were checked against known values rather than assumed: a
 * string still in the checkout returns "tree", a string deleted by d60d070
 * returns "history", and an invented one returns null. The history branch in
 * particular was reachable only after the exit-1 handling above was moved into
 * `git()` — before that, a value absent from the working tree short-circuited
 * the whole function and reported clean, which is the one answer this check must
 * never give wrongly.
 */
function appearsInRepo(value: string): "tree" | "history" | null {
  if (git(["grep", "-I", "-l", "-F", value])) return "tree";

  const revs = git(["rev-list", "--all"]).split("\n").filter(Boolean);
  if (revs.length === 0) return null;

  return git(["grep", "-I", "-l", "-F", value, ...revs]) ? "history" : null;
}

function checkNotCommitted() {
  console.log("\n[3] the values now in use appear nowhere in the repository");

  const current = process.env.SPECIALIST_CODE;

  if (!current) {
    check(
      "SPECIALIST_CODE is set locally so it can be checked",
      false,
      "not set — run with the study .env, or this check cannot say anything"
    );
    return;
  }

  if (current === LEAKED_SPECIALIST_CODE) {
    check(
      "SPECIALIST_CODE has actually been rotated",
      false,
      "still the value that is published in git history"
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
}

/* ── run ────────────────────────────────────────────────────────────────── */

async function main() {
  console.log(`Secrets check against ${BASE}`);

  await checkSpecialistCode();
  await checkDemoPassword();
  checkNotCommitted();

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
