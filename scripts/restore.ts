/**
 * Restore a LEXORA backup, replacing everything currently in the database.
 *
 *   npm run restore -- backups/lexora-….json.gz --dry-run   # compare counts only
 *   npm run restore -- backups/lexora-….json.gz --verify    # full rehearsal, rolled back
 *   npm run restore -- backups/lexora-….json.gz --yes       # actually restore
 *
 * Run --verify after taking a backup. It performs the entire restore inside a
 * transaction and then rolls it back, so it proves the file can genuinely be
 * restored without touching the live data. An untested backup is not a backup.
 *
 * This is destructive: it clears every table and replays the backup. It always
 * shows what it will do and refuses to act without --yes, so the command
 * cannot wipe a live study by accident.
 *
 * The schema must already exist — run `npx prisma migrate deploy` first if you
 * are restoring into a fresh database.
 */
import "dotenv/config";
import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { text } from "node:stream/consumers";
import pg from "pg";
import { TABLE_ORDER } from "./db-tables";

const BATCH = 100; // audio clips make rows large; insert in modest batches

type Backup = {
  format: string;
  createdAt: string;
  rowCounts: Record<string, number>;
  data: Record<string, Record<string, unknown>[]>;
};

async function main() {
  const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const confirmed = process.argv.includes("--yes");
  const dryRun = process.argv.includes("--dry-run");
  const verify = process.argv.includes("--verify");

  if (!file) {
    console.error("Usage: npm run restore -- <backup.json.gz> [--dry-run | --verify | --yes]");
    process.exit(1);
  }

  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Set DIRECT_URL (or DATABASE_URL) in .env");

  const raw = await text(createReadStream(file).pipe(createGunzip()));
  const backup = JSON.parse(raw) as Backup;
  if (backup.format !== "lexora-backup/1") {
    throw new Error(`Unrecognised backup format: ${backup.format}`);
  }

  const client = new pg.Client({ connectionString });
  await client.connect();
  const host = new URL(connectionString.replace(/^postgres(ql)?:/, "http:")).host;

  console.log(`Backup taken ${backup.createdAt}`);
  console.log(`Target database: ${host}\n`);
  console.log("  table                backup     current");
  console.log("  " + "-".repeat(42));
  for (const table of TABLE_ORDER) {
    const current = (await client.query(`SELECT COUNT(*)::int AS n FROM "${table}"`)).rows[0].n;
    const incoming = backup.rowCounts[table] ?? 0;
    console.log(`  ${table.padEnd(18)}${String(incoming).padStart(8)}${String(current).padStart(12)}`);
  }

  if (dryRun) {
    console.log("\nDry run — nothing was changed.");
    await client.end();
    return;
  }

  if (!verify && !confirmed) {
    console.log(
      "\nRefusing to proceed: this replaces everything above." +
        "\nRehearse it safely with --verify, or re-run with --yes once you are sure."
    );
    await client.end();
    return;
  }

  console.log(verify ? "\nRehearsing the restore (will be rolled back)…" : "\nRestoring…");
  await client.query("BEGIN");
  try {
    // children first, so foreign keys stay satisfied throughout
    for (const table of [...TABLE_ORDER].reverse()) {
      await client.query(`DELETE FROM "${table}"`);
    }

    for (const table of TABLE_ORDER) {
      const rows = backup.data[table] ?? [];
      if (!rows.length) continue;
      const columns = Object.keys(rows[0]);
      const quoted = columns.map((c) => `"${c}"`).join(", ");

      for (let i = 0; i < rows.length; i += BATCH) {
        const slice = rows.slice(i, i + BATCH);
        const values: unknown[] = [];
        const tuples = slice.map((row, r) => {
          const placeholders = columns.map((_, c) => `$${r * columns.length + c + 1}`);
          columns.forEach((col) => values.push(row[col]));
          return `(${placeholders.join(", ")})`;
        });
        await client.query(`INSERT INTO "${table}" (${quoted}) VALUES ${tuples.join(", ")}`, values);
      }
      console.log(`  ${table.padEnd(18)}${String(rows.length).padStart(6)} rows restored`);
    }

    if (verify) {
      // Confirm the rows really landed before undoing the rehearsal.
      let ok = true;
      for (const table of TABLE_ORDER) {
        const got = (await client.query(`SELECT COUNT(*)::int AS n FROM "${table}"`)).rows[0].n;
        const want = backup.rowCounts[table] ?? 0;
        if (got !== want) {
          ok = false;
          console.error(`  MISMATCH ${table}: restored ${got}, expected ${want}`);
        }
      }
      await client.query("ROLLBACK");
      console.log(
        ok
          ? "\nRehearsal succeeded — every row restored correctly, then rolled back.\nThis backup is known-good and the live data is untouched."
          : "\nRehearsal FAILED — see the mismatches above. Rolled back."
      );
      if (!ok) process.exitCode = 1;
      return;
    }

    await client.query("COMMIT");
    console.log("\nRestore complete.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\nRestore failed and was rolled back — the database is unchanged.");
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
