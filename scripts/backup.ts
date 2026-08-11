/**
 * Back up the entire LEXORA database to a single compressed file.
 *
 *   npm run backup                  # write backups/lexora-<timestamp>.json.gz
 *   npm run backup -- --out path    # write somewhere specific
 *   npm run backup -- --keep 30     # how many to retain (default 14)
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
import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import pg from "pg";
import { TABLE_ORDER, assertCoversSchema } from "./db-tables";

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

  // Before writing anything: does this dump still cover the whole schema?
  const live = await client.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
  );
  try {
    assertCoversSchema(live.rows.map((r) => r.tablename));
  } catch (err) {
    await client.end();
    throw err;
  }

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

  await prune(dirname(outPath));

  console.log("\nKeep a copy somewhere other than this laptop — a drive failure");
  console.log("would otherwise take the study data with it.");
}

/**
 * Keep the most recent backups and delete the rest.
 *
 * Each file holds every recording in the database, so an unattended daily
 * backup would otherwise fill the disk — and a scheduled job that eventually
 * fails on a full disk is worse than no scheduled job, because it looks like it
 * is still working.
 */
async function prune(dir: string) {
  const keepFlag = process.argv.indexOf("--keep");
  const keep = keepFlag !== -1 ? Number(process.argv[keepFlag + 1]) : 14;
  if (!Number.isFinite(keep) || keep < 1) return;

  const files = (await readdir(dir))
    .filter((f) => /^lexora-.*\.json\.gz$/.test(f))
    .sort()
    .reverse(); // timestamped names sort chronologically

  const stale = files.slice(keep);
  if (stale.length === 0) return;

  for (const f of stale) await unlink(join(dir, f));
  console.log(`Pruned ${stale.length} older backup(s); ${keep} kept.`);
}

main().catch((err) => {
  console.error("Backup failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
