/**
 * The lesson-or-check rule and its calendar, checked without a database.
 *
 *   npm run practice:check
 *
 * The server runs in UTC and the children in Manila (UTC+8), so "today" turns
 * over at 16:00 UTC. A check is only a check on a later Manila day than the
 * lesson; getting the boundary wrong would let a lesson and its check fall on
 * the same evening.
 *
 * Loads .env, as check-calibration.ts does: practice.ts imports the database
 * client, which wants DATABASE_URL set. Nothing here queries it.
 */
import "dotenv/config";
import { dayKey } from "../src/lib/time";
import { practiceModeFor, practiceDayDate, practiceDayKey } from "../src/lib/practice";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failures++;
};

const d = (key: string | null) => (key ? practiceDayDate(key) : null);

check("23:59 in Manila is still that day", dayKey(new Date("2026-10-16T15:59:59Z")) === "2026-10-16");
check("00:00 in Manila is the next day", dayKey(new Date("2026-10-16T16:00:00Z")) === "2026-10-17");
check("a day key survives the DATE column", practiceDayKey(practiceDayDate("2026-10-16")) === "2026-10-16");
check("never taught: a lesson", practiceModeFor({ lastTaughtOn: null, lastSeenOn: null }, "2026-10-16") === "lesson");
check(
  "taught yesterday, not seen today: a check",
  practiceModeFor({ lastTaughtOn: d("2026-10-15"), lastSeenOn: d("2026-10-15") }, "2026-10-16") === "check"
);
check(
  "seen today: a lesson",
  practiceModeFor({ lastTaughtOn: d("2026-10-15"), lastSeenOn: d("2026-10-16") }, "2026-10-16") === "lesson"
);
check(
  "taught today: a lesson",
  practiceModeFor({ lastTaughtOn: d("2026-10-16"), lastSeenOn: d("2026-10-16") }, "2026-10-16") === "lesson"
);

console.log(`\n${failures ? `${failures} failure(s).` : "All practice checks passed."}`);
if (failures) process.exit(1);
