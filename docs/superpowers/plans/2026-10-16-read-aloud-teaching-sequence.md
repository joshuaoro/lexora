# Read Aloud Teaching Sequence and Practice Lessons — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read aloud models the word after every first reading; Practice teaches first and checks on a later day; only Read aloud first readings feed the study's figures.

**Architecture:** One shared definition of "measured readings" (`src/lib/measures.ts`) replaces about ten copies of `["READ_ALOUD", "PRACTICE"]`. Practice bookkeeping (lesson/check per word, by Manila calendar day) lives in a new pure-plus-DB module `src/lib/practice.ts`; the attempts route decides the mode server-side and stores it on the attempt. The client gains one cancellable "model" player in `src/lib/tts.ts` and uses it in `ExerciseSession.tsx` for Read aloud and Practice.

**Tech Stack:** Next.js 16 (App Router, React 19, TypeScript), Prisma 7 + PostgreSQL 17 (Supabase), Tailwind 4, Azure AI Speech clips via `/api/speech`, audit suites in `tests/*.mjs` (playwright-core + direct SQL) run against production, `tsx` check scripts.

**Spec:** `docs/superpowers/specs/2026-10-16-read-aloud-teaching-sequence-design.md`

## Global Constraints

- The live database in `.env` **is the study database**: run `npm run backup` before any push that carries a migration; never seed or reset.
- Deploy = `git push origin main`; Vercel runs `prisma migrate deploy`. Confirm with `https://api.github.com/repos/joshuaoro/lexora/commits/<sha>/status` reaching `success` before testing.
- Audit suites run **one at a time** against production: `$env:AUDIT_BASE_URL = "https://lexora-snowy-six.vercel.app"; npm run -s audit:<suite>` (PowerShell). The machine is short of memory.
- Commit messages are written to a file with the Write tool and committed with `git commit -F <file>`; each ends with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Text edits to existing files go through the Edit tool, never a PowerShell replace script.
- "Today" is `dayKey(new Date())` from `src/lib/time.ts` (Asia/Manila).
- Phrases, exactly: Filipino "Ang salitang ito ay" / English "This word is"; "Tama!" / "That's right!"; "Ikaw naman!" / "Your turn!"; "Subukan mo muna!" / "Try it on your own first!"; "Natutunan mo na!" / "You've learned it!" (spoken; the screen adds 🎉); "Bukas, susubukan mo na itong mag-isa!" / "Tomorrow you'll try these on your own!"; card labels "Pakinggan muna" / "Listen first" and "Ikaw muna" / "You first".
- *Silly words* (`PSEUDO_PROBE`) is never modeled and never touched by this work.
- The model cap: the mic is re-enabled after the model finishes **or 8 seconds**, whichever is first.

## Review Focus

1. **The Manila day boundary.** The server runs in UTC; a reading at 23:59 Manila and one at 00:01 Manila are different days. Pinned by `scripts/check-practice.ts` (Task 2).
2. **A model whose audio never loads.** A child must never be left with a disabled mic. Pinned by the 8-second cap and the UI check that the mic is enabled within 12 s (Task 3).
3. **A Practice reading for a word no longer on the list** (a specialist unpinned it mid-run). Must save the reading with no mode and not crash. Pinned in logic-audit (Task 2).
4. **A mastered word misread again in Read aloud.** Must return to the list unmastered with its dates kept, so its next Practice is a check. Pinned in logic-audit (Task 2).
5. **The client claiming a mode.** A request carrying its own `practiceMode` must be ignored. Pinned in logic-audit (Task 2).

---

### Task 1: Measured readings in one place — Read aloud first readings only

**Files:**
- Create: `src/lib/measures.ts`
- Modify: `src/lib/stats.ts:6-17`, `src/lib/phases.ts:68`, `src/lib/adaptive.ts:123,221`, `src/lib/calibration.ts:56`, `src/lib/divergence.ts:95`, `src/app/(app)/specialist/page.tsx:38`, `src/app/(app)/specialist/learner/[id]/page.tsx:71,104,126,209`, `src/app/(app)/specialist/cohort/page.tsx:33`, `src/app/api/export/route.ts:295,333`, `src/app/api/attempts/route.ts:70`
- Test: `tests/logic-audit.mjs` (new section), `tests/calibration-audit.mjs:199,1087`, `tests/decoding-audit.mjs:198`

**Interfaces:**
- Produces: `MEASURED_READING_TYPES: string[]` (= `["READ_ALOUD"]`) and `MEASURED_READINGS` (= `{ activityType: { in: MEASURED_READING_TYPES }, isRetry: false }`) from `@/lib/measures`. Later tasks import these; nothing else may write the activity list out again.

- [ ] **Step 1: Write the failing test** — in `tests/logic-audit.mjs`, add `api` to the helpers import, then insert before `/* ── 3. practice list ──`:

```js
/* ── 2b. practice readings stay out of every figure ────────────────────── */
section("[2b] practice readings stay out of every figure");
/** This learner's row of the summary export, as an object keyed by column. */
async function summaryRow(learnerId) {
  const lines = (await (await api("/api/export?what=summary", { cookie: specialist })).text())
    .replace(/^﻿/, "")
    .trim()
    .split("\r\n");
  const cols = lines[0].split(",");
  const cells = lines.slice(1).map((l) => l.split(",")).find((c) => c[cols.indexOf("learner_id")] === learnerId);
  return cells ? Object.fromEntries(cols.map((c, i) => [c, cells[i]])) : null;
}
const measured = await createTestLearner("measured");
const mWords = await query(`SELECT id, text FROM "Word" WHERE level = 1 AND NOT "isPseudo" ORDER BY text LIMIT 2`);
// One Read aloud misread puts the word on the list and is the only measured reading.
await json("/api/attempts", {
  cookie: measured.cookie,
  method: "POST",
  body: { activityType: "READ_ALOUD", wordId: mWords[0].id, target: mWords[0].text, browserTranscript: "zzzz", responseMs: 1500 },
});
const beforePractice = await summaryRow(measured.learnerId);
for (let i = 0; i < 4; i++) {
  await json("/api/attempts", {
    cookie: measured.cookie,
    method: "POST",
    body: { activityType: "PRACTICE", wordId: mWords[0].id, target: mWords[0].text, browserTranscript: mWords[0].text, responseMs: 1200 },
  });
}
// A specialist scoring a practice reading must not reach the agreement figure.
const pAttempt = await one(
  `SELECT id FROM "Attempt" WHERE "learnerId" = $1 AND "activityType" = 'PRACTICE' ORDER BY "createdAt" DESC LIMIT 1`,
  [measured.learnerId]
);
await json("/api/reviews", { cookie: specialist, method: "POST", body: { attemptId: pAttempt.id, agrees: true, blind: true } });
const afterPractice = await summaryRow(measured.learnerId);
check(
  "practice readings do not count as measured readings",
  beforePractice?.oral_attempts === "1" && afterPractice?.oral_attempts === "1",
  `oral_attempts ${beforePractice?.oral_attempts} → ${afterPractice?.oral_attempts}`
);
check(
  "nor change accuracy",
  afterPractice?.oral_accuracy_pct === beforePractice?.oral_accuracy_pct,
  `${beforePractice?.oral_accuracy_pct}% → ${afterPractice?.oral_accuracy_pct}%`
);
check(
  "nor enter the agreement sample when scored",
  afterPractice?.attempts_reviewed === "0",
  `attempts_reviewed ${afterPractice?.attempts_reviewed}`
);
const mLevel = await one(`SELECT level FROM "LearnerProfile" WHERE id = $1`, [measured.learnerId]);
check("nor move the level", mLevel.level === 1, `L${mLevel.level}`);
await deleteTestLearner(measured.email);
```

Also update the three test queries that list the measured types (they are the test-side copy of the rule):
- `tests/calibration-audit.mjs:199`: `AND a."activityType" IN ('READ_ALOUD','PRACTICE')` → `AND a."activityType" = 'READ_ALOUD'`
- `tests/calibration-audit.mjs:1087`: `WHERE a."activityType" IN ('READ_ALOUD','PRACTICE') AND NOT a."isRetry"` → `WHERE a."activityType" = 'READ_ALOUD' AND NOT a."isRetry"`
- `tests/decoding-audit.mjs:198`: `AND "activityType" IN ('READ_ALOUD','PRACTICE')` → `AND "activityType" = 'READ_ALOUD'`

- [ ] **Step 2: Run it to verify it fails** — `node --check tests/logic-audit.mjs`, then `npm run -s audit:logic` against production.
Expected: FAIL `practice readings do not count as measured readings — oral_attempts 1 → 5` and `nor enter the agreement sample when scored — attempts_reviewed 1`.

- [ ] **Step 3: Create `src/lib/measures.ts`**

```ts
/**
 * Which readings the study's figures are made of.
 *
 * First readings in Read aloud, and nothing else. A Practice reading is taken
 * after LEXORA has modeled the word (a lesson) or on a word the child has been
 * taught (a check), so it measures learning a word rather than decoding one;
 * a re-read ("Ikaw naman!") follows the word being said. Both are saved and
 * playable, and both stay out of level, accuracy, error patterns, agreement and
 * calibration (spec 2026-10-16, §4).
 *
 * Written out once. It used to be copied as ["READ_ALOUD", "PRACTICE"] into
 * about ten files, which is how a rule drifts between the dashboard and the
 * exports.
 */
export const MEASURED_READING_TYPES: string[] = ["READ_ALOUD"];

/** First readings of the measured types: the filter every figure shares. */
export const MEASURED_READINGS = { activityType: { in: MEASURED_READING_TYPES }, isRetry: false };
```

- [ ] **Step 4: Replace every copy** (Edit tool, one per site)
  - `src/lib/stats.ts`: delete `const READ_TYPES = ["READ_ALOUD", "PRACTICE"];`; replace `const MEASURED = { activityType: { in: READ_TYPES }, isRetry: false };` with `const MEASURED = MEASURED_READINGS;`; add `import { MEASURED_READINGS } from "./measures";`. Update the doc comment above it: "oral readings that were a first attempt" → "first readings in Read aloud (see measures.ts)".
  - `src/lib/phases.ts:68`: `const MEASURED_TYPES = ["READ_ALOUD", "PRACTICE"];` → `const MEASURED_TYPES = MEASURED_READING_TYPES;` + `import { MEASURED_READING_TYPES } from "./measures";`
  - `src/lib/adaptive.ts:123` and `:221`: `activityType: { in: ["READ_ALOUD", "PRACTICE"] },` → `activityType: { in: MEASURED_READING_TYPES },` + import.
  - `src/lib/calibration.ts:56`: `activityType: { in: ["READ_ALOUD", "PRACTICE", "PSEUDO_PROBE"] },` → `activityType: { in: [...MEASURED_READING_TYPES, "PSEUDO_PROBE"] },` + import.
  - `src/lib/divergence.ts:95`: same replacement as calibration + import.
  - `src/app/(app)/specialist/page.tsx:38`: `where: { activityType: { in: ["READ_ALOUD", "PRACTICE"] }, isRetry: false },` → `where: MEASURED_READINGS,` + `import { MEASURED_READINGS } from "@/lib/measures";`
  - `src/app/(app)/specialist/learner/[id]/page.tsx` lines 71, 104, 126, 209: each `activityType: { in: ["READ_ALOUD", "PRACTICE"] }` → `activityType: { in: MEASURED_READING_TYPES }` + import.
  - `src/app/(app)/specialist/cohort/page.tsx:33`: `const MEASURED = { activityType: { in: ["READ_ALOUD", "PRACTICE"] }, isRetry: false };` → `const MEASURED = MEASURED_READINGS;` + import.
  - `src/app/api/export/route.ts:295`: `const measured = { activityType: { in: ["READ_ALOUD", "PRACTICE"] }, isRetry: false };` → `const measured = MEASURED_READINGS;`; `:333` `activityType: { in: ["READ_ALOUD", "PRACTICE"] }, isRetry: true` → `activityType: { in: MEASURED_READING_TYPES }, isRetry: true`; import both.
  - `src/app/api/attempts/route.ts:70`: `const ADAPTIVE_TYPES = ["READ_ALOUD", "PRACTICE"];` → `const ADAPTIVE_TYPES = MEASURED_READING_TYPES;` + import; update its doc comment's first line to "Activities whose result may move the learner's level or add to the practice list: Read aloud only (Practice keeps its own bookkeeping, src/lib/practice.ts)."
  - `src/components/specialist/ReviewList.tsx:247` keeps its `"practice"` label (old reviewed readings still render).

- [ ] **Step 5: Verify locally** — Run: `npx tsc --noEmit -p .` → exit 0; `npx eslint src/lib src/app` → 0 errors; Grep `"PRACTICE"\]` across `src` (excluding `generated`) → no matches.

- [ ] **Step 6: Commit and deploy** — commit message file:

```
Count only Read aloud first readings in the study's figures

Practice is about to model words before the child reads them, so its
readings will measure learning a word, not decoding one. They leave level,
accuracy, error patterns, agreement and calibration now, and the rule lives in
one place (src/lib/measures.ts) instead of ten copies of
["READ_ALOUD", "PRACTICE"]. logic-audit §2b pins it through the summary export.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
```
`git add` the files, `git commit -F <file>`, `git push origin main`, wait for Vercel `success`.

- [ ] **Step 7: Run the tests to verify they pass** — `npm run -s audit:logic`, then `audit:calibration`, then `audit:decoding`, one at a time. Expected: all pass, logic with 4 new checks.

---

### Task 2: Practice lessons and checks on the server

**Files:**
- Create: `prisma/migrations/20261016090000_practice_lessons/migration.sql`, `src/lib/practice.ts`, `scripts/check-practice.ts`
- Modify: `prisma/schema.prisma` (PracticeItem, Attempt), `src/lib/adaptive.ts` (remove `recordPracticeResult`), `src/app/api/attempts/route.ts`, `src/lib/exercise-items.ts` (type + PRACTICE branch), `package.json` (script)
- Test: `tests/logic-audit.mjs` §3 (rewritten), `scripts/check-practice.ts`

**Interfaces:**
- Consumes: `MEASURED_READING_TYPES` (Task 1), `dayKey` from `@/lib/time`.
- Produces:
  - `type PracticeMode = "lesson" | "check"`
  - `type PracticeProgress = { mode: PracticeMode; streak: number; mastered: boolean }`
  - `practiceDayKey(d: Date | null): string | null`
  - `practiceDayDate(key: string): Date`
  - `practiceModeFor(item: { lastTaughtOn: Date | null; lastSeenOn: Date | null }, today: string): PracticeMode`
  - `applyPracticeReading(item: { id: string; streak: number }, mode: PracticeMode, correct: boolean, today: string): Promise<PracticeProgress>`
  - `ExerciseItem.practice?: { mode: PracticeMode; streak: number; seenToday: boolean }`
  - The attempts POST response gains `practice: PracticeProgress | null`.

- [ ] **Step 1: Write the failing tests** — replace the whole of section `[3] practice list and mastery` in `tests/logic-audit.mjs` (from `/* ── 3. practice list` up to, not including, `/* ── 4. specialist controls`) with:

```js
/* ── 3. practice list: lessons, checks and mastery ─────────────────────── */
section("[3] practice list: lessons, checks and mastery");
// Read aloud misreads (with word ids) put words on the list.
const missWords = await query(`SELECT id, text FROM "Word" WHERE level = 1 AND NOT "isPseudo" ORDER BY text LIMIT 3`);
for (const w of missWords) await read(w.id, w.text, "zzzz");

const practice = await query(
  `SELECT p."wordId", w.text FROM "PracticeItem" p JOIN "Word" w ON w.id = p."wordId" WHERE p."learnerId" = $1 ORDER BY w.text`,
  [learner.learnerId]
);
check("misread words are collected automatically", practice.length > 0, `${practice.length} words`);

const itemRow = (wordId) =>
  one(
    `SELECT streak, mastered, "missCount", "lastTaughtOn"::text AS taught, "lastSeenOn"::text AS seen
       FROM "PracticeItem" WHERE "learnerId" = $1 AND "wordId" = $2`,
    [learner.learnerId, wordId]
  );
const lastMode = () =>
  one(
    `SELECT "practiceMode" FROM "Attempt" WHERE "learnerId" = $1 AND "activityType" = 'PRACTICE'
      ORDER BY "createdAt" DESC LIMIT 1`,
    [learner.learnerId]
  ).then((r) => r?.practiceMode ?? null);
const practiceRead = (w, heard, extra = {}) =>
  json("/api/attempts", {
    cookie: learner.cookie,
    method: "POST",
    body: { activityType: "PRACTICE", wordId: w.wordId, target: w.text, browserTranscript: heard, responseMs: 1200, ...extra },
  });
/** Pretend the word's last lesson and last sighting were a day earlier. */
const aDayPasses = (w) =>
  query(
    `UPDATE "PracticeItem" SET "lastTaughtOn" = "lastTaughtOn" - 1, "lastSeenOn" = "lastSeenOn" - 1
      WHERE "learnerId" = $1 AND "wordId" = $2`,
    [learner.learnerId, w.wordId]
  );

const [first, second] = practice;
const lesson1 = await practiceRead(first, first.text);
check("a word's first Practice reading is a lesson", (await lastMode()) === "lesson" && lesson1.body.practice?.mode === "lesson", String(await lastMode()));
check("a lesson is not progress", (await itemRow(first.wordId)).streak === 0);
await practiceRead(first, first.text);
check("a second reading the same day is a lesson again", (await lastMode()) === "lesson");

await aDayPasses(first);
const check1 = await practiceRead(first, first.text);
const afterCheck1 = await itemRow(first.wordId);
check("on a later day it is a check", (await lastMode()) === "check" && check1.body.practice?.mode === "check");
check("a correct check is one step, not mastery", afterCheck1.streak === 1 && !afterCheck1.mastered, `streak=${afterCheck1.streak}`);
await practiceRead(first, first.text);
check("a second reading that day is a lesson, not a second check", (await lastMode()) === "lesson" && (await itemRow(first.wordId)).streak === 1);

await aDayPasses(first);
const check2 = await practiceRead(first, first.text);
check("a correct check on another day masters the word", (await itemRow(first.wordId)).mastered === true && check2.body.practice?.mastered === true);

// Review focus 4: misread again in Read aloud, it comes back as a check.
await read(first.wordId, first.text, "zzzz");
const back = await itemRow(first.wordId);
check("a mastered word misread in Read aloud returns to the list", back.mastered === false && back.streak === 0, `missCount=${back.missCount}`);
await aDayPasses(first);
await practiceRead(first, first.text);
check("and its next Practice is a check, not a fresh lesson", (await lastMode()) === "check");

// A misread check resets progress and is taught again.
await practiceRead(second, second.text); // lesson
await aDayPasses(second);
await practiceRead(second, "qqqq"); // check, misread
const failed = await itemRow(second.wordId);
const today = (await one(`SELECT (now() AT TIME ZONE 'Asia/Manila')::date::text AS d`)).d;
check("a misread check resets progress and teaches the word again", failed.streak === 0 && failed.taught === today, `taught=${failed.taught}`);
check("practice misreads do not add to times missed", failed.missCount === 1, `missCount=${failed.missCount}`);

// Review focus 5: the stored mode is the server's.
await aDayPasses(second);
await practiceRead(second, second.text, { practiceMode: "lesson" });
check("the stored mode is the server's, whatever the client sends", (await lastMode()) === "check");

// Review focus 3: a word no longer on the list.
const offList = await one(`SELECT id, text FROM "Word" WHERE level = 2 AND NOT "isPseudo" ORDER BY text LIMIT 1`);
const stray = await practiceRead({ wordId: offList.id, text: offList.text }, offList.text);
check(
  "a Practice reading of a word not on the list is saved, with no mode",
  stray.status === 200 && (await lastMode()) === null && stray.body.practice === null,
  `HTTP ${stray.status}`
);
```

Create `scripts/check-practice.ts`:

```ts
/**
 * The lesson-or-check rule and its calendar, checked without a database.
 *
 *   npm run practice:check
 *
 * The server runs in UTC and the children in Manila (UTC+8), so "today" turns
 * over at 16:00 UTC. A check is only a check on a later Manila day than the
 * lesson; getting the boundary wrong would let a lesson and its check fall on
 * the same evening.
 */
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
check("taught yesterday, not seen today: a check", practiceModeFor({ lastTaughtOn: d("2026-10-15"), lastSeenOn: d("2026-10-15") }, "2026-10-16") === "check");
check("seen today: a lesson", practiceModeFor({ lastTaughtOn: d("2026-10-15"), lastSeenOn: d("2026-10-16") }, "2026-10-16") === "lesson");
check("taught today: a lesson", practiceModeFor({ lastTaughtOn: d("2026-10-16"), lastSeenOn: d("2026-10-16") }, "2026-10-16") === "lesson");

console.log(`\n${failures ? `${failures} failure(s).` : "All practice checks passed."}`);
if (failures) process.exit(1);
```

Add to `package.json` scripts, after `"calibration:check"`: `"practice:check": "tsx scripts/check-practice.ts",`

- [ ] **Step 2: Run to verify they fail** — `npm run -s practice:check` → fails to import `../src/lib/practice` (module not found). `npm run -s audit:logic` (production) → stops in §3 with `column "practiceMode" does not exist` (the column arrives with this task's migration). That is the expected red: §1, §2 and §2b pass before it.

- [ ] **Step 3: Schema and migration** — `npm run backup` first (study database). In `prisma/schema.prisma`, PracticeItem: change `streak    Int      @default(0) // consecutive correct practice reads` to `streak    Int      @default(0) // correct checks in a row, 0–2 (src/lib/practice.ts)` and add after `mastered`:

```prisma
  lastTaughtOn DateTime? @db.Date // Manila day a lesson was last given for this word
  lastSeenOn   DateTime? @db.Date // Manila day this word last came up in Practice
```
In model Attempt, after `isRetry      Boolean  @default(false)` add:

```prisma
  // Practice only: "lesson" (read straight after the word was modeled) or
  // "check" (read alone, on a later day). Decided by the server. Null elsewhere.
  practiceMode String?
```

Create `prisma/migrations/20261016090000_practice_lessons/migration.sql`:

```sql
-- Practice lessons and checks (spec 2026-10-16). Additive: three nullable
-- columns on existing tables; row level security is per table and unchanged.
ALTER TABLE "PracticeItem" ADD COLUMN "lastTaughtOn" DATE;
ALTER TABLE "PracticeItem" ADD COLUMN "lastSeenOn" DATE;
ALTER TABLE "Attempt" ADD COLUMN "practiceMode" TEXT;
```
Run `npx prisma generate`.

- [ ] **Step 4: Create `src/lib/practice.ts`**

```ts
import { prisma } from "./db";

/**
 * The practice list as lessons and checks (spec 2026-10-16, §3).
 *
 * A lesson models the word first ("Ang salitang ito ay bahay. Ikaw naman!")
 * and teaches; it never counts as progress. A check is the child reading a
 * word they were taught on an earlier day, alone; two correct checks, on two
 * different days, take the word off the list. None of it counts toward the
 * study's figures (src/lib/measures.ts).
 *
 * Days are Manila calendar days as YYYY-MM-DD (dayKey in time.ts), stored in
 * DATE columns as midnight UTC of that date.
 */
export type PracticeMode = "lesson" | "check";
export type PracticeProgress = { mode: PracticeMode; streak: number; mastered: boolean };

/** The YYYY-MM-DD a DATE column holds, or null. */
export function practiceDayKey(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** The value to store in a DATE column for a YYYY-MM-DD day. */
export function practiceDayDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/**
 * A check if the word has been taught and has not come up today; a lesson
 * otherwise. Every check marks the word seen, so two checks can never fall on
 * the same day.
 */
export function practiceModeFor(
  item: { lastTaughtOn: Date | null; lastSeenOn: Date | null },
  today: string
): PracticeMode {
  return item.lastTaughtOn !== null && practiceDayKey(item.lastSeenOn) !== today ? "check" : "lesson";
}

/** Record a first Practice reading against its list word and return its progress. */
export async function applyPracticeReading(
  item: { id: string; streak: number },
  mode: PracticeMode,
  correct: boolean,
  today: string
): Promise<PracticeProgress> {
  const day = practiceDayDate(today);
  const data =
    mode === "lesson"
      ? { lastTaughtOn: day, lastSeenOn: day }
      : correct
        ? { lastSeenOn: day, streak: item.streak + 1, mastered: item.streak + 1 >= 2 }
        : // A misread check is followed by the lesson, so it is taught today.
          { lastSeenOn: day, lastTaughtOn: day, streak: 0, mastered: false };
  const updated = await prisma.practiceItem.update({ where: { id: item.id }, data });
  return { mode, streak: updated.streak, mastered: updated.mastered };
}
```

In `src/lib/adaptive.ts` delete `recordPracticeResult` (lines 253–271) and its doc comment. `recordMiss` stays as is: its update already sets `streak: 0, mastered: false` and leaves the dates.

- [ ] **Step 5: Wire the attempts route** (`src/app/api/attempts/route.ts`)
  - Imports: replace `import { updateAdaptiveLevel, recordMiss, recordPracticeResult } from "@/lib/adaptive";` with `import { updateAdaptiveLevel, recordMiss } from "@/lib/adaptive";` and add `import { practiceModeFor, applyPracticeReading, type PracticeProgress } from "@/lib/practice";` and `import { dayKey } from "@/lib/time";`.
  - Before `const attempt = await prisma.attempt.create({`, insert:

```ts
  // Practice: lesson or check, decided here from the word's own dates and
  // stored as decided — never taken from the client, whose copy can be a day
  // old (a tablet left open overnight) or simply claimed.
  const today = dayKey(new Date());
  const practiceItem =
    data.activityType === "PRACTICE" && wordRow && !wordRow.isPseudo
      ? await prisma.practiceItem.findUnique({
          where: { learnerId_wordId: { learnerId, wordId: wordRow.id } },
          select: { id: true, streak: true, lastTaughtOn: true, lastSeenOn: true },
        })
      : null;
  const practiceMode = practiceItem ? practiceModeFor(practiceItem, today) : null;
```
  - In the `prisma.attempt.create` data, after `isRetry,` add `practiceMode,`.
  - Replace the bookkeeping block

```ts
  if (wordRow && !wordRow.isPseudo && !isRetry) {
    if (data.activityType === "PRACTICE") {
      await recordPracticeResult(learnerId, wordRow.id, correct);
    } else if (!correct && ADAPTIVE_TYPES.includes(data.activityType)) {
      await recordMiss(learnerId, wordRow.id);
    }
  }
```
with

```ts
  let practice: PracticeProgress | null = null;
  if (wordRow && !wordRow.isPseudo && !isRetry) {
    if (practiceItem && practiceMode) {
      practice = await applyPracticeReading(practiceItem, practiceMode, correct, today);
    } else if (!correct && ADAPTIVE_TYPES.includes(data.activityType)) {
      await recordMiss(learnerId, wordRow.id);
    }
  }
```
  - In the final `NextResponse.json({ id: attempt.id, correct, ... levelChanged })` add `practice,` after `levelChanged,`.

- [ ] **Step 6: Build the run** (`src/lib/exercise-items.ts`)
  - In `ExerciseItem`, after `swap?: {...};` add:

```ts
  /** Practice only: lesson or check, and the word's progress (spec 2026-10-16). */
  practice?: { mode: "lesson" | "check"; streak: number; seenToday: boolean };
```
  - Add imports `import { dayKey } from "./time";` and `import { practiceModeFor, practiceDayKey } from "./practice";`.
  - Replace the `if (type === "PRACTICE") { ... }` branch with:

```ts
  if (type === "PRACTICE") {
    // Words not yet seen today first, so a second run the same day moves on
    // to other words; then the most missed; then the most recent.
    const today = dayKey(new Date());
    const listed = await prisma.practiceItem.findMany({
      where: { learnerId, mastered: false },
      include: { word: { select: WORD_FIELDS } },
    });
    const seenToday = (p: (typeof listed)[number]) => practiceDayKey(p.lastSeenOn) === today;
    const chosen = listed
      .sort(
        (a, b) =>
          Number(seenToday(a)) - Number(seenToday(b)) ||
          b.missCount - a.missCount ||
          b.updatedAt.getTime() - a.updatedAt.getTime()
      )
      .slice(0, count);
    return chosen.map((p) => ({
      wordId: p.wordId,
      target: p.word.text,
      syllables: p.word.syllables,
      options: null,
      answer: null,
      practice: { mode: practiceModeFor(p, today), streak: p.streak, seenToday: seenToday(p) },
      ...flags(p.wordId),
    }));
  }
```

- [ ] **Step 7: Verify locally** — `npm run -s practice:check` → "All practice checks passed."; `npx tsc --noEmit -p .` → 0; `npx eslint src/lib src/app/api` → 0 errors.

- [ ] **Step 8: Commit and deploy** — `npm run backup` (again, if any time has passed); commit with message:

```
Teach practice words first and check them on a later day

PracticeItem gains lastTaughtOn and lastSeenOn (Manila days) and Attempt gains
practiceMode. A word's Practice reading is a lesson until it has been taught
and not yet seen today; then it is a check, and two correct checks on two days
take it off the list. The server decides and stores the mode; Practice no longer
touches times missed. A second run the same day picks words not yet seen today.
logic-audit §3 rewritten; scripts/check-practice.ts pins the day boundary.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
```
Push, wait for Vercel `success` (the migration runs in `vercel-build`).

- [ ] **Step 9: Run the tests to verify they pass** — `npm run -s audit:logic` → all pass (§3 now 14 checks).

---

### Task 3: Read aloud teaches after every reading

**Files:**
- Modify: `src/lib/tts.ts` (new `speakModel`, shared `playWordClip`), `src/components/exercises/ExerciseSession.tsx`, `src/lib/i18n.ts` (session strings, both languages)
- Test: `tests/ui-audit.mjs` (new section 1c)

**Interfaces:**
- Consumes: nothing from Tasks 1–2 beyond what is deployed.
- Produces:
  - `speakModel(word: { wordId: string | null; hasAudio: boolean; text: string; version: number }, lead: string, lang: "en" | "fil", rate?: number, tail?: string): Promise<void>` in `@/lib/tts`
  - In `ExerciseSession`: `modelPlaying` state, `playModel(it, kind, tail?)` and `scheduleModel(it, kind, delayMs, tail?)` where `kind: "lesson" | "correction" | "confirm"` and `tail` overrides the closing phrase (a lesson's default is "Ikaw naman!"; Task 4 passes "Natutunan mo na!" on mastery).
  - i18n `session.modelLead`, `session.modelConfirm`, `session.modelYourTurn`.

- [ ] **Step 1: Write the failing test** — in `tests/ui-audit.mjs`, insert before `section("[2] display settings persist and apply to the Reader");`:

```js
section("[1c] Read aloud teaches after the reading");
{
  const r = await ctx.newPage();
  watch(r, "learner:read-aloud");
  await r.goto(`${BASE}/exercises/read-aloud`, { waitUntil: "networkidle" });
  await r.locator("button:has-text('Start!')").click();
  await r.locator("button:has-text('Skip this word')").first().waitFor({ timeout: 30000 });
  await r.locator("button:has-text('Skip this word')").first().click();
  const turn = r.locator("button", { hasText: "Say it" }).first();
  await turn.waitFor({ timeout: 45000 });
  check("a skipped word is taught: “Your turn!” follows", (await r.locator("text=Your turn!").count()) >= 1);
  check(
    "with a button to hear the sentence again",
    (await r.locator("button", { hasText: "Hear it again" }).count()) >= 1
  );
  // Review focus 2: the mic waits for the model, but never for long.
  const enabled = await turn
    .evaluate((b) => new Promise((ok) => {
      const t0 = Date.now();
      const tick = () => (!b.disabled ? ok(Date.now() - t0) : Date.now() - t0 > 12000 ? ok(-1) : setTimeout(tick, 200));
      tick();
    }));
  check("the second-attempt mic is enabled once the model has played", enabled >= 0, enabled >= 0 ? `${enabled}ms` : "still disabled after 12s");
  await r.close();
}
```

- [ ] **Step 2: Run to verify it fails** — `npm run -s audit:ui` (production) → FAIL `a skipped word is taught: “Your turn!” follows` (today the header reads "Now you try it!").

- [ ] **Step 3: Add the model player to `src/lib/tts.ts`** — after `speakSwap`, and refactor `speakSwap` to use the same word helper:

```ts
/** A word's own clip (a specialist's recording when there is one), else the neural voice. */
function playWordClip(
  word: { wordId: string | null; hasAudio: boolean; text: string; version: number },
  rate: number
): Promise<void> {
  return word.wordId && word.hasAudio
    ? playMedia(`/api/word-audio/${word.wordId}?kind=word&v=${word.version}`, Math.max(0.6, rate + 0.15))
    : playUiClip(word.text, "fil", rate);
}

/**
 * The model: a phrase in the app's voice, then the word itself, then an
 * optional closing phrase — "Ang salitang ito ay … bahay. … Ikaw naman!"
 * (spec 2026-10-16). The phrases follow the interface language; the word is
 * always the Filipino clip. Cancelled like any sequence; resolves when it has
 * finished or been cut off.
 */
export async function speakModel(
  word: { wordId: string | null; hasAudio: boolean; text: string; version: number },
  lead: string,
  lang: "en" | "fil",
  rate = 0.85,
  tail?: string
): Promise<void> {
  stopSpeaking();
  const mine = generation;
  await playUiClip(lead, lang, rate);
  if (generation !== mine) return;
  await pause(150, rate);
  if (generation !== mine) return;
  await playWordClip(word, rate);
  if (!tail || generation !== mine) return;
  await pause(350, rate);
  if (generation !== mine) return;
  await playUiClip(tail, lang, rate);
}
```
In `speakSwap`, replace the `if (word.wordId && word.hasAudio) { await playMedia(...) } else { await playUiClip(word.text, "fil", rate); }` block with `await playWordClip(word, rate);`.

- [ ] **Step 4: Strings** (`src/lib/i18n.ts`, `session`, both languages). Task 3's `submitAttempt` already refers to `t.learnedIt`, so it is added here, not in Task 4. English, beside `nowYouTry`:

```ts
    modelLead: "This word is",
    modelConfirm: "That's right!",
    modelYourTurn: "Your turn!",
    learnedIt: "You've learned it!",
```
and change `nowYouTry: "Now you try it!",` → `nowYouTry: "Your turn!",`; `retryKeepGoing: "Good try. We'll practice this word again soon.",` → `retryKeepGoing: "Good try. We'll come back to this word.",`.
Filipino:

```ts
    modelLead: "Ang salitang ito ay",
    modelConfirm: "Tama!",
    modelYourTurn: "Ikaw naman!",
    learnedIt: "Natutunan mo na!",
```
(No emoji in spoken strings: the voice would read it aloud. The screen adds 🎉 in JSX.)
and `nowYouTry: "Ngayon, subukan mo!",` → `nowYouTry: "Ikaw naman!",`; `retryKeepGoing: "Magandang subok. Babalikan natin ang salitang ito.",` → `retryKeepGoing: "Magandang subok. Babalikan natin ito.",`.

- [ ] **Step 5: Use it in `ExerciseSession.tsx`**
  - Import `speakModel` from `@/lib/tts`.
  - State and helpers, after the `retry` state:

```tsx
  /**
   * True while LEXORA is modeling a word. The mic waits for it, so a child who
   * presses early does not record the app's own voice, and never waits longer
   * than MODEL_CAP_MS, so a clip that fails to load cannot trap them.
   */
  const [modelPlaying, setModelPlaying] = useState(false);
  const modelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
```
and, as module scope above the component: `const MODEL_CAP_MS = 8000;`
and inside the component, after `sayTarget`:

```tsx
  /**
   * Model a word: a lesson ends with "Ikaw naman!", a correction ends on the
   * word, a confirmation starts "Tama!". `tail` replaces the closing phrase.
   */
  const playModel = useCallback(
    async (it: ExerciseItem, kind: "lesson" | "correction" | "confirm", tail?: string) => {
      setModelPlaying(true);
      await Promise.race([
        speakModel(
          { wordId: it.wordId, hasAudio: it.hasAudio, text: it.target, version: it.audioVersion },
          kind === "confirm" ? t.modelConfirm : t.modelLead,
          lang,
          settings.ttsRate,
          tail ?? (kind === "lesson" ? t.modelYourTurn : undefined)
        ),
        new Promise((r) => setTimeout(r, MODEL_CAP_MS)),
      ]);
      setModelPlaying(false);
    },
    [t, lang, settings.ttsRate]
  );

  /** Start a model after `delayMs`, holding the mic from now so it cannot be pressed in the gap. */
  const scheduleModel = useCallback(
    (it: ExerciseItem, kind: "lesson" | "correction" | "confirm", delayMs: number, tail?: string) => {
      if (modelTimer.current) clearTimeout(modelTimer.current);
      setModelPlaying(true);
      modelTimer.current = setTimeout(() => void playModel(it, kind, tail), delayMs);
    },
    [playModel]
  );
```
  `sayTarget` is a plain function declared below `beginItem`; `playModel`/`scheduleModel` must be declared **above** `beginItem` (they do not use `sayTarget`).
  - In `beginItem`, at its start (after `setRetry(null);`): `if (modelTimer.current) clearTimeout(modelTimer.current); setModelPlaying(false);`.
  - In `submitAttempt`, replace

```tsx
    playChime(correct);
    if (!correct) {
      // Immediate corrective feedback: hear the right word, then take a turn.
      // Count the syllables plays its parts instead (SyllableCount).
      if (type !== "SYLLABLES") setTimeout(() => sayTarget(), 700);
      if (isOral && micOk) setRetry("offered");
    }
```
with

```tsx
    playChime(correct);
    if (isOral) {
      // The model always follows the child's own reading (spec 2026-10-16):
      // "Ang salitang ito ay bahay" after a miss, "Tama! bahay" after a correct
      // Read aloud reading or a correct practice check.
      if (!correct) {
        scheduleModel(item, "correction", 700);
        if (micOk) setRetry("offered");
      } else if (type === "READ_ALOUD" || data.practice?.mode === "check") {
        // The second correct check ends with "Natutunan mo na!" (Task 4 adds the string).
        scheduleModel(item, "confirm", 700, data.practice?.mastered ? t.learnedIt : undefined);
      }
    } else if (!correct && type !== "SYLLABLES") {
      // Count the syllables plays its parts instead (SyllableCount).
      setTimeout(() => sayTarget(), 700);
    }
```
  - Mic gating: the first-reading mic button `disabled={micState === "processing" || posting}` → `disabled={micState === "processing" || posting || modelPlaying}`; the retry button `disabled={posting}` → `disabled={posting || modelPlaying}`; in `onMicPress` and `onRetryPress`, change `if (micState !== "idle" || posting) return;` to `if (micState !== "idle" || posting || modelPlaying) return;`.
  - In the wrong-feedback block, the "Hear it again" button: `onClick={sayTarget}` → `onClick={isOral ? () => void playModel(item, "correction") : sayTarget}`.
  - In `next()`, before `stopSpeaking();` add `if (modelTimer.current) clearTimeout(modelTimer.current);`.

- [ ] **Step 6: Verify locally** — `npx tsc --noEmit -p .` → 0; `npx eslint src/components/exercises src/lib/tts.ts src/lib/i18n.ts` → 0 errors.

- [ ] **Step 7: Commit and deploy** — message:

```
Model the word after every Read aloud reading

After a correct reading LEXORA says "Tama! bahay"; after a miss or a skip,
"Ang salitang ito ay bahay", with Pakinggan ulit to hear it again and
"Ikaw naman!" for the second attempt (still kept out of every figure). The
phrase is in the app's voice and the word is its own clip. The mic waits for
the model, capped at 8 seconds, so the re-read never records the app.
ui-audit §1c.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
```
Push, wait for Vercel.

- [ ] **Step 8: Run the tests to verify they pass** — `npm run -s audit:ui` → all pass (3 new in §1c); `npm run -s audit:integrity` → 36/36 (it drives Read aloud).

---

### Task 4: Practice shows lessons and checks to the child

**Files:**
- Modify: `src/components/exercises/ExerciseSession.tsx`, `src/app/(app)/practice/page.tsx`, `src/lib/i18n.ts`, `scripts/generate-instruction-audio.ts`
- Test: `tests/ui-audit.mjs` (new section 1d), `tests/a11y-audit.mjs`

**Interfaces:**
- Consumes: `ExerciseItem.practice` and the response's `practice: PracticeProgress | null` (Task 2); `playModel`, `scheduleModel`, `modelPlaying` (Task 3).
- Consumes also: `session.learnedIt` (added in Task 3).
- Produces: i18n `session.listenFirst`, `session.youFirst`, `session.checkFirst`, `session.checkProgress(n)`, `session.tomorrowAlone`.

- [ ] **Step 1: Write the failing tests** — in `tests/ui-audit.mjs`, add `api` to the import from `./helpers.mjs`, then after section 1c:

```js
section("[1d] Practice teaches first, then checks on a later day");
{
  // Two Read aloud misreads put two words on this learner's list.
  const pWords = await query(`SELECT id, text FROM "Word" WHERE level = 1 AND NOT "isPseudo" ORDER BY text DESC LIMIT 2`);
  for (const w of pWords) {
    await api("/api/attempts", {
      cookie: learner.cookie,
      method: "POST",
      body: { activityType: "READ_ALOUD", wordId: w.id, target: w.text, browserTranscript: "zzzz", responseMs: 1500 },
    });
  }
  const openPractice = async () => {
    const pp = await ctx.newPage();
    watch(pp, "learner:practice");
    await pp.goto(`${BASE}/practice/session`, { waitUntil: "networkidle" });
    await pp.locator("button:has-text('Start!')").click();
    return pp;
  };
  const lessonPage = await openPractice();
  const lessonLabel = await lessonPage.locator("text=Listen first").first().waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
  check("a word new to Practice is a lesson, labelled “Listen first”", lessonLabel);
  await lessonPage.close();

  // A day passes for every word on the list: each is now a check.
  await query(
    `UPDATE "PracticeItem" SET "lastTaughtOn" = CURRENT_DATE - 1, "lastSeenOn" = CURRENT_DATE - 1 WHERE "learnerId" = $1`,
    [learner.learnerId]
  );
  const checkPage = await openPractice();
  const checkLabel = await checkPage.locator("text=You first").first().waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
  check("a word taught on an earlier day is a check, labelled “You first”", checkLabel);
  await checkPage.close();

  const listPage = await ctx.newPage();
  await listPage.goto(`${BASE}/practice`, { waitUntil: "networkidle" });
  check(
    "the practice list shows progress toward reading each word alone",
    (await listPage.locator("[aria-label*='read on your own']").count()) >= 1
  );
  await listPage.close();
}
```
In `tests/a11y-audit.mjs` section [4], after the syllables mid-exercise scan:

```js
await page.goto(`${BASE}/practice/session`, { waitUntil: "networkidle" });
const practiceStart = page.locator("button:has-text('Start!')");
if (await practiceStart.count()) {
  await practiceStart.click();
  await page.locator("button[aria-label]").first().waitFor({ timeout: 30000 });
  allViolations.push(...(await scan(page, "/practice/session (mid-exercise)")));
}
```

- [ ] **Step 2: Run to verify they fail** — `npm run -s audit:ui` → FAIL `a word new to Practice is a lesson, labelled “Listen first”`.

- [ ] **Step 3: Strings** (`src/lib/i18n.ts`, `session`). English:

```ts
    listenFirst: "Listen first",
    youFirst: "You first",
    checkFirst: "Try it on your own first!",
    checkProgress: (n: number) => `✓ ${n} of 2 read on your own`,
    tomorrowAlone: "Tomorrow you'll try these on your own!",
```
Filipino:

```ts
    listenFirst: "Pakinggan muna",
    youFirst: "Ikaw muna",
    checkFirst: "Subukan mo muna!",
    checkProgress: (n) => `✓ ${n} sa 2 nang mag-isa`,
    tomorrowAlone: "Bukas, susubukan mo na itong mag-isa!",
```
Change `session.intro.PRACTICE.how` — English: `"LEXORA says each new word first, then it's your turn. Read a word on your own on two different days to learn it. ⭐"`; Filipino: `"Sasabihin muna ni LEXORA ang bawat bagong salita, saka ikaw naman. Basahin ito nang mag-isa sa dalawang magkaibang araw para matutunan. ⭐"`. Change `practice.streakAria` — English: ``(s: number) => `${s} of 2 read on your own` ``; Filipino: ``(s) => `${s} sa 2 nang mag-isa` ``.

- [ ] **Step 4: Practice in `ExerciseSession.tsx`**
  - State: `const [practiceResult, setPracticeResult] = useState<{ mode: "lesson" | "check"; streak: number; mastered: boolean } | null>(null);` and reset it in `beginItem` (`setPracticeResult(null);`).
  - In `beginItem`, after the receptive auto-play block:

```tsx
      // Practice: a lesson models the word first; a check asks the child to
      // read it alone (spec 2026-10-16, §3).
      if (next?.practice && type === "PRACTICE") {
        if (next.practice.mode === "lesson") scheduleModel(next, "lesson", 350);
        else setTimeout(() => void speakUi(t.checkFirst, lang, settings.ttsRate), 350);
      }
```
  and add `scheduleModel`, `lang`, `t.checkFirst` to `beginItem`'s dependency list.
  - In `submitAttempt`, after `setFeedback(...)`: `if (data.practice) setPracticeResult(data.practice);`.
  - Card label: inside the oral block, immediately before the `<div className="flex items-center justify-center gap-2">` that holds `t.readWordAloud`, add:

```tsx
            {type === "PRACTICE" && item.practice && (
              <p
                className={`mx-auto mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-extrabold ${
                  item.practice.mode === "lesson" ? "bg-peach-soft text-peach-deep" : "bg-primary-soft text-primary"
                }`}
              >
                {item.practice.mode === "lesson" ? <Ear size={16} /> : <Mic size={16} />}
                {item.practice.mode === "lesson" ? t.listenFirst : t.youFirst}
              </p>
            )}
```
  (re-add `Ear` to the lucide import). In the same oral block, the instruction line `{t.readWordAloud}` becomes `{type === "PRACTICE" && item.practice?.mode === "check" ? t.checkFirst : t.readWordAloud}`, so a check also says "Subukan mo muna!" on screen.
  - Correct-feedback progress: inside the correct-feedback box, after the "Magaling" line:

```tsx
                {practiceResult?.mode === "check" && (
                  <p className="mt-2 text-base font-extrabold text-ink">
                    {practiceResult.mastered ? `${t.learnedIt} 🎉` : t.checkProgress(practiceResult.streak)}
                  </p>
                )}
```
  - Intro note: in the intro render, after the `<p>{intro.how}</p>`:

```tsx
        {type === "PRACTICE" && items.length > 0 && items.every((i) => i.practice?.seenToday) && (
          <p className="mt-3 rounded-xl bg-primary-soft px-4 py-2.5 text-sm font-bold text-primary">
            {t.tomorrowAlone}
          </p>
        )}
```

- [ ] **Step 5: Practice list page** (`src/app/(app)/practice/page.tsx`): no code change beyond the aria string from Step 3 — the two stars already show `item.streak`, which is now correct checks.

- [ ] **Step 6: Pre-generate the phrases** — in `scripts/generate-instruction-audio.ts` `phrasesFor`, before `return`, add:

```ts
  // The model's phrases (spec 2026-10-16), said before or after a word's clip.
  out.push(
    d.session.modelLead,
    d.session.modelConfirm,
    d.session.modelYourTurn,
    d.session.checkFirst,
    d.session.learnedIt
  );
```

- [ ] **Step 7: Verify locally** — `npx tsc --noEmit -p .` → 0; eslint on the changed files → 0 errors.

- [ ] **Step 8: Commit and deploy** — message:

```
Show the child whether a practice word is a lesson or a check

A lesson card says "Pakinggan muna" and LEXORA models the word first; a check
says "Ikaw muna" and the child reads alone. A correct check shows its progress
("✓ 1 sa 2 nang mag-isa"), the second "Natutunan mo na! 🎉". A run made only
of words already seen today says "Bukas, susubukan mo na itong mag-isa!".
ui-audit §1d; a11y scans Practice mid-item.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
```
Push, wait for Vercel, then `npm run -s audio:instructions` (expect the new phrases "made", 0 failed).

- [ ] **Step 9: Run the tests to verify they pass** — `audit:ui` (3 new in §1d), then `audit:a11y` (1 new scan).

---

### Task 5: The specialist's view and the export

**Files:**
- Create: `src/components/specialist/PracticePanel.tsx`
- Modify: `src/app/(app)/specialist/learner/[id]/page.tsx`, `src/app/api/export/route.ts`, `src/lib/i18n.ts` (specialist strings)
- Test: `tests/ui-audit.mjs` §6, `tests/decoding-audit.mjs` (export column)

**Interfaces:**
- Consumes: `Attempt.practiceMode` (Task 2).
- Produces: `PracticeReading` type and default export `PracticePanel({ readings, lang })`.

- [ ] **Step 1: Write the failing tests** — `tests/ui-audit.mjs` §6, after `check("data-protection panel is present", ...)`:

```js
check(
  "the learner page lists practice readings in their own panel",
  (await sp.locator("text=Practice readings").count()) === 1
);
```
`tests/decoding-audit.mjs:326`: change the array to
`["is_pseudoword", "specialist_correct", "stress_pair", "review_blind", "review_tags", "learner_id", "practice_mode"]`, and after the loop (line 328) add:

```js
check(
  "practice_mode is the last column, so no existing column moved",
  attemptsHeader.split(",").at(-1) === "practice_mode",
  attemptsHeader.split(",").at(-1)
);
```

- [ ] **Step 2: Run to verify they fail** — `audit:ui` → FAIL on the panel; `audit:decoding` → FAIL on `practice_mode`.

- [ ] **Step 3: Strings** (`specialist`, both languages). English:

```ts
    practicePanelTitle: "Practice readings",
    practicePanelSub:
      "Readings from the practice list. A lesson is read straight after LEXORA says the word; a check is read alone, on a later day, and only checks move a word toward leaving the list. None of these count toward accuracy, level or agreement.",
    practicePanelEmpty: "No practice readings yet.",
    practiceLesson: "lesson",
    practiceCheck: "check",
    practiceReread: "re-read",
    practiceProgress: (n: number) => `✓ ${n} of 2 checks`,
```
Filipino:

```ts
    practicePanelTitle: "Mga pagbasa sa praktis",
    practicePanelSub:
      "Mga pagbasa mula sa listahan ng praktis. Ang aralin ay binabasa matapos sabihin ni LEXORA ang salita; ang pagsusuri ay binabasa nang mag-isa sa ibang araw, at ang mga pagsusuri lamang ang naglalapit sa salita sa pag-alis sa listahan. Wala sa mga ito ang kasama sa accuracy, level o pagkakasundo.",
    practicePanelEmpty: "Wala pang pagbasa sa praktis.",
    practiceLesson: "aralin",
    practiceCheck: "pagsusuri",
    practiceReread: "muling basa",
    practiceProgress: (n) => `✓ ${n} sa 2 pagsusuri`,
```

- [ ] **Step 4: Create `src/components/specialist/PracticePanel.tsx`**

```tsx
"use client";

import { BookOpenCheck, Play, Check, X } from "lucide-react";
import { getDict, type Lang } from "@/lib/i18n";

export type PracticeReading = {
  id: string;
  word: string;
  date: string;
  mode: "lesson" | "check" | null;
  isRetry: boolean;
  correct: boolean;
  heard: string | null;
  hasAudio: boolean;
};

/**
 * Practice readings, kept apart from the review list (spec 2026-10-16, §5).
 *
 * A lesson is read straight after LEXORA has said the word, and a check on a
 * word taught on an earlier day, so neither measures decoding: they are not in
 * the agreement sample, accuracy or the level. They are worth hearing all the
 * same — whether a taught word holds up alone a day later is the practice
 * list's own evidence. Readings saved before 16 October carry no mode.
 */
export default function PracticePanel({ readings, lang = "en" }: { readings: PracticeReading[]; lang?: Lang }) {
  const t = getDict(lang).specialist;
  const play = (id: string) => new Audio(`/api/attempt-audio/${id}`).play().catch(() => {});

  return (
    <section className="no-print mt-5 rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink">
        <BookOpenCheck size={20} className="text-primary" /> {t.practicePanelTitle}
      </h2>
      <p className="mt-1 max-w-3xl text-sm font-semibold text-ink-muted">{t.practicePanelSub}</p>
      {readings.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">{t.practicePanelEmpty}</p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {readings.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <div className="min-w-36">
                <p className="font-extrabold text-ink">{r.word}</p>
                <p className="text-xs font-semibold text-ink-muted">{r.date}</p>
              </div>
              {r.mode && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    r.mode === "check" ? "bg-primary-soft text-primary" : "bg-peach-soft text-peach-deep"
                  }`}
                >
                  {r.isRetry ? t.practiceReread : r.mode === "check" ? t.practiceCheck : t.practiceLesson}
                </span>
              )}
              <span className="flex flex-1 items-center gap-1.5 text-sm font-semibold text-ink-soft">
                {r.correct ? <Check size={14} className="text-green" /> : <X size={14} className="text-red" />}
                {r.heard ? `“${r.heard}”` : t.rereadNothing}
              </span>
              {r.hasAudio && (
                <button
                  onClick={() => play(r.id)}
                  aria-label={t.playRecordingOf(r.word)}
                  className="rounded-lg p-1.5 text-primary transition hover:bg-primary-soft"
                >
                  <Play size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Learner page** (`src/app/(app)/specialist/learner/[id]/page.tsx`)
  - Add to the big `Promise.all` a query (and its destructured name `practiceRows`):

```ts
    // Practice readings, newest first, for their own panel (never the review list).
    prisma.attempt.findMany({
      where: { learnerId: id, activityType: "PRACTICE" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, target: true, correct: true, transcript: true, createdAt: true, practiceMode: true, isRetry: true },
    }),
```
  - After `const recorded = new Set(...)`:

```ts
  const practiceReadings: PracticeReading[] = practiceRows.map((a) => ({
    id: a.id,
    word: a.target,
    date: formatDate(a.createdAt, dateLocale(lang), { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
    mode: a.practiceMode === "lesson" || a.practiceMode === "check" ? a.practiceMode : null,
    isRetry: a.isRetry,
    correct: a.correct,
    heard: a.transcript,
    hasAudio: recorded.has(a.id),
  }));
```
  - Render `<PracticePanel readings={practiceReadings} lang={lang} />` immediately after `<Rereads pairs={rereads} lang={lang} />`, and import it with its type.
  - Practice-list chip: inside the chip's small text, after the `×missCount` / pinned text and before the reviewed evidence, add `{p.streak > 0 && ` · ${t.practiceProgress(p.streak)}`}`.

- [ ] **Step 6: Export** (`src/app/api/export/route.ts`, `what === "attempts"`): add `practiceMode: true,` to the `select`; append `a.practiceMode ?? "",` as the **last** row cell (after `a.learnerId,`); append to the header after `"learner_id",`:

```ts
          // Practice only: "lesson" (read straight after the word was modeled)
          // or "check" (read alone, on a later day). Blank for every other
          // activity and for practice readings saved before 16 October. Last,
          // so no existing column moves.
          "practice_mode",
```

- [ ] **Step 7: Verify locally** — tsc 0, eslint 0 errors.

- [ ] **Step 8: Commit and deploy** — message:

```
Show practice readings to the specialist, and export their mode

Each learner page gains a Practice panel (lesson, check or re-read, the result,
the recording), apart from the review list that feeds agreement; practice-list
words show their checks. The readings CSV gains practice_mode as its last
column. ui-audit §6 and decoding-audit pin both.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
```

- [ ] **Step 9: Run the tests to verify they pass** — `audit:ui`, then `audit:decoding`, then `audit:reporting` (it reads the exports).

---

### Task 6: Docs and the full production run

**Files:**
- Modify: `docs/user-manual.md`, `docs/data-guide.md`, `docs/proposal-alignment.md`, `docs/consultation-brief.md`, `docs/development-record.md`, `README.md`, `.claude/skills/run-lexora/SKILL.md` (counts)

- [ ] **Step 1: User manual** — in "How Read aloud works, step by step", replace the step that says the correct pronunciation plays then "Now you try it!" with: after every first reading LEXORA models the word ("Tama! *bahay*" after a correct reading; "Ang salitang ito ay *bahay*", **Pakinggan ulit** and **Ikaw naman!** after a miss or skip); the second attempt is saved and excluded from every statistic. Replace the Practice list paragraph ("Two correct readings in a row master a word…") with the lesson/check rule, the two-days mastery, the second-run rule and "Practice readings count toward no figure".
- [ ] **Step 2: Data guide** — in the section on which readings are analysed, state that only Read aloud first readings are measured (Practice and re-reads are excluded) and document `practice_mode` in the readings-export column list.
- [ ] **Step 3: Proposal alignment** — §2 Objective 3 and 4 rows: "practice list built from Read aloud misreads; taught as lessons and checked on later days"; add **Suggested manuscript wording** under §4 Data Set:

> After each reading, the system models the target word for the learner ("Ang salitang ito ay …") and invites a second attempt, which is recorded separately and excluded from all measures. Words on the personalized practice list are first taught by modeling and then checked, without modeling, on a later day; a word leaves the list after two correct checks on different days. Only the learner's first, unmodeled reading of a word in the Read Aloud activity enters the reading-accuracy, adaptive-difficulty and agreement measures.

- [ ] **Step 4: Consultation brief** — a short section "Teaching after reading, and practice lessons (16 October)" describing the sequence for the specialists, ending with: "Decide: ☐ the model wording as given ☐ change to: ____".
- [ ] **Step 5: Development record** — §8.24 "Read aloud teaches, Practice checks, 16 October": the conflict with Objectives 2–4, the activity split, the lesson/check rule, the measures in one place, the 44 demo practice readings leaving the figures, the mic gating, and the tests.
- [ ] **Step 6: Full run** — run all ten suites against production one at a time; record the counts in README, user manual, SKILL.md and development record §9.1 (Edit tool; check `git diff --stat` matches the intended lines).
- [ ] **Step 7: Commit and push** — message:

```
Document the teaching sequence and practice lessons, and recount

User manual, data guide, proposal alignment (manuscript wording for the
teaching sequence and the practice list), consultation brief and development
record §8.24. All ten suites pass against production; counts updated.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
```
