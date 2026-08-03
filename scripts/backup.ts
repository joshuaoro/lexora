/**
 * Back up the entire LEXORA database to a single compressed file.
 *
 *   npm run backup                  # write backups/lexora-<timestamp>.json.gz
 *   npm run backup -- --out path    # write somewhere specific
 *
 * Why this exists: Supabase's free tier takes no automatic backups. Reading
 * data collected from children cannot be re-gathered if it is lost, so run
 * this before and after every testing session and keep a copy off this machine.
 *
 * Deliberately implemented with the `pg` client rather than pg_dump so it works
 * on any machine with Node and no Postgres tooling installed.
 */
import "dotenv/config";
import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import pg from "pg";
import { TABLE_ORDER } from "./db-tables";

async function main() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Set DIRECT_URL (or DATABASE_URL) in .env");

  const outFlag = process.argv.indexOf("--out");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outPath =
    outFlag !== -1 && process.argv[outFlag + 1]
      ? process.argv[outFlag + 1]
      : join("backups", `lexora-${stamp}.json.gz`);

  await mkdir(dirname(outPath), { recursive: true });

  const client = new pg.Client({ connectionString });
  await client.connect();

  console.log("Backing up LEXORA…");
  const data: Record<string, unknown[]> = {};
  let totalRows = 0;

  for (const table of TABLE_ORDER) {
    const { rows } = await client.query(`SELECT * FROM "${table}"`);
    data[table] = rows;
    totalRows += rows.length;
    console.log(`  ${table.padEnd(18)}${String(rows.length).padStart(6)} rows`);
  }

  await client.end();

  const payload = {
    format: "lexora-backup/1",
    createdAt: new Date().toISOString(),
    tables: TABLE_ORDER,
    rowCounts: Object.fromEntries(TABLE_ORDER.map((t) => [t, data[t].length])),
    data,
  };

  await pipeline(
    Readable.from([JSON.stringify(payload)]),
    createGzip({ level: 9 }),
    createWriteStream(outPath)
  );

  const { size } = await stat(outPath);
  console.log(`\nWrote ${outPath}`);
  console.log(`${totalRows} rows, ${(size / 1024 / 1024).toFixed(2)} MB compressed`);
  console.log("\nKeep a copy somewhere other than this laptop — a drive failure");
  console.log("would otherwise take the study data with it.");
}

main().catch((err) => {
  console.error("Backup failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
