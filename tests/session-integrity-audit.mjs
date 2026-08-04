/**
 * Session-integrity audit.
 *
 * Two faults that only appear once a learner does something ordinary partway
 * through an activity:
 *
 *  1. Switching the UI language mid-exercise. The toggle calls router.refresh(),
 *     which re-runs the server component; the words are picked at random per
 *     request, so a refresh dealt a different set into a component that stayed
 *     mounted. The run's state survived while the words changed underneath —
 *     feedback showing for a word no longer on screen, and the next answer
 *     recorded against a word the child never saw. Language belongs to the
 *     interface; the words belong to the run.
 *
 *  2. Leaving an exercise partway. Totals were written only on the final
 *     screen, so the minutes were discarded — the words and accuracy survived,
 *     because attempts save one by one, but the time did not. It now flushes on
 *     the way out, and marks the activity completed only when it really is.
 *
 * Both are checked in a browser, because both are about what survives a real
 * navigation.
 *
 *   npm run audit:integrity -- https://your-app.vercel.app
 */
import { chromium } from "playwright-core";
import {
  BASE,
  api,
  check,
  section,
  report,
  closeDb,
  query,
  one,
  createTestLearner,
  deleteTestLearner,
  cleanupTestAccounts,
  until,
} from "./helpers.mjs";

console.log(`Session-integrity audit against ${BASE}`);

const browser = await chromium.launch({
  channel: process.env.AUDIT_BROWSER ?? "msedge",
  headless: true,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});

async function pageFor(cookieHeader) {
  const ctx = await browser.newContext({ permissions: ["microphone"] });
  await ctx.addCookies(
    cookieHeader.split("; ").map((part) => {
      const [name, ...rest] = part.split("=");
      return { name, value: rest.join("="), url: BASE, httpOnly: true, sameSite: "Lax" };
    })
  );
  return { ctx, page: await ctx.newPage() };
}

/** The big word currently on screen. */
async function shownWord(page) {
  return (await page.locator("main p.wrap-break-word").first().textContent())?.trim() ?? "";
}

/**
 * Switch the interface language and wait until the new copy is actually on
 * screen.
 *
 * The toggle triggers a server round-trip, so a fixed sleep is both flaky and
 * unsound: if it elapses before the refresh lands, "the word did not change" is
 * true only because nothing has happened yet, and the assertion passes without
 * testing anything. Waiting for the copy to change proves the refresh completed
 * — which is the moment the words were at risk of being swapped.
 */
async function switchLanguage(page, to) {
  const marker =
    to === "fil" ? /Pindutin|Basahin|Laktawan/i : /Press the mic|Read this word aloud|Skip this word/i;
  await page.getByRole("button", { name: to === "fil" ? "Filipino" : "English" }).click();
  await page.locator("main").getByText(marker).first().waitFor({ timeout: 30000 });
}

async function main() {
  /* ── 1. the language toggle must not change the words ────────────────── */

  section("[1] switching language mid-exercise keeps the same word");

  const learner = await createTestLearner("langswitch");
  const { ctx, page } = await pageFor(learner.cookie);

  await page.goto(`${BASE}/exercises/read-aloud`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Start!/i }).click();
  await page.getByRole("button", { name: /Skip this word/i }).waitFor({ timeout: 30000 });

  const before = await shownWord(page);
  check("a word is shown to read", before.length > 0, `“${before}”`);

  // The wait inside switchLanguage is the proof the refresh landed; the
  // assertion that follows is therefore about a real re-render, not a no-op.
  await switchLanguage(page, "fil");
  const afterFil = await shownWord(page);
  check("the word is unchanged after switching to Filipino", afterFil === before, `“${afterFil}”`);

  await switchLanguage(page, "en");
  const afterEn = await shownWord(page);
  check("the word is still unchanged after switching back", afterEn === before, `“${afterEn}”`);

  /* ── 2. the same, while feedback is on screen ────────────────────────── */

  section("[2] switching language while feedback is showing");

  // Skipping counts as no response — a miss, without synthesising speech.
  await page.getByRole("button", { name: /Skip this word/i }).click();
  await page.getByRole("button", { name: /Next word|Finish/i }).waitFor({ timeout: 45000 });

  const inFeedback = await page.locator("main").innerText();
  check("feedback is on screen", /Not quite/i.test(inFeedback), "missed the word");

  // In the feedback phase the word is shown as syllables, so wait on the
  // Filipino feedback copy rather than the item-phase prompts.
  await page.getByRole("button", { name: "Filipino" }).click();
  await page.locator("main").getByText(/Hindi pa tama|Ngayon, subukan mo/i).first().waitFor({
    timeout: 30000,
  });

  const feedbackFil = await page.locator("main").innerText();
  check(
    "the word under the feedback did not change",
    feedbackFil.includes(before),
    `looking for “${before}” in the feedback panel`
  );
  check(
    "the feedback is still showing, now in Filipino",
    /Hindi pa tama|Ngayon, subukan mo/i.test(feedbackFil),
    feedbackFil.replace(/\s+/g, " ").slice(0, 70)
  );

  await ctx.close();
  await deleteTestLearner(learner.email);

  /* ── 3. leaving partway still records the practice ───────────────────── */

  section("[3] leaving an exercise partway keeps the minutes");

  const quitter = await createTestLearner("partial");
  const { ctx: qctx, page: qpage } = await pageFor(quitter.cookie);

  await qpage.goto(`${BASE}/exercises/read-aloud`, { waitUntil: "networkidle" });
  await qpage.getByRole("button", { name: /Start!/i }).click();

  const skip = qpage.getByRole("button", { name: /Skip this word/i });
  const advance = qpage.getByRole("button", { name: /Next word|Finish/i });

  // Answer two of the eight words, then walk away to the dashboard.
  for (let i = 0; i < 2; i++) {
    await skip.waitFor({ timeout: 30000 });
    await skip.click();
    await advance.waitFor({ timeout: 45000 });
    await advance.click();
  }
  await qpage.getByRole("link", { name: /^Dashboard$/ }).first().click();
  // Leaving mid-activity is confirmed now — section [6] covers the dialog
  // itself; here it is just the door out.
  await qpage.getByRole("dialog").waitFor({ timeout: 15000 }).catch(() => {});
  await qpage.getByRole("button", { name: /^(Leave|Umalis)$/i }).click();
  await qpage.waitForURL(/\/dashboard/, { timeout: 15000 });

  // The flush goes out as the exercise unmounts, so there is nothing on screen
  // to wait for — poll until it lands rather than guessing how long it takes.
  const partial = await until(() =>
    one(
      `SELECT total, correct, "durationMs", "completedAt"
         FROM "ActivitySession"
        WHERE "learnerId" = $1 AND total > 0 ORDER BY "createdAt" DESC LIMIT 1`,
      [quitter.learnerId]
    )
  );

  check("the partial session recorded the words answered", partial?.total === 2, `total=${partial?.total}`);
  check(
    "the time spent was saved, not discarded",
    (partial?.durationMs ?? 0) > 0,
    `${partial?.durationMs}ms`
  );
  check(
    "the activity is not marked completed",
    partial?.completedAt === null,
    String(partial?.completedAt)
  );

  // The run above lasts seconds, which honestly rounds to zero minutes. To
  // check that partial sessions reach the dashboard at all, give this learner
  // one with real time on it — abandoned, so it must count towards minutes
  // practiced but not towards activities completed.
  await query(
    `INSERT INTO "ActivitySession"
       (id, "learnerId", type, correct, total, "durationMs", "createdAt", "completedAt")
     VALUES ($1, $2, 'READ_ALOUD', 3, 5, 420000, NOW() - interval '1 hour', NULL)`,
    [`ses${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`, quitter.learnerId]
  );

  await qpage.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  const dash = await qpage.locator("main").innerText();
  const readNumber = (label) => Number(dash.match(new RegExp(`(\\d+)\\s*\\n?\\s*${label}`, "i"))?.[1] ?? -1);

  check(
    "an abandoned session's minutes still reach the dashboard",
    readNumber("Minutes practiced") >= 7,
    `minutes reads ${readNumber("Minutes practiced")} (7 minutes abandoned)`
  );
  check(
    "an abandoned session is not counted as an activity completed",
    readNumber("Activities completed") === 0,
    `activities reads ${readNumber("Activities completed")}`
  );

  /* ── 4. finishing marks it completed ─────────────────────────────────── */

  section("[4] finishing an activity marks it completed");

  await qpage.goto(`${BASE}/exercises/syllables`, { waitUntil: "networkidle" });
  await qpage.getByRole("button", { name: /Start!/i }).click();

  const option = qpage.locator("main button").filter({ hasText: /^[1-4]$/ }).first();

  for (let i = 0; i < 8; i++) {
    await option.waitFor({ state: "visible", timeout: 30000 });
    await option.click();
    // Wait for the scoring round-trip to land rather than guessing at it: the
    // last item's button reads "Finish", not "Next word", and a fixed sleep
    // that expires before either appears sends the run after a button that
    // will never exist.
    await advance.waitFor({ state: "visible", timeout: 45000 });
    const label = (await advance.textContent()) ?? "";
    await advance.click();
    if (/Finish/i.test(label)) break;
  }

  await qpage.locator("text=/Amazing!|Great work!|Good try!/").first().waitFor({ timeout: 30000 });

  const finished = await until(() =>
    one(
      `SELECT total, "completedAt" FROM "ActivitySession"
        WHERE "learnerId" = $1 AND type = 'SYLLABLES' AND "completedAt" IS NOT NULL
        ORDER BY "createdAt" DESC LIMIT 1`,
      [quitter.learnerId]
    )
  );
  check("the finished activity is marked completed", Boolean(finished?.completedAt), String(finished?.completedAt));

  const counted = await one(
    `SELECT COUNT(*)::int c FROM "ActivitySession"
      WHERE "learnerId" = $1 AND "completedAt" IS NOT NULL`,
    [quitter.learnerId]
  );
  check(
    "only the finished one counts as an activity completed",
    counted.c === 1,
    `${counted.c} completed of 2 sessions`
  );

  await qctx.close();
  await deleteTestLearner(quitter.email);

  /* ── 5. a dropped connection mid-word ────────────────────────────────── */

  section("[5] the wifi drops in the middle of a word");

  // The study runs on school wifi and tablets, so this is an expected
  // condition. It used to leave the child staring at "Checking…" with every
  // control disabled, no message, and no recovery when the link came back —
  // the rejected fetch skipped the rest of the handler, so the busy flag was
  // never cleared. Only a page reload escaped, which a seven-year-old will not
  // think to do and which loses the session.
  const dropped = await createTestLearner("offline");
  const { ctx: octx, page: opage } = await pageFor(dropped.cookie);

  await opage.goto(`${BASE}/exercises/read-aloud`, { waitUntil: "networkidle" });
  await opage.getByRole("button", { name: /Start!/i }).click();
  const oskip = opage.getByRole("button", { name: /Skip this word/i });
  await oskip.waitFor({ timeout: 30000 });

  const pageErrors = [];
  opage.on("pageerror", (e) => pageErrors.push(String(e)));

  await octx.setOffline(true);
  await oskip.click();
  await opage
    .getByText(/lost the internet connection|Nawala ang internet/i)
    .first()
    .waitFor({ timeout: 30000 })
    .catch(() => {});

  const offlineText = await opage.locator("main").innerText();
  check(
    "the child is told the connection dropped",
    /lost the internet connection|Nawala ang internet/i.test(offlineText),
    offlineText.replace(/\s+/g, " ").slice(0, 80)
  );
  check(
    "the screen is not stuck on 'Checking…'",
    !/Checking…|Sinusuri/i.test(offlineText),
    "busy state cleared"
  );
  check(
    "the controls are usable again",
    await oskip.isEnabled(),
    "the learner can answer once the link is back"
  );
  check("no unhandled error is thrown", pageErrors.length === 0, pageErrors.slice(0, 1).join(" "));

  await octx.setOffline(false);
  await oskip.click();
  const recovered = await opage
    .getByRole("button", { name: /Next word|Finish/i })
    .waitFor({ timeout: 45000 })
    .then(() => true)
    .catch(() => false);
  check("the exercise carries on once the wifi returns", recovered, "no reload needed");

  await octx.close();
  await deleteTestLearner(dropped.email);

  /* ── 6. leaving mid-activity is confirmed, and the claim is true ─────── */

  section("[6] the leave guard, and whether it tells the truth");

  const guarded = await createTestLearner("guard");
  const { ctx: gctx, page: gpage } = await pageFor(guarded.cookie);

  await gpage.goto(`${BASE}/exercises/read-aloud`, { waitUntil: "networkidle" });

  // Instructions are written for children who cannot reliably read them, so
  // every prompt must be listenable.
  check(
    "the intro instruction can be played",
    (await gpage.getByRole("button", { name: /Listen to the instruction/i }).count()) > 0,
    "speak button present"
  );

  await gpage.getByRole("button", { name: /Start!/i }).click();
  const gskip = gpage.getByRole("button", { name: /Skip this word/i });
  await gskip.waitFor({ timeout: 30000 });
  check(
    "the instruction can be replayed mid-exercise",
    (await gpage.getByRole("button", { name: /Listen to the instruction/i }).count()) > 0,
    "speak button present"
  );

  // Answer one word so there is something to be truthful about.
  await gskip.click();
  await gpage.getByRole("button", { name: /Next word|Finish/i }).waitFor({ timeout: 45000 });

  await gpage.getByRole("link", { name: /^Dashboard$/ }).first().click();
  await gpage.getByRole("dialog").waitFor({ timeout: 15000 }).catch(() => {});
  const dialog = gpage.getByRole("dialog");

  check("leaving mid-activity asks first", (await dialog.count()) > 0, "dialog shown");
  check(
    "the exercise is still on screen behind it",
    gpage.url().includes("/exercises/read-aloud"),
    gpage.url()
  );

  const dialogText = (await dialog.count()) ? await dialog.innerText() : "";
  // The wording matters. Telling a child their work will be lost would be
  // false — attempts save as they are scored and the minutes flush on the way
  // out — and false in a direction that discourages stopping when they need to.
  check(
    "it does not claim the work will be lost",
    !/will not be (saved|recorded)|mawawala|hindi ma-?save/i.test(dialogText),
    dialogText.replace(/\s+/g, " ").slice(0, 90)
  );

  await gpage.getByRole("button", { name: /Keep reading|Magpatuloy/i }).click();
  check(
    "'keep reading' stays in the activity",
    gpage.url().includes("/exercises/read-aloud") &&
      (await gpage.getByRole("dialog").count()) === 0,
    "dismissed"
  );

  await gpage.getByRole("link", { name: /^Dashboard$/ }).first().click();
  await gpage.getByRole("dialog").waitFor({ timeout: 15000 }).catch(() => {});
  await gpage.getByRole("button", { name: /^(Leave|Umalis)$/i }).click();
  await gpage.waitForURL(/\/dashboard/, { timeout: 20000 });
  check("'leave' actually leaves", gpage.url().includes("/dashboard"), gpage.url());

  const kept = await until(() =>
    one(
      `SELECT total, "durationMs" FROM "ActivitySession"
        WHERE "learnerId" = $1 AND total > 0 ORDER BY "createdAt" DESC LIMIT 1`,
      [guarded.learnerId]
    )
  );
  check(
    "and the work really was kept, as the dialog said",
    Boolean(kept) && kept.total > 0 && kept.durationMs > 0,
    kept ? `${kept.total} word(s), ${kept.durationMs}ms` : "nothing saved — the dialog lied"
  );

  await gctx.close();
  await deleteTestLearner(guarded.email);

  /* ── 7. instructions are spoken by the app, not by the device ────────── */

  section("[7] spoken instructions");

  // The browser's own engine cannot do this job: virtually no device ships a
  // Filipino voice, so it reads Tagalog with English phonics and produces
  // something a child cannot follow. Clips come from the same neural voice that
  // pronounces the words, so the app speaks with one voice throughout.
  const speaker = await createTestLearner("speech");
  const cookie = speaker.cookie;

  const FIL = "Pindutin ang mikropono, tapos sabihin nang malinaw ang salita.";
  const say = (text, lang) =>
    api(`/api/speech?lang=${lang}&text=${encodeURIComponent(text)}`, { cookie });

  const t0 = Date.now();
  const warm = await say(FIL, "fil");
  const warmMs = Date.now() - t0;
  const bytes = warm.ok ? Buffer.from(await warm.arrayBuffer()) : Buffer.alloc(0);
  // Either an ID3 tag or a bare MPEG frame sync — both are valid MP3.
  const head = bytes.subarray(0, 3).toString("hex");
  const isMp3 = head.startsWith("494433") || head.startsWith("fff");

  check("a pre-generated instruction is served", warm.status === 200, `HTTP ${warm.status}`);
  check("it is audio, not a placeholder", isMp3 && bytes.length > 5000, `${head}, ${bytes.length}B`);
  check(
    "and it comes from the cache, not a fresh synthesis",
    warmMs < 2000,
    `${warmMs}ms — run \`npm run audio:instructions\` if this is slow`
  );

  // A phrase nobody has said before must still work: the child's name and the
  // streak count vary, so not everything can be generated ahead of time.
  const novel = `Isang bagong pangungusap ${Date.now()}.`;
  const first = await say(novel, "fil");
  const second = await say(novel, "fil");
  check("an unseen phrase is synthesized on demand", first.status === 200, `HTTP ${first.status}`);
  check("and is cached thereafter", second.status === 200, "second call served");

  const filClip = Buffer.from(await (await say(FIL, "fil")).arrayBuffer());
  const enClip = Buffer.from(
    await (await say("Press the microphone, then say the word clearly.", "en")).arrayBuffer()
  );
  check("the two languages give different audio", !filClip.equals(enClip), "distinct clips");

  const etag = warm.headers.get("etag");
  const revalidated = await api(`/api/speech?lang=fil&text=${encodeURIComponent(FIL)}`, {
    cookie,
    headers: { "if-none-match": etag },
  });
  check("a repeat play revalidates instead of re-downloading", revalidated.status === 304, "304");

  const tooLong = await say("a".repeat(400), "fil");
  const anonymous = await api(`/api/speech?lang=fil&text=hello`);
  check("over-long text is refused", tooLong.status === 413, `HTTP ${tooLong.status}`);
  check("the route needs a session", anonymous.status === 401, `HTTP ${anonymous.status}`);

  // Anyone can register as a learner without a code, and a cache miss writes to
  // the database — so without a ceiling a script could mint unique strings
  // until the 500MB the study lives in was full. Replays must stay free, or the
  // ceiling would punish the ordinary case it exists to protect.
  //
  // Hammering one endpoint is also what a bot looks like, and the host says so:
  // Vercel answers 403 with x-vercel-mitigated=challenge partway through a run
  // like this. Those responses say nothing about the app, and reading them as
  // failures sent me chasing a bug that was not there — so they are detected
  // and reported as a skip rather than counted.
  const budgeted = await createTestLearner("quota");
  const challenged = (res) => res.headers.get("x-vercel-mitigated") === "challenge";
  const askAs = (text) =>
    api(`/api/speech?lang=fil&text=${encodeURIComponent(text)}`, { cookie: budgeted.cookie });

  let replays = 0;
  let blocked = false;
  for (let i = 0; i < 25 && !blocked; i++) {
    const res = await askAs(FIL);
    if (challenged(res)) blocked = true;
    else if (res.ok) replays++;
  }

  if (blocked) {
    check(
      "speech budget skipped — the host challenged the traffic",
      true,
      "run `npm run audit:integrity` against localhost to exercise it"
    );
  } else {
    check("replaying a cached line is never rationed", replays === 25, `${replays}/25 served`);

    const stamp = Date.now();
    let minted = 0;
    let refused = 0;
    for (let i = 0; i < 26 && !blocked; i++) {
      const res = await askAs(`Pagsubok bilang ${stamp}-${i}.`);
      if (challenged(res)) blocked = true;
      else if (res.status === 200) minted++;
      else if (res.status === 429) refused++;
    }

    if (blocked) {
      check("speech budget partially skipped — challenged mid-run", true, `${minted} minted first`);
    } else {
      check(
        "minting new phrases is capped",
        refused > 0 && minted <= 20,
        `${minted} synthesized, ${refused} refused`
      );
      check(
        "and a cached line still plays after the cap is hit",
        (await askAs(FIL)).ok,
        "the ordinary path is unaffected"
      );
    }
    await query(`DELETE FROM "SpeechClip" WHERE text LIKE $1`, [`Pagsubok bilang ${stamp}%`]);
  }

  await deleteTestLearner(budgeted.email);

  await deleteTestLearner(speaker.email);

  report("Session-integrity audit");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser.close();
    // A suite that throws partway skips its own deletes and leaves throwaway
    // accounts in the study database. Sweeping here means a failed run cleans
    // up after itself instead of leaving the next person to notice.
    const removed = await cleanupTestAccounts().catch(() => 0);
    if (removed) console.log(`\nCleaned up ${removed} leftover test account(s).`);
    await closeDb();
  });
