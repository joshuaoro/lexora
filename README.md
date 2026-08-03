# LEXORA

**Design and Development of an AI-Assisted Reading and Progress Tracking Web Application for Persons with Dyslexia**

LEXORA is a web-based reading support and progress-tracking application focused on two foundational, word-level reading skills: **phonological awareness** and **single-word decoding**. Reading materials are Filipino (Tagalog) words sequenced by the **Marungko Approach** and organized by Structured Literacy principles.

> LEXORA is a reading **support** tool. It does not diagnose dyslexia, does not provide clinical assessment, and is not a substitute for licensed educators, reading specialists, speech-language pathologists, or health-care professionals.

---

## Features → study objectives

| # | Objective | Where it lives |
|---|-----------|----------------|
| 1 | Dyslexia-friendly display customization (fonts, size, letter/word spacing, line height, color overlays, focus ruler), TTS with synchronized word highlighting, adjustable reading speed | **Settings** page, **Reader** page. The focus ruler is pointer-driven, so it works with mouse, touch and stylus |
| 2 | Pre-trained ASR scoring of word-level oral reading + specialist agreement check | **Read aloud** exercise; **Specialist → learner → Scoring reliability check** (records audio, specialist agrees/disputes, agreement % is computed) |
| 3 | AI-assisted reading assessment: immediate pronunciation feedback + personalized practice word list from frequently misread words | Exercise feedback panels; **Practice list** (auto-populated on misreads) |
| 4 | Adaptive word-level exercises driven by recorded reading accuracy | Adaptive level 1–5 (`src/lib/adaptive.ts`); specialists can override per learner |
| 5 | Progress-tracking and analytics dashboard (accuracy, error patterns, completed activities) | **Dashboard**, **Reports** (printable), **Specialist** learner views. Reader time counts towards "minutes practiced"; Reader sessions are listed as words heard rather than a score, since nothing is scored there |
| 6 | ISO/IEC 25010 + user-acceptance evaluation | The app is the artifact under evaluation; reports are printable for instrument administration |

### Exercise modules
- **Read aloud** — single-word decoding. The child's reading is recorded and transcribed server-side by a pre-trained **Whisper** model; the recording is kept for specialist review.
- **Listen & choose** — blending / word recognition with look-alike distractors.
- **Count the syllables** — segmentation (pantig), with syllable-by-syllable audio.
- **Rhyme time** — rhyming awareness from a curated item bank.

### Speech recognition (oral reading assessment)
Readings are scored by **`whisper-large-v3-turbo`**, a pre-trained ASR model accessed through Groq's OpenAI-compatible API with the language fixed to Tagalog (`tl`). No model is trained or fine-tuned, and learner audio is never used for training — consistent with the study delimitation.

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

> **Known limitation for the Validation chapter.** In an integration probe over 25 words (synthesized Filipino speech, not children's voices), Whisper matched the target exactly on 20/25 before variants. Every miss was a **Marungko stage 7 loanword or digraph** (`krus`, `dyip`, `tsinelas`, `mangga`, `bulaklak`), and two of them (`dyip`, `tsinelas`) returned a *different* spelling on each run. The seeded variant list was derived from synthesized speech and should be re-validated against real recordings during the reliability check; stage 7 items warrant closer specialist attention when computing agreement.

### Filipino pronunciation audio
Most devices have no Filipino voice installed, so browser TTS reads Tagalog with English phonics ("bahay" → *buh-HAY*). LEXORA therefore ships **pre-generated neural Filipino audio** for every word in the bank — a whole-word clip and a syllable-by-syllable clip, synthesized once with `fil-PH-BlessicaNeural` and stored in the database (~14 KB each):

```bash
npm run audio:generate              # fill in any missing clips
npm run audio:generate -- --force   # regenerate all (keeps specialist recordings)
```

Playback order is **specialist recording → generated clip → browser TTS**. Custom text typed into the Reader still uses browser TTS.

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

### Word data set
115 Filipino words seeded in `prisma/seed.ts`, each tagged with:
- **Syllabification** (`ba-hay`), **pattern** (CV, CVC, CVCV, CCVC …)
- **Marungko stage 1–7** (m-s-a → +i,o → +b,e,u → +t,k,l → +y,n,g → +p,r,d,h,w → +ng/borrowed)
- **Difficulty level 1–5** (open CV-CV syllables → clusters → 4+ syllables)

Specialists can extend the bank in **Word bank → Add word**.

---

## Tech stack

| Category | Technology |
|---|---|
| Front-end | Next.js 16 (App Router) + React 19, Tailwind CSS 4, lucide-react, Recharts |
| Back-end | Next.js route handlers (Node), Zod validation |
| Database | SQLite via Prisma 7 (better-sqlite3 driver adapter) |
| Auth | bcryptjs password hashing + JWT session cookie (jose) |
| Speech recognition | **`whisper-large-v3-turbo`** (pre-trained, via Groq's OpenAI-compatible API, language `tl`), with the Web Speech API as automatic fallback. No custom model is trained — consistent with the study delimitation |
| Text-to-speech | Pre-generated `fil-PH-BlessicaNeural` clips per word (whole word + syllables), with Web Speech `speechSynthesis` as fallback; word-by-word playback with synchronized highlighting and adjustable rate |
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
npx tsx scripts/restore.ts <file> --dry-run     # compare row counts, change nothing
npx tsx scripts/restore.ts <file> --verify      # full rehearsal, rolled back
npx tsx scripts/restore.ts <file> --yes         # actually restore (destructive)
```

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
npm run audit        # all suites against http://localhost:3000
npm run audit:api    # authorization, validation, erasure  (43 checks)
npm run audit:logic  # scoring, adaptive difficulty, mastery, review  (22 checks)
npm run audit:ui     # learner journeys, specialist workflows, responsive  (20 checks)
```

The suites need the target running and seeded, and `DIRECT_URL` set so they can assert
against the database. They create and delete their own `@lexora.test` accounts.

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
5. **Adaptive difficulty** (`src/lib/adaptive.ts`): looking at the last 12 oral readings at the current level — accuracy ≥ 85 % over ≥ 8 attempts levels up (max 5); ≤ 50 % levels down. The Marungko stage widens with the level.
6. **Reliability check**: in the specialist view, each system verdict can be confirmed or disputed after replaying the recording; the specialist–system **agreement percentage** is computed automatically (Objective 2).

## Browser & privacy notes

- **Recording** works in Chrome, Edge, and Safari (iOS 14.3+). The page must be served over `http://localhost` or HTTPS for the microphone to be available.
- **Speech recognition** sends the recording to the Groq API for transcription, so it needs internet. Audio is not retained by the provider for training.
- **Word audio** is served from your own database (`/api/word-audio/…`), so pronunciation is correct on every device with no cloud TTS at runtime.
- All learner data stays in the local SQLite database (`dev.db`); recordings are only used for the specialist reliability check.

## Project structure

```
prisma/            schema + seed (word bank, rhyme items, demo data)
scripts/           generate-word-audio.ts (one-time Filipino TTS generation)
src/lib/           db, auth, asr (Whisper), scoring, adaptive, stats, tts, i18n
src/app/           routes (learner pages, specialist pages, API route handlers)
src/components/    sidebar, charts, reader, exercises, specialist tools
```
