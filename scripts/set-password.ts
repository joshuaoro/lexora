/**
 * Change an account's password.
 *
 *   npm run password:set -- specialist@lexora.ph --generate
 *   npm run password:set -- learner1@lexora.ph --generate --random
 *
 *   # to choose the value yourself — syntax differs by shell:
 *   $env:NEW_PASSWORD = "…"; npm run password:set -- <email>; Remove-Item Env:NEW_PASSWORD
 *   NEW_PASSWORD="…" npm run password:set -- <email>          # bash / zsh
 *
 * Why this exists
 * ---------------
 * Until now LEXORA had no way to change a password at all: bcrypt.hash runs once
 * in src/app/api/auth/register/route.ts and nothing ever updated the column
 * again. Two consequences, and the second is the one that would have bitten
 * during the study.
 *
 * The published one: specialist@lexora.ph / lexora123 is readable in this
 * repository's public git history, and that account reads every child's record
 * and plays back every recording.
 *
 * The quiet one: a participant who forgets their password could only be helped
 * by deleting the account, and LearnerProfile cascades — every reading,
 * recording and specialist verdict would go with it. Five children aged 7–12
 * over eight weeks will forget a password. This is the recovery path.
 *
 * The password is never accepted as a command-line argument, because arguments
 * are visible in the process list to every other process on the machine.
 *
 * Be clear about what that does *not* buy, since an earlier version of this
 * comment overstated it: passing the value through the environment does not keep
 * it out of your shell history. PowerShell's PSReadLine appends every typed line
 * to a plaintext file, and bash records the command line too — so
 * `$env:NEW_PASSWORD = "…"` is written to disk just as an argument would be.
 * `--generate` is the only route here that types nothing at all.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import pg from "pg";
import { WORDS } from "../prisma/word-bank";
import { appearsInRepo, describeHit } from "./git-history";

/** Same cost factor as registration, so the login route's compare is unchanged. */
const BCRYPT_ROUNDS = 10;

/**
 * Minimum length, by what the account can reach.
 *
 * The app's own rule is 6 (the Zod schema in the register route) and that stays
 * right for a learner: a seven-year-old types it themselves on a tablet, and it
 * guards only their own readings. A specialist account reaches every child's
 * records and recordings, which is a different thing to protect, so it gets a
 * higher floor than the app would demand.
 */
const MIN_LENGTH = { LEARNER: 6, SPECIALIST: 12 } as const;

/** Refused by name, independent of the history search, as a backstop. */
const KNOWN_PUBLISHED = ["lexora123", "READINGOWL"];

/* ── generating something worth using ───────────────────────────────────── */

/**
 * A passphrase from the word bank.
 *
 * Five Filipino words and a three-digit number: bahay-pusa-guhit-lawa-tubig-472.
 * Drawn from prisma/word-bank.ts, which is public — that is how Diceware works,
 * since the strength is in the combination and not in hiding the list.
 *
 * Chosen for the accounts a person types. Three reading specialists sign in at
 * the start of every session on a tablet, and an unmemorable password on a
 * shared tablet becomes a sticky note beside it, which is a worse exposure than
 * a passphrase.
 *
 * Sized honestly: log2(254^5 x 1000) is about 50 bits. That is far beyond what
 * the login route's limiter allows to be guessed online (10 failures per 15
 * minutes, src/lib/rate-limit.ts) and is *not* sized against offline cracking of
 * a stolen hash. Use --random, or supply your own through NEW_PASSWORD, if the
 * threat you have in mind is a leaked database rather than a guesser.
 */
function passphrase(): { value: string; bits: number } {
  const pool = WORDS.map((w) => w[0]).filter((t) => /^[a-z]+$/.test(t));
  const picked = Array.from({ length: 5 }, () => pool[randomInt(pool.length)]);
  const digits = String(randomInt(100, 1000));
  return {
    value: [...picked, digits].join("-"),
    bits: Math.round(Math.log2(Math.pow(pool.length, 5) * 900)),
  };
}

/** For accounts nobody types by hand. */
function randomPassword(): { value: string; bits: number } {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const value = Array.from({ length: 24 }, () => alphabet[randomInt(alphabet.length)]).join("");
  return { value, bits: Math.round(24 * Math.log2(alphabet.length)) };
}

/* ── the change itself ──────────────────────────────────────────────────── */

type Account = { id: string; email: string; role: string; name: string };

async function main() {
  const args = process.argv.slice(2);
  const email = args.find((a) => !a.startsWith("--"));
  const generate = args.includes("--generate");
  const useRandom = args.includes("--random");

  if (!email) {
    console.error(
      "Usage: npm run password:set -- <email> --generate [--random]\n" +
        "   or: NEW_PASSWORD=\"…\" npm run password:set -- <email>\n\n" +
        "The password is never taken as an argument — it would end up in shell history."
    );
    process.exitCode = 1;
    return;
  }

  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Set DIRECT_URL (or DATABASE_URL) in .env");

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    const found = await client.query<Account>(
      `SELECT id, email, role, name FROM "User" WHERE email = $1`,
      [email]
    );
    if (found.rowCount === 0) {
      console.error(`No account with the email ${email}. Nothing changed.`);
      process.exitCode = 1;
      return;
    }
    const account = found.rows[0];

    // Where the new password comes from.
    const supplied = process.env.NEW_PASSWORD;
    let generated: { value: string; bits: number } | null = null;
    if (generate) {
      generated = useRandom ? randomPassword() : passphrase();
    } else if (!supplied) {
      console.error(
        "No password given. Either:\n" +
          "  --generate                 the script picks one and prints it once\n" +
          "  NEW_PASSWORD in the env    you choose it\n\n" +
          "PowerShell:  $env:NEW_PASSWORD = \"…\"; npm run password:set -- <email>; Remove-Item Env:NEW_PASSWORD\n" +
          "bash/zsh:    NEW_PASSWORD=\"…\" npm run password:set -- <email>\n\n" +
          "It is not accepted as an argument, where the process list would expose it.\n" +
          "Note the environment does not hide it from your shell history — only --generate does."
      );
      process.exitCode = 1;
      return;
    }
    const password = generated?.value ?? supplied!;

    // Refusals, cheapest first.
    const floor = MIN_LENGTH[account.role as keyof typeof MIN_LENGTH] ?? MIN_LENGTH.LEARNER;
    if (password.length < floor) {
      console.error(
        `Too short for a ${account.role} account: ${password.length} characters, minimum ${floor}.\n` +
          (account.role === "SPECIALIST"
            ? "A specialist account can read every learner's records and play back every recording,\n" +
              "so this floor is higher than the app's own 6-character rule."
            : "")
      );
      process.exitCode = 1;
      return;
    }

    if (KNOWN_PUBLISHED.includes(password)) {
      console.error("That value is published in this repository. Refusing to set it.");
      process.exitCode = 1;
      return;
    }

    const where = appearsInRepo(password);
    if (where !== null) {
      console.error(
        `Refusing to set this password: ${describeHit(where)}.\n` +
          "Rotation means replacing a public value with a private one — installing another\n" +
          "value that is already readable in the repository would not be a rotation."
      );
      process.exitCode = 1;
      return;
    }

    // Change it.
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await client.query(`UPDATE "User" SET password = $1 WHERE id = $2`, [hash, account.id]);

    // Verify against what was actually stored, not against what we meant to store.
    const after = await client.query<{ password: string }>(
      `SELECT password FROM "User" WHERE id = $1`,
      [account.id]
    );
    const ok = await bcrypt.compare(password, after.rows[0].password);
    if (!ok) {
      console.error("The stored hash does not match the new password. Nothing can be assumed; investigate.");
      process.exitCode = 1;
      return;
    }

    console.log(`\nPassword changed for ${account.email} (${account.role}, ${account.name}).`);
    console.log("Verified against the stored hash.");

    if (generated) {
      console.log("\n" + "─".repeat(66));
      console.log(`  ${generated.value}`);
      console.log("─".repeat(66));
      console.log(
        `Roughly ${generated.bits} bits of entropy. Store it in a password manager now —\n` +
          "it is not saved anywhere and will not be shown again."
      );
      if (!useRandom) {
        console.log(
          "Sized against online guessing behind the login limiter, not against offline\n" +
            "cracking of a stolen hash. Use --random, or NEW_PASSWORD, if you want more."
        );
      }
    }

    // Said here because this is the moment it is relevant, and the README is
    // not open. Otherwise it gets reported as "the rotation did not work".
    console.log(
      "\nActive sessions are unaffected. LEXORA's session cookie is a stateless JWT\n" +
        "valid for 7 days, so anyone already signed in stays signed in until it expires\n" +
        "or they sign out; the new password is required at their next sign-in. This is\n" +
        "expected. To end every session at once, rotate AUTH_SECRET in Vercel and\n" +
        "redeploy — that invalidates every issued cookie."
    );

    if (account.email === "specialist@lexora.ph") {
      console.log(
        "\nSet AUDIT_SPECIALIST_PASSWORD in .env to this value, or all ten audit suites\n" +
          "will fail at their opening sign-in with a message about the database not\n" +
          "being seeded."
      );
    }
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error("Could not change the password:", err instanceof Error ? err.message : err);
  process.exit(1);
});
