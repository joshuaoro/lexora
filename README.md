# LEXORA

**Design and Development of an AI-Assisted Reading and Progress Tracking Web Application for Persons with Dyslexia**

LEXORA is a web-based reading support and progress-tracking application focused on two foundational, word-level reading skills: **phonological awareness** and **single-word decoding**. Reading materials are Filipino (Tagalog) words sequenced by the **Marungko Approach** and organized by Structured Literacy principles.

> LEXORA is a reading **support** tool. It does not diagnose dyslexia, does not provide clinical assessment, and is not a substitute for licensed educators, reading specialists, speech-language pathologists, or health-care professionals.

---

## Features → study objectives

| # | Objective | Where it lives |
|---|-----------|----------------|
| 1 | Dyslexia-friendly display customization (fonts, size, letter/word spacing, line height, color overlays, focus ruler), TTS with synchronized word highlighting, adjustable reading speed | **Settings** page, **Reader** page. The focus ruler is pointer-driven, so it works with mouse, touch and stylus |
| 2 | Pre-trained ASR scoring of word-level oral reading + specialist agreement check, with the acceptance threshold calibrated against those specialist verdicts | **Read aloud** exercise; **Specialist → learner → Scoring reliability check** (records audio, specialist agrees/disputes, agreement % is computed) |
| 3 | AI-assisted reading assessment: immediate pronunciation feedback + personalized practice word list from frequently misread words | Exercise feedback panels; a corrective **"Now you try it!"** re-read so the last time a child says a missed word they say it right; **Practice list** (auto-populated on misreads) |
| 4 | Adaptive word-level exercises driven by recorded reading accuracy | Adaptive level 1–5 (`src/lib/adaptive.ts`); promotion also requires that decoding is not slowing, since accuracy alone is the weaker marker in a transparent orthography; specialists can override per learner |
| 5 | Progress-tracking and analytics dashboard (accuracy, error patterns, completed activities) | **Dashboard**, **Reports** (printable, leading with accuracy *and* typical time per word), **Specialist** learner views, **Cohort overview** (all learners side by side, accuracy per syllable pattern). Reader time counts towards "minutes practiced"; Reader sessions are listed as words heard rather than a score, since nothing is scored there. An activity left partway still counts its minutes but is not an activity *completed* |
| 6 | ISO/IEC 25010 + user-acceptance evaluation | The app is the artifact under evaluation; reports are printable for instrument administration |

### Exercise modules
- **Read aloud** — single-word decoding. The child's reading is recorded and transcribed server-side by a pre-trained **Whisper** model; the recording is kept for specialist review.
- **Listen & choose** — blending / word recognition with look-alike distractors.
- **Count the syllables** — segmentation (pantig), with syllable-by-syllable audio.
- **Rhyme time** — rhyming awareness from a curated item bank.
- **First sound** — sound isolation: which word begins with the same sound.
- **Practice list** — the child's own misread words, revisited until two correct readings in a row master them.
- **Silly words** — the decoding probe. Stage-matched non-words that cannot be read from memory, so they separate decoding from sight-word recall. Assessment only: no audio, no verdict shown to the child, no effect on level or practice, scored afterwards by a specialist listening to the recording. Rests for 7 days after a run.

### Speech recognition (oral reading assessment)
Readings are scored by **`whisper-large-v3-turbo`**, a pre-trained ASR model accessed through Groq's OpenAI-compatible API with the language fixed to Tagalog (`tl`).

**What is and is not adapted.** The acoustic model is pre-trained and stays that way: nothing is fine-tuned, and no learner recording is ever used as training data. What *is* adapted to this population is the **decision layer on top of it** — the similarity at which a transcript counts as a correct reading — which is fitted to reading specialists' own verdicts and reported with the evidence. See [Threshold calibration](#threshold-calibration-fitting-the-decision-layer) below.

This is a deliberate methodological choice, not an omission. Fine-tuning Whisper on this study's data would be unsound three times over: with **five participants** there is no held-out set, so fine-tuning on their recordings and then evaluating on the same five children is training on the test set; using children's voice recordings as training data is a different processing purpose under **RA 10173** from the assessment purpose parents consented to; and the deployment target is serverless, which cannot host a fine-tuned model. Calibrating the decision layer against human labels achieves real adaptation at this sample size, and produces figures that are directly comparable with the published literature.

The target word is deliberately **not** sent as a decoding prompt: biasing the recognizer toward the expected word would hide the very misreadings the system must detect.

Scoring falls back gracefully, and every attempt records which engine scored it (`engine` column, shown as a badge in the specialist review and exported in the CSV):

1. **Whisper** (server) — used whenever `GROQ_API_KEY` is set and reachable.
2. **Web Speech API** (browser) — automatic fallback if the API is missing, rate-limited, or times out.
3. If a recording was captured but neither engine could transcribe it, the attempt is **not saved** and the learner is asked to try again, so unscoreable takes never pollute the study data.

**Setup (one manual step):** create a free key at [console.groq.com](https://console.groq.com) and put it in `.env` as `GROQ_API_KEY`. Without a key the app still works on the browser fallback (Chrome/Edge only).

#### Keeping the recognizer in Filipino
Two safeguards stop the recognizer from turning a correct reading into a scored error:

- A **generic Tagalog prompt** anchors Whisper to Filipino spelling. It never mentions the target word or any word from the bank — that would leak the answer and hide real misreadings.
- **Accepted spellings** per word (Word bank → *Accepted spellings*): loanwords and digraphs come back in English orthography, e.g. `krus` → "cross", `mangga` → "manga", `bulaklak` → "bulaklaq". These are compared **exactly**, so they can never mask a genuine misreading — verified by a control case where a clip saying *bahay* scored against target *buhay* is still marked incorrect.

Reading specialists can add spellings inline as they observe them during testing.

### Threshold calibration: fitting the decision layer
**Specialist → Threshold calibration**, or `/api/export?what=calibration` for the table.

A reading is accepted when its similarity to the target reaches `SCORE_THRESHOLD` (0.95 by
default). That cut-point was reasoned from the word bank against clear synthesized speech —
but the children this is for bring accents, hesitation and a noisy room, so whether it is
set correctly is an empirical question, and every reading a specialist reviews is a
labelled answer to it.

`src/lib/calibration.ts` sweeps the cut-point from 0.50 to 1.00 and, at each value, tallies
the confusion matrix against the specialists' verdicts and reports **accuracy, sensitivity,
specificity, precision, Cohen's κ, Matthews' correlation (MCC) and Youden's J**.

- **MCC leads, not accuracy or F1.** Most readings are correct, so the sample is lopsided:
  a scorer that accepted everything would post a high accuracy and a respectable F1 while
  being useless. MCC only rises when all four cells of the matrix are good
  ([Chicco & Jurman, 2020](https://link.springer.com/article/10.1186/s12864-019-6413-7)).
- **The sweep replays the real rule**, not `score >= t`. `scoreReading()` also accepts an
  approved ASR spelling outright and demands an exact match for words of ≤ 3 letters, both
  of which ignore the threshold — so a naive sweep would report metrics for a classifier
  the app does not run. Verified: a 3-letter near-miss scoring 0.67 is refused at *every*
  threshold, which a naive sweep would have accepted at 0.50–0.66.
- **Comparable figures.** For automatic scoring of children's oral reading, published
  agreement is **κ = .54, human 92% vs ASR 88%** classification accuracy
  ([Frontiers in Education](https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2026.1671946/full)),
  and the best of six ASR systems on Dutch oral reading reached **MCC = 0.63**
  ([arXiv:2306.03444](https://arxiv.org/abs/2306.03444)). Both were measured on
  typically-developing readers, and the first study found agreement was **significantly
  lower for students with disabilities** — which is this entire participant group. Treat
  them as context, not as targets.
- **Guards against over-claiming.** No operating point is recommended below 30 reviewed
  readings. Thresholds within 0.01 MCC of the peak are reported as a **plateau**, because
  a wide flat region means the optimum is weakly identified
  ([Youden index](https://www.sciencedirect.com/topics/medicine-and-dentistry/youden-index))
  and the single best value must not be quoted alone. A 95% interval for the optimum comes
  from 1000 bootstrap resamples.
- **Probe non-words are held out** of the fit and reported separately — they are scored by
  ear precisely because the machine's verdict on a non-word measures the recogniser rather
  than justifying a cut-point.

**The page recommends; it never moves the threshold.** Changing `SCORE_THRESHOLD` mid-study
would mean baseline and endline were scored by different rules. Since the similarity is
stored on every attempt, the sound order is to leave it fixed for the study's duration and
re-score the exported data at analysis time if the calibration warrants it — reporting both
figures.

```bash
npm run calibration:check     # κ/MCC against hand-computed values, and the replay rule
npm run audit:calibration     # end to end, including a deliberately too-strict threshold
```

> **Known limitation for the Validation chapter.** In an integration probe over 25 words (synthesized Filipino speech, not children's voices), Whisper matched the target exactly on 20/25 before variants. Every miss was a **Marungko stage 7 loanword or digraph** (`krus`, `dyip`, `tsinelas`, `mangga`, `bulaklak`), and two of them (`dyip`, `tsinelas`) returned a *different* spelling on each run. The seeded variant list was derived from synthesized speech and should be re-validated against real recordings during the reliability check; stage 7 items warrant closer specialist attention when computing agreement.

### Filipino pronunciation audio
Most devices have no Filipino voice installed, so browser TTS reads Tagalog with English phonics ("bahay" → *buh-HAY*). LEXORA therefore ships **pre-generated neural Filipino audio** for every word in the bank — a whole-word clip and a syllable-by-syllable clip, synthesized once with `fil-PH-BlessicaNeural` and stored in the database (~14 KB each):

```bash
npm run audio:generate              # fill in any missing clips
npm run audio:generate -- --force   # regenerate all (keeps specialist recordings)
```

Playback order is **specialist recording → generated clip → browser TTS**. Custom text typed into the Reader still uses browser TTS.

### Spoken instructions
The same problem applies to the sentences around the words, and more sharply: instructions
exist for the children who *cannot* read the written ones, so a device reading them with
English phonics defeats the point. Instructions are therefore synthesized by the same
voice and served from the database, so the app speaks to a child in one voice rather than
two. A speaker button sits beside every prompt, and the one after **Start** plays itself —
a press satisfies the browser's autoplay rules.

```bash
npm run audio:instructions           # warm the fixed instruction lines, both languages
npm run audio:instructions -- --force
```

Lines are read out of `src/lib/i18n.ts` rather than a copy, so rewording an instruction is
picked up on the next run instead of quietly serving audio of the old wording. Text that
cannot be known ahead of time — a child's name, a streak count — is synthesized on first
use and cached by hash (`SpeechClip`), keyed on voice and rate so changing either yields
new clips rather than stale ones. Measured: a warm line serves in ~200 ms, a cold one takes
about two seconds once. `SPEECH_VOICE` overrides the voice; the browser's own engine
remains only as a fallback for a lost connection.

**Choosing a voice by ear:** `npx tsx scripts/voice-samples.ts` writes the real instruction
lines as mp3s to `voice-samples/` in each candidate voice. "Gentle" is not something a
voice list tells you.

From **Word bank**, a specialist can:
- **🔊 / ba·hay** — hear exactly what learners hear (whole word, or syllable by syllable).
- **🎤 Record** — record the word in their own voice, then **preview it and choose Use this / Redo / discard** before it goes live. Saved recordings are stored separately from the generated clip, so **🗑 Remove** restores the synthesized voice instantly without re-running any script.
- **✨ Generate** — synthesize Filipino audio for a word that has none. Words added through **Add word** get their audio generated automatically.

*If `msedge-tts` ever breaks, the Python `edge-tts` CLI produces identical output:*
`edge-tts --voice fil-PH-BlessicaNeural --text "bahay" --write-media bahay.mp3`

### UI language toggle (EN / FIL)
Every learner-facing screen, the homepage, and the auth pages can switch between **English** and **Filipino (Taglish)** with the EN/FIL toggle (sidebar on desktop, top bar on mobile). The choice is stored in a cookie; reading content is always Filipino regardless of UI language. Dictionary: `src/lib/i18n.ts`.

### CSV export for statistical treatment
Specialists can download analysis-ready CSVs (UTF-8 with BOM, opens cleanly in Excel/SPSS):

| Export | Where | Contents |
|---|---|---|
| `Summary CSV` | Specialist dashboard | One row per learner: accuracy, error-type counts, sessions, minutes, practice words, specialist–system agreement %, self-correction rate |
| `All attempts CSV` | Specialist dashboard (or per learner) | One row per scored word reading: target, transcript, **ASR engine**, **alternate transcript**, correct, similarity score, error type, response time, review verdict, `is_retry`, `study_phase` |
| `All sessions CSV` | Specialist dashboard (or per learner) | One row per completed activity: type, items, correct, accuracy %, duration, `study_phase` |

Endpoints: `/api/export?what=summary|attempts|sessions[&learnerId=…]` (specialist only; learners can export their own attempts/sessions).

**Two columns matter before you compute anything:**

- `is_retry = 1` marks a second reading of a word, taken right after the correct
  pronunciation was played. It is the closing step of the corrective sequence —
  the child hears the word, then says it, so their last attempt at a word they
  missed is a correct one. Statistically it is *not* an independent measure of
  decoding, because they have just been told the answer. **Filter these rows out
  before computing accuracy.** Every figure inside the app already does: accuracy,
  decoding time, error patterns, adaptive level, practice mastery, the borderline
  panel, and the agreement sample all use first readings only. The summary export
  reports retries separately as `retries` / `retries_correct` /
  `retry_success_pct`.
- `study_phase` is `BASELINE`, `REGULAR` or `ENDLINE`, tagged per session by a
  specialist on the learner page ("Study timeline"). Tagging is retroactive and
  deliberate: it lets the pre/post comparison rest on sessions you chose rather
  than a cut-off inferred from dates.

### Device support
Fully responsive: desktop/laptop (persistent sidebar), tablet and phone (top bar + slide-out drawer). Tables scroll horizontally on small screens; exercise text scales with `clamp()` so long words never overflow.

Because scoring happens on the server from a recording, read-aloud works anywhere `MediaRecorder` does — **Chrome, Edge, and Safari (iOS 14.3+), so iPads are supported**. Recording stops automatically after the child finishes speaking (~1.2 s of silence, 7 s max), or when the mic is tapped again.

**Check each tablet before the first session** at `/diagnostics` (Settings → *Check this
device*). Microphone permission, recording format, whether a spoken instruction can be
fetched and played, and then a real three-second recording scored end to end — the only
honest way to know the chain works on that device. Rows marked *offline fallback only*
describe what the app would resort to without a server; a tablet with no Filipino voice of
its own is normal and not a problem, since the app plays its own recordings.

A dropped connection mid-word is treated as an expected condition, not an error: the child
is told plainly, the controls stay live, and the exercise resumes when the link returns.
Leaving an activity partway asks for confirmation — and says truthfully that the words
already read are saved, because they are.

Every page a person navigates into has its own loading boundary. Next.js only shows loading
UI for a *newly entered* segment, so a single boundary at the layout level never fires for
navigation within the app; the link audit asserts they all stay in place. Recordings are
streamed by `/api/attempt-audio` when a specialist presses play rather than embedded in the
page, which is what took the learner view from 8.4 s to 2.7 s on a throttled connection.

### Word data set
254 Filipino words in `prisma/word-bank.ts`, plus 46 rhyme and 30 sound-isolation items in
`prisma/phon-items.ts`. Each word is tagged with:
- **Syllabification** (`ba-hay`), **pattern** (CV, CVC, CVCV, CCVC …)
- **Marungko stage 1–7** (m-s-a → +i,o → +b,e,u → +t,k,l → +y,n,g → +p,r,d,h,w → +ng/borrowed)
- **Difficulty level 1–5** (open CV-CV syllables → clusters → 4+ syllables)

Specialists can extend the bank in **Word bank → Add word**.

`npm run words:check` validates both banks before they reach a learner;
`npm run words:sync` applies word-bank changes to a database that already has study data
in it, which `prisma db seed` cannot do because seeding wipes every table first.

### Decoding probe (non-words)
26 pronounceable Filipino non-words in `prisma/pseudoword-bank.ts`, flagged `isPseudo`.

A real word can be read from memory. After weeks of practice on a fixed 254-word bank, a
pre/post gain on those same words cannot be told apart from having learned those items — and
the study claims to measure decoding. A word that has never existed can only be decoded, so
it separates letter–sound knowledge from sight-word recall.

- Stage-matched, so a child only ever meets letters they have been taught. Every stage can
  fill a full 8-item run.
- Checked against **Cebuano as well as Tagalog** — the partner site is in Davao City, and a
  "non-word" that is ordinary Bisaya is a real word to these readers.
- **Never given audio, never entered into practice, never fed to the adaptive level, never
  counted in accuracy.** A probe item a child can listen to, or has been taught, has stopped
  being one. A 7-day cooldown keeps the activity from being ground down by repetition.
- **Scored by a specialist, by ear.** Whisper is a language model before it is a
  transcriber, and here it is transcribing words that exist in no language. The first real
  probe run had it write seven of eight non-words correctly and garble the eighth — better
  than expected, and still not something to score a study on. The transcript is therefore
  stored *beside* the human verdict rather than instead of it, which turns the uncertainty
  into a measurement: `specialist_correct` against `correct` gives human-vs-machine
  agreement on unfamiliar items, directly comparable with the same figure on real words.

### Stress-contrastive words
Six bank words carry a `stressNote`: `bukas`, `tubo`, `pito`, `puto`, `buhay`, `hapon`.

Filipino does not write stress, but it changes meaning — *búkas* "tomorrow" against *bukás*
"open". Scoring compares the recogniser's transcript against the target text, and a
transcript is letters, so both readings come back identical and are marked the same. No
threshold or variant list can fix this; the app cannot hear the difference.

This matters because misplaced stress is a documented signature of dyslexia in Filipino. The
words stay in the bank — they are ordinary and useful — but the specialist reviewing one sees
a caveat telling them to judge that reading by ear, and `stress_pair` marks the rows in the
attempts export.

---

## Tech stack

| Category | Technology |
|---|---|
| Front-end | Next.js 16 (App Router) + React 19, Tailwind CSS 4, lucide-react, Recharts |
| Back-end | Next.js route handlers (Node), Zod validation |
| Database | Supabase Postgres via Prisma 7 (`@prisma/adapter-pg`); transaction pooler at runtime, session pooler for migrations |
| Auth | bcryptjs password hashing + JWT session cookie (jose) |
| Speech recognition | **`whisper-large-v3-turbo`** (pre-trained, via Groq's OpenAI-compatible API, language `tl`), with the Web Speech API as automatic fallback. No custom model is trained — consistent with the study delimitation |
| Text-to-speech | `fil-PH-BlessicaNeural` clips for both words (whole word + syllables) and interface instructions, synthesized server-side and cached in the database; Web Speech `speechSynthesis` only as an offline fallback. Word-by-word playback with synchronized highlighting and adjustable rate |
| Fonts | Nunito (UI); reader options: Lexend, Atkinson Hyperlegible, Comic Neue |

## Getting started

Requirements: **Node.js 20+**, a **Supabase** project (free tier), a working **microphone**, and an internet connection.

```bash
npm install
cp .env.example .env       # fill in the Supabase URLs, AUTH_SECRET, SPECIALIST_CODE, GROQ_API_KEY
npx prisma migrate deploy  # creates the schema
npx prisma db seed         # word bank + demo accounts + sample history
npm run audio:generate     # Filipino pronunciation clips for all 115 words (~2 min)
npm run dev                # http://localhost:3000
```

### Database

Postgres via Prisma's driver adapter. Supabase gives two connection strings and both are
needed — this is the step that most often trips people up:

| Variable | Supabase string | Used by |
|---|---|---|
| `DATABASE_URL` | **Transaction pooler**, port `6543`, keep `?pgbouncer=true&connection_limit=1` | the running app (serverless opens many short connections) |
| `DIRECT_URL` | **Session pooler**, port `5432` | `prisma migrate`, `db seed`, `audio:generate`, and the audit suite — migrations cannot run through the transaction pooler |

Supabase is used purely as managed Postgres. LEXORA keeps its own JWT-cookie auth, so
Supabase Auth, Storage, and Row Level Security are not involved; every access check happens
server-side and is covered by the audit suite.

## Deploying (Vercel)

1. Push the repository to GitHub, then import it at **vercel.com/new**.
2. Set the environment variables (Project → Settings → Environment Variables):
   `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `SPECIALIST_CODE`, `GROQ_API_KEY`.
   Use a **fresh** `AUTH_SECRET` and a **private** `SPECIALIST_CODE` — not the local ones.
3. Deploy. Vercel runs `vercel-build`, which regenerates the Prisma client, applies
   migrations, then builds.

The database already holds the word bank and audio, so no seeding step runs on deploy.
If the ✨ generate-audio button ever fails on serverless, run `npm run audio:generate`
locally against the same `DIRECT_URL` — it writes to the same database.

After deploying, point the audit suite at the live URL:

```bash
npm run audit -- https://your-app.vercel.app
```

## Backups

**Supabase's free tier takes no automatic backups.** Reading data collected from children
cannot be gathered again if it is lost, so back up before and after every testing session.

```bash
npm run backup                                  # backups/lexora-<timestamp>.json.gz
npm run backup -- --keep 30                     # how many to retain (default 14)
npx tsx scripts/restore.ts <file> --dry-run     # compare row counts, change nothing
npx tsx scripts/restore.ts <file> --verify      # full rehearsal, rolled back
npx tsx scripts/restore.ts <file> --yes         # actually restore (destructive)
```

### Backing up on a schedule

Remembering to run it every session is the part that fails. Register a daily
Windows task instead:

```powershell
.\scripts\schedule-backup.ps1                                   # daily at 20:00
.\scripts\schedule-backup.ps1 -At 19:30 -BackupDir "$env:OneDrive\lexora-backups" -Keep 30
.\scripts\schedule-backup.ps1 -Remove                           # unregister
```

It runs whether or not the laptop is on mains and catches up after it was asleep — a
study laptop is closed most of the day, so a task that only fires at exactly 20:00 while
plugged in would mostly never fire. Output goes to `backups/schedule.log`; check it after
the first run, because a scheduled job that fails silently is worse than none.

**The backup stays on your machine on purpose.** It contains children's voice recordings,
and this repository is public — a GitHub Actions artifact would be downloadable by anyone.
Point `-BackupDir` at a synced folder or copy to an encrypted drive for the off-site copy.

The dump is a single gzipped file covering every table, written with the `pg` client so
no Postgres tooling has to be installed. ~3 MB compressed, most of it pronunciation audio.

Run `--verify` after each backup: it performs the whole restore inside a transaction,
checks every row count, then rolls back — proving the file is genuinely restorable
without touching live data. An untested backup is not a backup.

Restoring assumes the schema exists; run `npx prisma migrate deploy` first on a fresh
database. `backups/` is gitignored — it contains learner data and must never be committed.
Keep a copy off the machine that produced it.

## Tests

```bash
npm run audit             # all 10 suites against http://localhost:3000 (343 checks)
npm run audit -- <url>    # or against the deployment
npm run audit:api         # authorization, validation, erasure  (43)
npm run audit:logic       # scoring, adaptive difficulty, mastery, review  (22)
npm run audit:ui          # learner journeys, specialist workflows, responsive  (20)
npm run audit:links       # every route reachable from the navigation  (48)
npm run audit:stale       # a learner or specialist erased mid-session  (21)
npm run audit:reporting   # decoding time, calibration, retries, phase, retention  (43)
npm run audit:decoding    # probe, latency guard, stress, exports, Filipino  (64)
npm run audit:calibration # threshold fitted to specialist verdicts  (25)
npm run audit:integrity   # language switch mid-exercise, partial progress  (38)
npm run audit:a11y        # WCAG 2.1 AA, keyboard, reduced motion  (19)
npm run audit:perf        # budgets on a throttled low-end device
npm run audit:prod        # smoke test after a deployment
```

The UI suite's wait for the specialist learner view timed out once, on the first full run
against a freshly started server, and passed on every run since — including repeated full
runs. The page itself serves in under 2 s cold, so the 20 s wait was not the page being
slow; the cause is not established. If you see it, re-run `npm run audit:ui` before
treating it as a regression.

The suites need the target running and seeded, and `DIRECT_URL` set so they can assert
against the database. They create and delete their own `@lexora.test` accounts, and sweep
any left behind by a run that failed partway.

Two conventions worth keeping if you extend them. **Wait on conditions, never on a fixed
sleep** — a sleep tuned on localhost expires before the deployment has responded, and an
assertion that runs early can pass for the wrong reason (a "the word did not change" check
passed only because nothing had happened yet). **Assert what the child sees**, in a real
browser, where the behaviour is about navigation: the app layout is async, so a guard's
redirect arrives as a client-side redirect inside an HTTP 200, and asserting on the status
code would pass a broken app.

### Demo accounts (password: `lexora123`)

| Email | Role |
|---|---|
| `learner1@lexora.ph` | Learner **with 12 days of sample reading history** (for demoing charts/reports) |
| `learner2@lexora.ph` | Learner, fresh account (empty states) |
| `specialist@lexora.ph` | Reading specialist |

Registering a new **specialist** account requires the access code you set in `.env`
(`SPECIALIST_CODE`). Choose a private value — anyone who knows it can register as a
specialist and see every learner's records and recordings. Specialist registration stays
disabled until it is set.

## How the AI assessment works (for the Validation chapter)

1. The learner reads the target word. The microphone recording (≤ ~400 KB, stored so a specialist can replay it) is sent to the server and transcribed by the pre-trained Whisper model; the browser recognizer runs in parallel only as a fallback transcript.
2. The **server** scores every oral reading (`src/lib/scoring.ts`): text is normalized (lowercased, diacritics and punctuation stripped), Levenshtein similarity is computed against the target, and the reading is accepted at **similarity ≥ 0.95** (exact match required for words of ≤ 3 letters). The strict threshold is deliberate — at 0.80 a single substituted vowel passes ("buhay" for "bahay" scores exactly 0.80), and those substitutions are precisely the misreadings the system exists to detect. Tune with `SCORE_THRESHOLD` after comparing system scoring against specialist judgments.
3. Misreadings are classified as **substitution / omission / insertion / no-response** and logged with response time, level, and timestamp.
4. Misread words are added to the learner's **practice list**; two consecutive correct practice reads master a word.
5. **Adaptive difficulty** (`src/lib/adaptive.ts`): looking at the last 12 oral readings at the current level — accuracy ≥ 85 % over ≥ 8 attempts levels up (max 5); ≤ 50 % levels down. The Marungko stage widens with the level. A promotion **also** requires that decoding is not getting slower: across the last 24 timed correct readings at that level, the later half's median must be within 1.25× the earlier half's. Filipino is a transparent orthography, and in transparent orthographies a dyslexic reader is typically accurate but slow — a rule reading accuracy alone will walk such a child from level 1 to level 5 with the actual difficulty untouched. The guard can only ever delay a promotion; it never demotes, and it stands aside when there are fewer than 8 timed readings so it cannot strand anyone.
6. **Reliability check**: in the specialist view, each system verdict can be confirmed or disputed after replaying the recording; the specialist–system **agreement percentage** is computed automatically (Objective 2).
7. **Threshold calibration**: readings scoring within 0.15 *below* the acceptance line are listed separately with their audio. If a specialist listens and judges several of them correct, the threshold is too strict and is penalising children who read the word properly — which would depress accuracy and distort the agreement metric. This turns the choice of 0.95 from an assumption into something the Validation chapter can evidence.
8. **Decoding speed is a co-primary outcome, not a footnote.** `median_decode_ms` (over `timed_readings` first, correct, plausible readings) sits beside accuracy in the summary export and in the report headline. In a transparent orthography the speed difference is the more sensitive marker; two learners at 85 % can be doing completely different things, and only the latency distinguishes them. Nothing is timed in front of the child — the measurement is passive, taken from readings they already gave.
9. **The non-word probe answers a question accuracy cannot.** Real-word gains on a fixed bank confound decoding with recall. Probe items (`is_pseudoword = 1`) are scored by a specialist by ear, reported as `pseudo_accuracy_pct` over `pseudo_scored` — unreviewed items are counted as neither correct nor incorrect. Because the machine's verdict is recorded alongside the human's on both real words and non-words, `specialist_correct` supports a direct comparison of ASR–human agreement between familiar and unfamiliar items. Worth reporting: agreement between automatic and human scoring is known to be **lower for readers with disabilities**, which is the entire participant group here, so published accuracy figures from typical readers should not be assumed to transfer.
10. **A limitation the app cannot engineer away.** Filipino stress is unwritten and meaning-bearing, and the transcript does not encode it, so readings that differ only in stress are scored identically (see *Stress-contrastive words*). Since stress errors are a documented marker of dyslexia in Filipino, this belongs in the delimitations rather than being left implicit.
11. **What is excluded, and why.** Corrective re-reads (`is_retry`) are recorded but kept out of accuracy, decoding time, error patterns, adaptive level, practice mastery, the borderline panel **and the agreement sample**. A reading taken seconds after the word was modelled measures repetition, not decoding; including retries in the agreement sample in particular would bias it toward clear, correct takes and overstate how well the scorer performs on the readings actually being measured. They appear on their own in the **Self-correction** panel and as `retries` / `retry_success_pct` in the summary export. State this in the methodology — it is a defensible choice, but it is a choice.

## Browser & privacy notes

- **Recording** works in Chrome, Edge, and Safari (iOS 14.3+). The page must be served over `http://localhost` or HTTPS for the microphone to be available.
- **Speech recognition** sends the recording to the Groq API for transcription, so it needs internet. Audio is not retained by the provider for training.
- **Word audio** is served from your own database (`/api/word-audio/…`), so pronunciation is correct on every device with no cloud TTS at runtime.
- **Learner data** lives in your own Supabase Postgres database and nowhere else. Recordings exist only for the specialist reliability check and the self-correction panel.
- **Recordings are deleted automatically** after `RECORDING_RETENTION_DAYS` (default 180), swept when a learner next starts an activity. Only the audio goes — transcripts, scores, error types and reviews survive, so no reported figure changes. A specialist can also clear them at any time, or erase a participant entirely, from the learner page. `/privacy` states whichever window is configured.

## Project structure

```
prisma/            schema + seed (word bank, rhyme items, demo data)
scripts/           generate-word-audio.ts (one-time Filipino TTS generation)
src/lib/           db, auth, asr (Whisper), scoring, adaptive, stats, tts, i18n
src/app/           routes (learner pages, specialist pages, API route handlers)
src/components/    sidebar, charts, reader, exercises, specialist tools
```
