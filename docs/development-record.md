# LEXORA — Development Record

**Design and Development of an AI-Assisted Reading and Progress Tracking Web
Application for Persons with Dyslexia**

A complete account of what was built, how it was built, and why each decision was
made the way it was.

---

## 0. What this document is

The [README](../README.md) describes the application as it stands: what it does,
how to run it, what a specialist sees. This document describes the *development*
— the reasoning behind each design decision, the alternatives that were
considered and rejected, the defects found and what caused them, and the
methodological arguments that shaped the code.

It exists because a capstone is defended on its reasoning, not only on its
output. A panel asking "why 0.95?" or "why do you exclude retries?" or "why not
fine-tune the model?" should find the answer written down rather than
reconstructed from memory. Everything here is traceable to a file, a commit, or
a migration in this repository.

Three companion documents:

| Document | Covers |
|---|---|
| [`README.md`](../README.md) | The application as it works today — features, setup, deployment, exports |
| [`docs/deferred-ideas.md`](deferred-ideas.md) | What was considered and deliberately not built, feeding Future Work |
| **this document** | How and why it came to be that way |

**Scale of the artifact**, for orientation:

| Area | Files | Lines |
|---|---:|---:|
| `src/app/` — routes and API handlers | 60 | 4,744 |
| `src/components/` — UI | 30 | 5,921 |
| `src/lib/` — domain logic | 28 | 4,018 |
| `prisma/` — schema, migrations, word banks, seed | 15 | 1,358 |
| `scripts/` — operational tooling | 12 | 1,266 |
| `tests/` — audit suites | 14 | 4,399 |
| **Total tracked** | | **~23,200** |

53 commits, 10 migrations, 10 automated audit suites, 423 assertions.

---

## 1. The study, and the constraints it imposes

Every significant decision in this codebase traces back to one of six facts
about the study. They are listed first because almost nothing below makes sense
without them.

### 1.1 The participants are five children aged 7–12

This is the single most consequential constraint, and it cuts in two directions
at once.

**It rules out anything that needs statistical power.** No p-values are computed
anywhere in the application. No model is fine-tuned. No per-learner threshold is
fitted. Five children cannot support inference, and a number with a decimal point
rendered on a web page will be quoted in a paper long after the caveat attached
to it has been forgotten. Where the app would like to say "this improved," it
says "this went from X to Y over N readings" and stops.

**It also raises the cost of every lost record.** Forty-two voice recordings from
five children cannot be re-collected; the child will have moved on, and the
consent was for one study. That is why backups are verified by rehearsal rather
than assumed (§10.3), why a dropped connection is treated as an expected
condition rather than an error (§5.7), and why attempts save one at a time
instead of at the end of an activity (§8.6).

**And it forces every panel to know its own minimum.** Rather than draw a chart
over three readings, each analysis module declares the sample size below which
it refuses to render and says how many more are needed:

| Module | Constant | Value | Reasoning |
|---|---|---:|---|
| `calibration.ts` | `MIN_SAMPLE` | 30 | Below this a fitted cut-point is a decimal point with nothing behind it |
| `divergence.ts` | `MIN_REAL_REVIEWS` | 10 | Reviewed real words needed before the comparison is honest |
| `divergence.ts` | `MIN_PROBE_REVIEWS` | 8 | One complete probe run; the calibration's 30 is unreachable behind a 7-day cooldown |
| `divergence.ts` | `THIN_SAMPLE` | 20 | Below this a single item moves a proportion by several points — flagged, not hidden |
| `phases.ts` | `MIN_PHASE_READINGS` | 10 | Per phase, before baseline/endline is drawn |
| `phases.ts` | `MIN_PHASE_PROBES` | 8 | One full run per phase |
| `stats.ts` | `MIN_LATENCY_SAMPLE` | 5 | A median over three readings is noise wearing a number |
| `adaptive.ts` | `MIN_ATTEMPTS` | 8 | Before the level can move at all |

### 1.2 The scope is word-level only

Phonological awareness and single-word decoding. Connected text, reading fluency
(WCPM), spelling and comprehension are excluded **by the study's own
delimitation**, not by omission.

This is enforced in the code, not merely stated in prose. `stats.ts` measures
*decoding latency on single words* and the comment says explicitly that this is
not fluency. There is no sentence-level activity, no passage reader that scores,
no WCPM calculation anywhere in the tree. The Reader page displays text and
speaks it, but records nothing as a score — which is why `READER` appears in
`UNSCORED_ACTIVITY_TYPES` (§8.1).

Adding sentence reading would make the application answer a question the
research design does not ask, which is why it appears in the deferred list with
that exact reason.

### 1.3 The reading content is Filipino, sequenced by the Marungko Approach

Two consequences that shaped a great deal of code.

**Filipino is a transparent orthography.** Letters map to sounds with few
surprises. In transparent orthographies — the finding replicates across Spanish,
Italian and German — dyslexia presents as *slow* reading far more reliably than
as *inaccurate* reading. A child can sit at 90% accuracy and still be sounding
out every single word.

This is why decoding time is a **co-primary outcome** rather than a secondary
panel. It appears beside accuracy in `learnerSummary()`, in the report headline,
in the summary export, and — critically — in the adaptive level rule, where a
promotion requires evidence that decoding is becoming automatic and not merely
correct (§5.2). A level rule reading accuracy alone would walk exactly the child
this study is for from level 1 to level 5 with the underlying difficulty
untouched.

**Filipino does not write stress, and stress carries meaning.** *búkas*
(tomorrow) against *bukás* (open). The ASR returns letters; both readings
transcribe identically and are scored identically. No threshold and no variant
list can repair this — the application cannot hear the difference. Since
misplaced stress is a documented marker of dyslexia in Filipino, being blind to
it is exactly the wrong blindness to have.

The response was threefold: six bank words carry a `stressNote` (`bukas`,
`tubo`, `pito`, `puto`, `buhay`, `hapon`); the specialist reviewing one of them
sees a caveat telling them to judge by ear; and `stress` exists as a tag in the
observation vocabulary specifically because a specialist's ear is the only
instrument the study has for it. The rows are marked `stress_pair` in the
attempts export so the limitation is visible at analysis time.

The Marungko sequence is encoded twice on purpose — `STAGE_LETTERS` in
`src/lib/marungko.ts` for display, `STAGE_LETTER_SETS` for reasoning, and
`LETTER_STAGE` in `prisma/marungko-stage.ts` to derive a word's stage during
seeding. The comment notes that the two must agree, because the display form
carries "+" signs and a Filipino phrase that nothing can compute against.

### 1.4 The partner site is in Davao City

The children speak **Cebuano as well as Filipino**. This looks like a minor
detail and is not: a "non-word" that happens to be ordinary Bisaya — *linog*,
*lami*, *balay* — is a real word to these particular readers, and quietly stops
testing decoding at all. Every one of the 26 probe non-words was checked against
both languages.

It is also the decisive argument against generating probe words on the fly
(§6.4): a generator would need to know Tagalog, Cebuano, local names and brands.
A specialist who speaks both can screen a list of twelve in under a minute.

### 1.5 Three reading specialists evaluate under ISO/IEC 25010:2023

Their judgements are data, not feedback. This is what makes **blind review**
(§6.3) a correctness requirement rather than a nicety: the specialist–system
agreement percentage, Cohen's κ and the fitted threshold all rest on those
labels, and a label formed after seeing the machine's answer is not independent
of the thing it measures.

They also evaluate *Interaction Capability* on the specialist workspace itself,
which is why the Filipino translation of those ten components was finished
before the freeze rather than left as polish.

### 1.6 No model is trained or fine-tuned

Pre-trained ASR via API, and that is a methodological position with three
independent legs. It came up directly — an expectation had been voiced verbally
that the study would fine-tune a model — and the reasoning was written down
rather than settled by preference:

1. **No held-out set.** With five participants, fine-tuning on their recordings
   and then evaluating on the same five children is training on the test set.
   There is no honest split.
2. **Consent does not cover it.** Using children's voice recordings as training
   data is a different processing purpose under **RA 10173** (Data Privacy Act)
   from the assessment purpose parents consented to.
3. **The deployment cannot host it.** Vercel serverless functions cannot serve a
   fine-tuned acoustic model.

What replaced it is not nothing. **Threshold calibration** (§4.4) adapts the
decision layer sitting on top of the pre-trained model — the similarity at which
a transcript counts as a correct reading — fitted to reading specialists' own
verdicts, with the confusion matrix, κ, MCC, a plateau and a bootstrap interval
all reported. That is real adaptation at n=5, and it produces figures directly
comparable with published literature. It is a stronger contribution than a
fine-tune that could not be defended.

---

## 2. Architecture

### 2.1 The stack, and why each piece

| Layer | Choice | Why this one |
|---|---|---|
| Framework | Next.js 16 App Router, React 19 | Server components let every authorization check run server-side before markup exists. A learner's data is never serialized into a page another role could request. |
| Styling | Tailwind CSS 4 | Design tokens as CSS custom properties, which the accessibility work needed (§5.6) — the reader's font, spacing and overlay settings are token overrides, not a second stylesheet. |
| Database | Supabase Postgres via Prisma 7 + `@prisma/adapter-pg` | Managed Postgres on a free tier. **Supabase Auth, Storage and RLS are deliberately unused** — LEXORA keeps its own JWT-cookie auth so every access check is in this repository and covered by the audit suite, rather than split between application code and database policy. |
| Auth | bcryptjs + JWT session cookie (jose) | httpOnly cookie; no client-readable session state. |
| ASR | Groq-hosted `whisper-large-v3-turbo`, language `tl` | Pre-trained, OpenAI-compatible API. Web Speech API as automatic fallback. |
| TTS | `fil-PH-BlessicaNeural` via `msedge-tts` | Synthesized server-side, cached in the database. |
| Validation | Zod 4 | Every route handler validates its body. |
| Charts | Recharts | |
| Tests | `playwright-core` (msedge channel), axe-core | No browser download needed on Windows. |
| Host | Vercel | `vercel-build` = `prisma generate && prisma migrate deploy && next build` |

### 2.2 The two-connection database setup

This is the step that most often breaks a fresh checkout, so it is worth stating
plainly. Supabase provides two connection strings and **both are required**:

- `DATABASE_URL` — **transaction pooler**, port `6543`, with
  `?pgbouncer=true&connection_limit=1`. Used by the running app, because
  serverless opens many short-lived connections.
- `DIRECT_URL` — **session pooler**, port `5432`. Used by `prisma migrate`,
  `db seed`, `audio:generate` and the audit suites. **Migrations cannot run
  through the transaction pooler.**

Connection pools are capped (commit `d27a15f`) because serverless functions
otherwise exhaust the free tier's connection limit under any concurrency.

### 2.3 Where logic lives, and why

The rule is that **anything a number depends on lives in `src/lib/` as a pure or
near-pure function**, never inline in a component or a route handler. This is not
tidiness; it is what makes the same figure mean the same thing in three places.

The clearest example is `PLAUSIBLE` in `src/lib/stats.ts`:

```ts
export const MIN_PLAUSIBLE_MS = 300;    // faster than this is a mis-click
export const MAX_PLAUSIBLE_MS = 60_000; // slower than this, the child walked away
export const PLAUSIBLE = { gte: MIN_PLAUSIBLE_MS, lte: MAX_PLAUSIBLE_MS };
```

It is imported by `stats.ts` (reporting), `adaptive.ts` (the latency guard),
`phases.ts` (baseline/endline decoding time) and the export route. "How long a
word took" therefore means exactly the same thing when it is shown to a
specialist, when it decides whether a child moves up a level, and when it lands
in a CSV. Had each site defined its own bounds, they would have drifted, and the
drift would have been invisible.

The same pattern holds for `MEASURED` (the retry/activity-type filter),
`ERROR_TAGS` (the controlled tag vocabulary), `UNSCORED_ACTIVITY_TYPES`, and the
demo-scope helpers.

---

## 3. The data model

Eight tables. What follows covers every non-obvious column and the reason it
exists.

### 3.1 `User` / `LearnerProfile`

Split so a specialist account has no learner profile and a learner's adaptive
state has one home. `role` is a validated string rather than a Postgres enum —
the schema header states the reason: the study adds activity types as it goes,
and a string avoids a migration each time.

`LearnerProfile.settings` is a JSON string holding accessibility preferences
(font, size, letter and word spacing, line height, colour overlay, focus ruler).
Kept as JSON because the set of options changed repeatedly during the
accessibility work and each change would otherwise have been a migration.

**`isDemo`** is the demo quarantine flag — see §6.2. Added in migration
`20260811050000`.

### 3.2 `Word`

254 real Filipino words in `prisma/word-bank.ts`, plus 26 non-words in
`prisma/pseudoword-bank.ts`. Each carries:

- `syllables` — hyphenated (`ba-hay`), used for syllable-by-syllable audio and
  for pattern-family classification
- `pattern` — CV, CVC, CVCV, CCVC …
- `stage` — Marungko 1–7, **derived from the letters** by
  `prisma/marungko-stage.ts` rather than assigned by hand
- `level` — difficulty 1–5
- `meaningEn` — English gloss, shown to specialists only

**`variants`** — comma-separated spellings the ASR may legitimately return for a
correct reading. The recogniser writes some loanwords in English orthography:
`krus` → "cross", `mangga` → "manga", `dyip` → "deep". Without this a perfectly
read word scores as an error. Compared **exactly**, never fuzzily, so a variant
can never mask a genuine misreading — verified by a control case in the audit
where a clip saying *bahay* scored against target *buhay* is still marked
incorrect.

**`isPseudo`** — the probe flag. The schema comment carries the full argument:
reading a real word can be done from memory, reading a word that has never
existed cannot; without these, a pre/post gain on a fixed 254-word bank cannot be
told apart from having learned those 254 items.

**`stressNote`** — set when meaning depends on stress the spelling does not mark.

**Audio columns** are deliberately four rather than two:
`audioWord`/`audioSyll` hold the generated neural clips;
`audioWordHuman`/`audioSyllHuman` hold a specialist's own recording. Kept
separate so the human recording always takes priority *and can be removed
without losing the generated clip* — pressing 🗑 Remove restores the synthesized
voice instantly, with no script to re-run. `audioVersion` is bumped whenever any
clip changes so cached audio URLs refresh.

**Index** `[isPseudo, level, stage]` — every ordinary word query filters on
`isPseudo`, and the probe selects on it together with the staging columns.

### 3.3 `SpeechClip`

Spoken interface text, synthesized once and kept. Keyed by a hash of **voice,
rate and text together**, so changing any of them yields a new clip rather than
serving a stale one.

`createdBy` exists for one specific reason, recorded in the schema comment: the
per-account synthesis ceiling has to be counted from the rows themselves. An
in-memory counter cannot do that job on a serverless host — each instance keeps
its own tally, so a limit that works locally never triggers in production. This
was found and fixed as a pair of commits (`2f8083a` then `caae10e`), the second
correcting the first.

### 3.4 `ActivitySession`

**`phase`** — `BASELINE | REGULAR | ENDLINE`, tagged by a specialist. Retroactive
and deliberate: it lets the pre/post comparison rest on sessions someone *chose*
rather than a cut-off inferred from dates. This column existed from commit
`ba53bc4` (Aug 3) but did nothing but sit in a CSV until `6101208` (Aug 11) —
see §7.6.

**`completedAt`** — set only when the learner reached the end. Progress saves as
it goes, so a session walked away from still carries the words read and the
minutes spent; it simply is not *completed*. The migration that added it
(`20260803172742`) includes a backfill with its reasoning inline:

```sql
-- Before this column, a session only ever had totals written to it at the
-- moment the learner finished, so "total > 0" *was* "completed". Sessions
-- recorded under those rules must keep that meaning, or every activity already
-- completed would silently stop being counted on the dashboard.
UPDATE "ActivitySession" SET "completedAt" = "createdAt" WHERE "total" > 0;
```

**Indexes** `[learnerId, createdAt]` and `[learnerId, type]` — added in migration
`20260810120000`. Postgres does not index a foreign key for you, and every query
on this table filters on the learner: the dashboard's minutes, the report's
recent activities, and the probe cooldown that runs on every visit to the
exercises page. All were sequential scans. Harmless at forty rows, and not
something to leave in a table that gains a row for every activity five children
complete over eight weeks.

### 3.5 `Attempt`

One row per scored word reading. `target` is **denormalized** so history survives
a word being edited or deleted; `wordId` is `SetNull` on delete for the same
reason.

`engine` records which recogniser scored it (`server` = Whisper, `browser` = Web
Speech), and `altTranscript` holds the other engine's transcript when both ran.
Both are shown as a badge in the specialist review and exported — an agreement
figure computed across two different scorers without recording which was which
would be uninterpretable.

**`isRetry`** is the most methodologically loaded column in the schema. Its
comment states the case:

> A second reading of the same word, taken *after* the correct pronunciation was
> modelled. Instructionally the point of the exercise; statistically it is not an
> independent measure of decoding, because the child has just been told the
> answer. Excluded from accuracy, adaptive level, error patterns, decoding time
> and mastery — reported only as self-correction.

See §6.1 for the full argument and the enforcement points.

### 3.6 `AttemptReview`

The specialist's verdict on a system-scored reading. Powers Objective 2.

`agrees` stores **agreement with the machine**, not the specialist's own verdict.
This matters constantly: every consumer recovers the specialist's verdict as
`agrees === correct`, and that one-line conversion appears in `calibration.ts`,
`divergence.ts`, `phases.ts` and the export route. It caused a test-fixture bug
(§8.9) precisely because the two are easy to confuse.

**`blind`** records whether the machine's verdict was hidden when the judgement
was made. Defaulted `false`, and the migration comment says why that is the
*truthful* value rather than a convenient one: for every review recorded before
the column existed, the transcript, the verdict in colour and the similarity
score were all rendered above the play button. Recording the condition per review
keeps the anchored and unanchored populations from merging, which is the only
way the repair can be demonstrated at all (§6.3).

### 3.7 `ReviewErrorTag`

A controlled vocabulary of what a specialist heard. A **relation rather than a
delimited column** because these are meant to be counted — one `groupBy`, and no
room for the spelling drift a free-text field invites. `@@unique([reviewId, tag])`
makes re-tagging idempotent.

The reason these come from a person rather than from transcripts is blunt, and
it is written in the schema:

> Derived from ASR transcripts they would not be [real]: most of the transcripts
> in this database were invented by the seed script, and the genuine ones carry
> the recogniser's own spelling — "Bahai" for *bahay*, "CC" for *sisi* — which is
> orthography and noise, not a child's phonology.

### 3.8 `PracticeItem`

The child's own misread words. `source` is `AUTO` (added on a miss) or
`SPECIALIST` (pinned). `streak` tracks consecutive correct practice reads;
`mastered` at two in a row.

---

## 4. The measurement chain

This is the core of the application and the part a Validation chapter is written
about. Eleven steps from a child speaking to a number in a CSV.

### 4.1 Capture

`src/components/exercises/useOralReading.ts`. The microphone recording is
analysed live through a `Web Audio` analyser node at `fftSize: 1024`. The take
ends automatically on **1,200 ms of trailing silence after speech was detected**
(`SILENCE_RMS = 0.012`), or at 7 s maximum, or when the mic is tapped again.

Waiting for silence *after speech* rather than after a fixed interval matters for
this population: a child who takes four seconds to begin should not have the
recording cut off before they start.

The blob is capped at `MAX_AUDIO_BLOB_BYTES = 400_000`. Because scoring happens
server-side from a recording, read-aloud works anywhere `MediaRecorder` does —
Chrome, Edge, and Safari (iOS 14.3+), so iPads are supported.

### 4.2 Transcription

`src/lib/asr.ts`. Three details are deliberate and each was arrived at for a
reason.

**The target word is never sent as a prompt.** Biasing the recogniser toward the
expected word would hide the very misreadings the system exists to detect. What
*is* sent is a generic Tagalog anchor:

```
"Ito ay pagsasanay sa pagbasa sa wikang Filipino. Isang salita lamang ang binibigkas."
```

This stops borrowed words coming back in English orthography. The comment states
the constraint explicitly: it must never mention the target word or any word from
the bank.

**The MIME pattern allows dots.** Safari records
`audio/mp4;codecs=mp4a.40.2`, and a pattern without the dot silently fails to
parse it — every reading from that device would fall through to the browser
recogniser or go unscored, with nothing in the UI to say why.

**Retries are jittered, not fixed** (`RETRY_MIN_MS = 700`,
`RETRY_MAX_MS = 2500`). The comment records the measurement behind this: when a
group practises together the requests that get rate-limited are rate-limited at
the same instant, so a constant wait sends them all back at the same instant and
they collide again. At twelve concurrent readings, four in a round lost both
attempts that way.

**Fallback chain:** Whisper → Web Speech API → *the attempt is not saved*. If a
recording was captured but neither engine could transcribe it, the learner is
asked to try again. Unscoreable takes never enter the study data.

### 4.3 Scoring

`src/lib/scoring.ts` — pure functions, usable on both server and client.

1. **Normalize** — lowercase, NFD-decompose, strip diacritics (`ñ` → `n`), keep
   letters only, remove hyphens.
2. **Tokenize** — the ASR can return a phrase, so every token *plus the tokens
   joined* becomes a candidate.
3. **Levenshtein similarity** against the target; the best candidate wins.
4. **Accept** if a variant matches exactly, OR — for words of ≤ 3 letters — the
   best candidate equals the target exactly, OR similarity ≥ threshold.

**Why 0.95 and not 0.80.** At 0.80 a single substituted vowel passes: "buhay" for
"bahay" scores exactly 0.80. Those substitutions are precisely the misreadings
the system exists to detect, and a reading specialist would mark them wrong. At
0.95, no single substituted or dropped letter can pass for any word in the bank —
the closest case is a 10-letter word at 0.90. The remaining tolerance absorbs ASR
spelling noise on longer words.

**Why short words need an exact match.** At three letters, one wrong letter is a
0.67 similarity, but two-letter words would pass at 0.50 on nothing. Exact match
removes the whole ambiguous region.

`activeScoreThreshold()` reads `SCORE_THRESHOLD` from the environment only when
it is in `[0.5, 1]`. Everything reads through this one function so the scorer and
anything reporting on it can never disagree.

### 4.4 Calibration — fitting the decision layer

`src/lib/calibration.ts`, ~400 lines, and the single most defensible answer to
"what did you adapt, if you did not fine-tune?"

Every reviewed reading is a **labelled example**: `Attempt.score` is the
continuous decision variable and the specialist's verdict is ground truth. The
module sweeps the cut-point from 0.50 to 1.00 in steps of 0.01 and, at each
value, tallies the confusion matrix and reports accuracy, sensitivity,
specificity, precision, **Cohen's κ**, **Matthews correlation (MCC)** and
**Youden's J**.

**The design decision that matters most: it replays the real rule.**

A naive sweep would compare the stored similarity against each candidate
threshold. That would be measuring a classifier LEXORA does not run —
`scoreReading()` also accepts an approved variant outright and demands exact
match for short words, both of which ignore the threshold entirely. So the real
function is called twice, at thresholds it can never meet and never miss:

```ts
function replay(r: LabelledReading): Replayed {
  const atCeiling = scoreReading(r.target, r.transcript, 2, r.variants);
  if (atCeiling.correct) return { kind: "fixed", accepted: true, score: atCeiling.score };
  const atFloor = scoreReading(r.target, r.transcript, 0, r.variants);
  if (!atFloor.correct) return { kind: "fixed", accepted: false, score: atFloor.score };
  return { kind: "threshold", score: atFloor.score };
}
```

Accepted at a threshold of 2 → a variant or short-word match, fixed regardless.
Rejected at a threshold of 0 → no response, or a short word not matched exactly,
also fixed. Only what remains is actually decided by the threshold. Verified in
the audit: a 3-letter near-miss scoring 0.67 is refused at *every* threshold,
which a naive sweep would have accepted at 0.50–0.66.

**Why MCC leads rather than accuracy or F1.** The sample is lopsided — most
readings are correct — so a scorer that accepted everything would post a high
accuracy and a respectable F1 while being useless. MCC only rises when all four
cells of the matrix are good (Chicco & Jurman, 2020). It returns 0 when a whole
row or column is empty, which is the conventional reading of "no better than
chance" and what a degenerate classifier deserves.

**Guards against over-claiming**, all three of them:

- **No recommendation below 30 labelled readings.** The panel says how many more
  are needed instead.
- **Plateau reporting.** Every threshold within 0.01 MCC of the peak is reported
  as a span. A wide flat region means the optimum is weakly identified and the
  single "best" value must not be quoted alone.
- **Bootstrap interval.** 1,000 resamples with replacement, re-finding the peak
  each time. With five participants, how much the recommendation depends on
  *which* children happened to be reviewed is the main thing a reader should be
  told.

**The sweep is built by multiplication, not repeated addition** — accumulating
0.01 fifty times drifts, and these thresholds are compared and displayed.

**Probe non-words are held out** of the fit and reported separately. They are
scored by ear precisely because the machine's verdict on a non-word measures the
recogniser rather than justifying a cut-point.

**The page recommends; it never moves the threshold.** Changing
`SCORE_THRESHOLD` mid-study would mean baseline and endline were scored by
different rules. Since similarity is stored on every attempt, the sound order is
to leave it fixed and re-score the exported data at analysis time if the
calibration warrants it, reporting both figures.

**Comparable published figures**, so the numbers can be situated rather than
floated: for automatic scoring of children's oral reading, published agreement is
**κ = .54, human 92% vs ASR 88%** classification accuracy; the best of six ASR
systems on Dutch oral reading reached **MCC = 0.63**. Both were measured on
typically-developing readers, and the first study found agreement **significantly
lower for students with disabilities** — which is this entire participant group.
Context, not targets.

### 4.5 Error classification and storage

Misreadings are classified `substitution` / `omission` / `insertion` /
`no_response` by comparing lengths of the best candidate against the target, and
logged with response time, level at the time, engine, both transcripts, and the
recording.

### 4.6 Aggregation

`src/lib/stats.ts` holds every learner-level figure. All of them share one
filter:

```ts
const MEASURED = { activityType: { in: ["READ_ALOUD", "PRACTICE"] }, isRetry: false };
```

Reported: overall accuracy, words read in 14 days, minutes practised, activities
completed, **median decoding time**, daily accuracy series, practice streak,
error-pattern distribution, accuracy by level, accuracy by Marungko stage, and
accuracy by **syllable-pattern family**.

The pattern families are the most actionable view a specialist gets — "reads CVCV
fine, fails on clusters" points straight at what to teach next in a way overall
accuracy cannot. Raw patterns collapse into six instructional families:
`Open (CV·CV)`, `Closed syllable`, `Vowel pair`, `Consonant cluster`, `ng words`,
`Long (4+ syllables)`. Families with no attempts are filtered out rather than
shown at 0%.

`decodingTime()` additionally splits the history in half to show whether decoding
is speeding up, and surfaces **slow words** — read correctly but at more than
1.6× the learner's own median, over at least two readings. Those are words still
being decoded rather than recognised. The median is used throughout rather than
the mean because one distraction mid-session drags an average badly.

### 4.7 Presentation

Server components render for the learner (dashboard, reports) and the specialist
(learner page, cohort, calibration, word bank). Reports print. Recordings are
**streamed** by `/api/attempt-audio` when a specialist presses play rather than
embedded in the page — which took the specialist learner view from 8.4 s to 2.7 s
on a throttled connection.

### 4.8 Export

`/api/export?what=…` — eight tables, UTF-8 with BOM so Excel and SPSS open them
cleanly:

| `what` | Contents |
|---|---|
| `attempts` | One row per reading: target, transcript, engine, alt transcript, correct, score, error type, response time, review verdict, `is_retry`, `study_phase`, `stress_pair`, `is_pseudoword` |
| `sessions` | One row per activity: type, items, correct, accuracy, duration, `study_phase` |
| `summary` | One row per learner: accuracy, error counts, sessions, minutes, `median_decode_ms`, agreement %, `retries` / `retry_success_pct`, `pseudo_accuracy_pct` |
| `calibration` | One row per candidate threshold — the full sweep |
| `agreement-conditions` | Blind vs anchored agreement, **its own table** (§8.4) |
| `phase-comparison` | One row per phase |
| `iep` | Plain-text IEP draft |

`maxDuration = 30` because an export at the end of the study walks every reading
five children made, and the point of an export is that it works on the largest
data set rather than the smallest.

Two columns are flagged in the README as things to handle **before computing
anything**: `is_retry = 1` rows must be filtered out, and `study_phase` selects
the pre/post split.

### 4.9–4.11 The three things accuracy cannot tell you

Steps 9 through 11 of the chain are the non-word probe (§6.4), the stress
limitation (§1.3), and the retry exclusion (§6.1). Each is documented as its own
methodological safeguard below.

---

## 5. Subsystems

### 5.1 Exercise modules

Seven activities, each mapped to a study objective:

| Activity | Skill | Notes |
|---|---|---|
| **Read aloud** | Single-word decoding | Recorded, transcribed server-side, recording kept for review |
| **Listen & choose** | Blending / word recognition | Look-alike distractors |
| **Count the syllables** | Segmentation (pantig) | Syllable-by-syllable audio |
| **Rhyme time** | Rhyming awareness | 46 curated items |
| **First sound** | Sound isolation | 30 curated items |
| **Practice list** | The child's own misread words | Two correct reads in a row masters a word |
| **Silly words** | The decoding probe | Assessment only — see §6.4 |

The two curated banks are in `prisma/phon-items.ts`, and the depth is
deliberate: a session draws eight items, so a bank of ten would be exhausted in a
single sitting and the learner would answer from memory thereafter.

Word rotation (commit `719496a`) stops exercises repeating the same words across
consecutive sessions; `npm run words:rotation` validates that zero overlap holds
at every level.

The corrective **"Now you try it!"** re-read (commit `92259b9`) is the
instructional heart of the read-aloud activity: the child hears the correct
pronunciation, then says it, so the last time they say a word they missed, they
say it right. It is recorded as `isRetry` and excluded from every measure.

### 5.2 Adaptive difficulty

`src/lib/adaptive.ts`. Level 1–5, recomputed from the most recent attempts
recorded **at the current level**, so the window resets naturally after every
change.

```
WINDOW = 12          MIN_ATTEMPTS = 8
UP_THRESHOLD = 0.85  DOWN_THRESHOLD = 0.50
```

**The latency guard** is the part that matters, and §1.3 is why it exists. A
promotion also requires evidence that decoding is not getting slower: across the
last 24 timed correct readings at that level, the later half's median must be
within `SLOWER_TOLERANCE = 1.25` of the earlier half's.

Three properties of the guard were chosen deliberately:

- **It can only delay a promotion, never force a demotion.** A speed measure is
  noisier than an accuracy measure and should not be able to move a child
  backwards.
- **The tolerance is loose on purpose.** This is a handful of readings from a
  seven-year-old, and a single distracted afternoon should not strand a child who
  is genuinely ready. It catches a trend, not noise.
- **Silence means "no objection", not "hold".** With fewer than 8 timed readings
  it returns `false`. An unproven guard must never be able to trap a learner at a
  level.

Retries are excluded from both the accuracy window and the latency window —
letting them count would move a learner up on repetition rather than on decoding.

The Marungko stage widens with the level (`min(7, level + 2)`) but **never
shrinks below what the learner has already reached**.

### 5.3 Practice list and mastery

Misread words are auto-added (`recordMiss`). Two consecutive correct practice
reads master a word; a miss resets the streak to zero and increments the count.
Specialists can pin words manually (`source: SPECIALIST`).

### 5.4 Filipino pronunciation audio

Most devices ship no Filipino voice, so browser TTS reads Tagalog with English
phonics — "bahay" becomes *buh-HAY*. For an application whose users cannot read
the word on screen, that is not a cosmetic problem.

Every word in the bank therefore ships **pre-generated neural Filipino audio** —
a whole-word clip and a syllable-by-syllable clip, synthesized once with
`fil-PH-BlessicaNeural` and stored in the database at roughly 14 KB each.

Playback order: **specialist recording → generated clip → browser TTS**.

From the word bank a specialist can hear exactly what learners hear, record the
word in their own voice (with preview → *Use this / Redo / discard* before it
goes live), remove a recording to restore the synthesized voice instantly, or
generate audio for a word that has none.

### 5.5 Spoken instructions

The same problem applies to the sentences around the words, and more sharply:
instructions exist for the children who *cannot read* the written ones, so a
device reading them with English phonics defeats the entire point.

Instructions are synthesized by the same voice and served from the database, so
the app speaks with one voice rather than two. A speaker button sits beside every
prompt, and the one after **Start** plays itself — a press satisfies the
browser's autoplay rules.

Two details worth recording:

- **Lines are read out of `src/lib/i18n.ts` rather than a copy**, so rewording an
  instruction is picked up on the next generation run instead of quietly serving
  audio of the old wording.
- **Text that cannot be known ahead of time** — a child's name, a streak count —
  is synthesized on first use and cached by hash. Measured: a warm line serves in
  ~200 ms, a cold one takes about two seconds, once.

A per-account synthesis ceiling exists (`MAX_SPEECH_CHARS = 300` per request,
plus a row-counted budget) so one account cannot run up unbounded TTS cost.

`npx tsx scripts/voice-samples.ts` writes the real instruction lines as mp3s in
each candidate voice — "gentle" is not something a voice list tells you.

### 5.6 Accessibility

WCAG 2.1 AA, checked by axe-core across every route as each role.

This matters more here than in most applications, for two reasons: the users are
children with a reading disability, and ISO/IEC 25010:2023 scores accessibility
under the **Interaction Capability** characteristic the reading specialists
evaluate.

Reader customization covers font (Lexend, Atkinson Hyperlegible, Comic Neue,
Nunito), size, letter spacing, word spacing, line height, colour overlays, and a
**pointer-driven focus ruler** — pointer-driven specifically so it works with
mouse, touch *and* stylus rather than assuming a mouse.

Exercise text scales with `clamp()` so long words never overflow; tables scroll
horizontally on small screens.

Two rounds of contrast fixes were needed — 113 failures in commit `9dc3cfe`, and
a further 256 later traced to a single Tailwind utility (§8.3).

### 5.7 Resilience

**A dropped connection is an expected condition, not an error.** The study runs
on school wifi and tablets. `src/lib/net.ts` wraps `fetch` and returns `null`
rather than throwing, and the comment explains what was actually broken:

> A rejected fetch inside an async click handler is not merely an unhandled
> error: the rest of the handler never runs, so whatever "busy" flag it set is
> never cleared. In the exercise screen that left a child looking at "Checking…"
> with every control disabled, no message, and no recovery when the connection
> came back — the only way out was a page reload, which a seven-year-old will not
> think to do and which loses the session.

**A stale session** — a cookie outliving the row it points at, because a
specialist erased a learner or the database was reseeded — used to throw Prisma
`P2025` on every page. `src/lib/guards.ts` now loads the profile once and treats a
missing one as signed-out; the API counterpart returns 401 rather than 500,
because a 500 shows on the exercise screen as "we couldn't hear that clearly" and
a child mid-activity would keep retrying a microphone that was never the problem.

**Leaving an activity partway** asks for confirmation, and says truthfully that
the words already read are saved — because they are.

**Every page has its own loading boundary.** Next.js only shows loading UI for a
*newly entered* segment, so a single boundary at the layout level never fires for
navigation within the app. The link audit asserts all of them stay in place.

**`src/app/global-error.tsx`** catches crashes on the pages that come before
sign-in, which had no error boundary at all until commit `d7dccd2`. It is
self-contained with inlined colours and uses `<a>` rather than `<Link>`, since
the router may be the thing that failed.

### 5.8 Internationalization

`src/lib/i18n.ts` — 947 lines, ~726 keys, English and Filipino (Taglish). The
choice is stored in a cookie; **reading content is always Filipino regardless of
UI language**, since the reading task is the constant.

Taglish rather than pure Filipino is deliberate: assessment terms a Philippine
reading centre already says in English — accuracy, level, CSV, baseline, kappa —
stay in English. Translating them would make the interface *less* legible to its
actual users.

The specialist workspace was finished last, in the final build: ten components
plus the cohort page. The type system enforces key parity, so nothing can be
half-translated silently.

### 5.9 The specialist workspace

Eleven surfaces:

| Surface | Purpose |
|---|---|
| Specialist dashboard | All learners, summary exports |
| Learner detail | Full report, reviews, all panels below |
| Cohort overview | Every learner side by side, accuracy per syllable pattern |
| Threshold calibration | The sweep, κ/MCC, plateau, bootstrap, blind-vs-anchored |
| Review list | Blind review with observation tags |
| Divergence panel | Decoding vs recall |
| Phase comparison | Baseline vs endline |
| Session phases | Tagging the study timeline |
| Self-correction | The retry panel, kept apart from accuracy |
| Word bank | Add words, variants, audio, probe suggestions |
| Learner data controls | Clear recordings, erase a participant |

---

## 6. Methodological safeguards

Seven walls, each protecting a specific claim the study wants to make. These are
the sections most likely to be asked about in a defense.

### 6.1 Retries are recorded and excluded

**The claim protected:** that reported accuracy measures decoding.

The corrective re-read is instructionally valuable — the child's last attempt at
a word they missed should be a correct one. Statistically it is not an
independent measure, because they have just been told the answer.

**Enforcement points**, all of them: accuracy, decoding time, error patterns,
adaptive level, adaptive latency guard, practice mastery, the borderline
calibration panel, the agreement sample, the divergence chart, and the phase
comparison. Implemented once as `isRetry: false` inside the shared `MEASURED`
filter and repeated explicitly in the modules that build their own `where`.

Excluding retries **from the agreement sample in particular** is the
non-obvious one: including them would bias the sample toward clear, correct takes
and overstate how well the scorer performs on the readings actually being
measured.

They are reported separately as `retries` / `retries_correct` /
`retry_success_pct` and in the Self-correction panel. The README states this
belongs in the methodology chapter — it is a defensible choice, but it is a
choice.

### 6.2 Demo accounts are quarantined

**The claim protected:** that every reported figure describes a real child.

`prisma/seed.ts` gives the demo learners a fortnight of fabricated history.
`mutate()` invents misreadings like this:

```ts
const swaps = { b:"d", d:"b", p:"b", m:"n", n:"m", u:"o", e:"i" };
```

That is very nearly the textbook dyslexia error profile. Aggregated with real
participants it does not look like noise — **it looks like a finding**, and it
would survive into a cohort chart, an error distribution, and a CSV handed to a
statistician. 159 of 196 transcripts in the database at the time of the audit
were seed-generated.

`LearnerProfile.isDemo` excludes them by default from cohort figures, the
learners list, the calibration, the divergence chart, the phase comparison and
every export. Including them requires `?demo=1` on a page or `includeDemo=true`
on an export, they are badged `[DEMO]` when shown, and the IEP draft **refuses
outright** for a demo learner rather than adding a caveat nobody reads once the
text has been pasted elsewhere.

A learner's own dashboard is untouched — this is about aggregation, and the demo
accounts are supposed to work when demonstrated.

The helpers live in `src/lib/demo.ts` as four small functions, so no query has to
remember the shape of the filter.

> **Expected on a fresh study database:** until real participants are enrolled
> and reviewed, the cohort figures, calibration and divergence chart all read
> "not enough data". That is the quarantine working, not a fault.

### 6.3 Blind review

**The claim protected:** that the human labels are independent of the machine
verdicts they are compared against.

This was a genuine defect discovered mid-project, not a feature planned from the
start. The review row rendered the transcript, the verdict in green or red, and
the similarity score **above the play button** — so a specialist met the answer
before they could hear the reading. Those judgements feed the agreement
percentage (Objective 2), Cohen's κ, and the fitted threshold. None of them were
independent of what they measured.

**The repair.** Blind review is now the default. The transcript, verdict, engine
and similarity are **not rendered at all — absent from the response, not hidden
with CSS** — until the specialist commits a verdict, at which point the system's
reading is revealed for comparison. The question becomes "did the learner read
this correctly?" rather than "was the system right?", reusing the mapping the
non-word probe already used.

Leaving blind mode takes a deliberate press of *"Switch to quick review (shows AI
verdict first)"* — phrased as an opt-out with a named cost — and the current mode
is displayed at all times.

**The condition is recorded per review, not assumed.** `AttemptReview.blind` is
fixed at the moment the verdict is formed. The calibration reports agreement
under each condition, on the page and in
`/api/export?what=agreement-conditions`. The gap between them is a finding about
anchoring, not a footnote about method. Reviews recorded before this existed are
`blind = false`, which is the truthful value.

This safeguard then produced its own bug, which is instructive enough to have its
own entry — see §8.4.

### 6.4 The non-word probe

**The claim protected:** that a pre/post gain measures decoding rather than
memorisation.

A child who has practised the same 254-word bank for eight weeks can post a high
accuracy without decoding much of anything. A word that has never existed cannot
be recognised, only sounded out.

26 pronounceable Filipino non-words in `prisma/pseudoword-bank.ts`. Construction
rules:

- **Filipino phonotactics and the Marungko sequence**, so a child only ever meets
  letters they have been taught. The stage is derived from the letters exactly as
  it is for real words.
- **Patterns and levels mirror the real bank** (CVCV = 1, one closed syllable = 2,
  three syllables = 3), so a probe item is no harder to decode than the practice
  words it is compared against. Only its familiarity differs.
- **Checked against Cebuano as well as Tagalog** (§1.4).
- **Deliberately not near-misses of common words.** `malabo → milabo` is one
  vowel away, and a child who reads it as "malabo" has demonstrated lexical
  guessing rather than a decoding failure, which muddies the distinction the
  probe exists to draw.
- **Early stages are over-supplied.** A learner at Marungko stage 3 can only be
  shown words built from m, s, a, i, o, b, e, u — and a probe that can only find
  five such items hands back a five-item run when it asked for eight, a thinner
  measure exactly where the readers who need it most will be sitting.

**The walls around it**, each closing a specific leak:

| Wall | If it were absent |
|---|---|
| No audio, ever | A probe item a child can listen to has stopped being one |
| Never enters the practice list | A probe item that has been taught has stopped being one |
| Never feeds the adaptive level | The measure would move the thing it measures |
| Never counted in accuracy | Assessment items would contaminate the practice figure |
| No verdict shown to the child | Feedback would teach the item |
| 7-day cooldown | Repetition would grind the activity down |
| Scored by a specialist, by ear | See below |

**Why scored by ear.** Whisper is a language model before it is a transcriber,
and here it is transcribing words that exist in no language. The transcript is
stored *beside* the human verdict rather than instead of it — which turns the
uncertainty into a measurement: `specialist_correct` against `correct` gives
human-vs-machine agreement on unfamiliar items, directly comparable with the same
figure on real words.

**A correction worth recording.** The machine's unreliability on non-words was
initially overstated in both the UI and the README. The first real probe run had
Whisper write **seven of eight non-words correctly** and garble the eighth —
better than expected, and still not something to score a study on. The UI label
was changed from "(unreliable)" to "(decide by ear)", which is accurate.

**Why probe words are not randomly generated.** This was asked directly and the
answer is written into `src/lib/pseudoword-gen.ts`. Generating fresh non-words
per run is tempting — infinite supply, nothing to memorise — and it breaks the
probe in two ways that only show up later:

1. **Filipino is a small, open-syllable language**, so random legal strings land
   on real words constantly: *ba-ta*, *ma-ta*, *ta-ma*, *ka-ma*, *lu-pa*,
   *pu-sa*. Every one of those a child reads from memory, scored as a decoding
   success that never happened. No word list fixes it either, because of §1.4.
2. **Comparability.** A pre/post design needs the endline to be the same
   instrument as the baseline. If both runs draw freshly invented words, "40% to
   70%" could as easily mean the second set was easier, and there is no way to
   tell after the fact.

The compromise built instead: the generator **suggests** stage-matched
candidates, a specialist accepts the ones that are genuinely not words, and the
accepted ones join a fixed reviewed bank. The loop is bounded rather than
"until we have enough", because at stage 1 the letter set is m, s, a and almost
every legal string is either a real word or already suggested — an unbounded loop
would spin.

### 6.5 Observation tags come from a person

**The claim protected:** that a reported error profile describes a child's
phonology.

An error profile built from ASR transcripts would read convincingly and describe
nobody — see §3.7. So the categories come from someone listening: optional chips
shown **after** the verdict, headed *"What did you observe?"*.

Ten tags, split by `kind`:

- **Errors:** vowel, first sound, last sound, digraph, consonant cluster,
  syllable dropped, syllable added, **stress**
- **Behaviours:** self-corrected in the recording, could not tell

The split is load-bearing. `self_corrected` describes a child who *arrived at the
right word*, and `unclear` describes the specialist rather than the child.
Counting either into an error distribution would overstate how much went wrong.
The heading is "What did you observe?" rather than "What did you hear?" for the
same reason.

`self_corrected` is named *"self-corrected in the recording"* specifically to
distinguish it from the app-prompted re-read already measured as
`retry_success_pct` — two different phenomena that would otherwise be conflated
in the write-up.

**Coverage travels with the counts, always.** Tagging is optional — a blank is
honest missing data where a forced choice would be noise — so every report prints
*"categories recorded for N of M reviewed misreadings (X%)"*. A distribution
without its denominator invites the reader to assume it describes every
misreading when it may describe a third of them. The comment puts it sharply: a
heatmap without its denominator is the same mistake as a fabricated one, a step
removed.

### 6.6 Decoding versus recall, compared like with like

**The claim protected:** that the memorisation gap is a gap in the child, not in
the marking method.

The obvious version of this chart puts the app's machine-scored real-word
accuracy next to the human-scored probe accuracy. It would be wrong. Real words
are scored by Whisper against a similarity threshold; probe items are scored by a
person listening. Charting one against the other confounds the scorer with the
construct, and could show a dramatic "memorisation gap" that is really the
difference between two ways of marking.

So **both sides are specialist verdicts**, and the real-word side is restricted
to readings a specialist has also reviewed. That makes the chart slower to fill
and the comparison honest.

**It does not filter on `blind`** — and that was a deliberate correction to an
earlier design. The chart compares two sets of human verdicts, so blindness is
not a term in the comparison, and filtering would empty it for no gain. But
anchoring pulls a judgement toward the machine, and the machine is comparatively
reliable on real words and unreliable on non-words, so it could bias the two
sides *unequally* — which is exactly what distorts a gap. The blind composition
of both sides is therefore **displayed**, with a sentence naming it as a
limitation. Stated rather than assumed away.

An explicit threshold is stated rather than left to the eye: **±25 points**
separates "consistent with sight-word recall" from "tracking together".

### 6.7 No inferential statistics in the application

**The claim protected:** that the paper's statistics are chosen for the design.

`src/lib/phases.ts` reports baseline against endline as descriptives and stops.
The reason, from the module header:

> Five children cannot support a p-value, and one rendered in a web page would be
> quoted long after the caveat was forgotten. The app reports the descriptives
> and the counts they rest on; whether a change is distinguishable from noise is
> a question for the analysis, with the exported data and a method chosen for the
> design.

The choice of test — paired, non-parametric, corrected for multiple measures —
depends on the design and is not a default an application should pick. The
deferred-ideas entry for this says "revisit when: never, in this form."

---

## 7. Chronology

49 commits across three working periods. What follows is what each phase was
*for*, not a restatement of the log.

### 7.1 Foundation — Aug 3, 07:55–10:02

`17b5233` established the whole application in one commit: schema, word bank,
seven exercises, learner and specialist views, auth, reports.

Then immediately: `db4b4d8` migrated from local SQLite to Supabase Postgres and
added the first audit suite and data-privacy controls; `949e335` added the Vercel
build pipeline. `d60d070` removed 33,077 lines of agent skill docs that
`prisma init` had auto-installed and committed.

`3993678` is the first methodological commit about testing itself — *"Make the UI
audit wait on state instead of fixed delays."* The convention it established
(§9.3) was reaffirmed twice more later.

### 7.2 Hardening — Aug 3, 15:57 – Aug 4, 03:09

Accessibility (`9dc3cfe`, 113 contrast failures), performance (`80471c4`, unused
reader fonts shipped on every page), backups with verified restore (`6175088`),
word rotation and sound isolation (`719496a`), connection pool caps (`d27a15f`).

Then four commits in the same hour that together define the study's measurement
posture:

- `2a31bb4` — decoding time as an outcome, the first threshold calibration panel,
  and a sweep for abandoned sessions
- `1ea53ef` / `e9ab4c7` — stale sessions redirect rather than crash; the API
  answers 401 rather than 500
- `92259b9` — the corrective re-read, *"without it counting as a score"*
- `ba53bc4` — session phase tagging

`ba53bc4` is worth marking: it added `ActivitySession.phase` on **Aug 3**, and the
column then did nothing but sit in a CSV column for eight days until `6101208`
on Aug 11. See §7.6.

### 7.3 The child's experience — Aug 4, 10:30 – Aug 5, 02:23

Network resilience (`96ba161`), export performance (`e552457`), the run skill
(`66a7f8d`), spoken instructions and the device check (`20cd6d4`), a
child-first dashboard (`e093bf6`), instructions in the app's own voice rather
than the device's (`23cb1d4`), loading boundaries (`d3a709b`).

Two self-corrections in this stretch are notable because they correct
*documentation* rather than code: `f862bf1` — *"Correct the device check: it was
describing the old speech pipeline"* — and `bd67f9e` — *"Correct documentation
that had drifted from the app."* Documentation drift was treated as a defect
class in its own right.

`2f8083a` capped TTS synthesis per account; `caae10e` corrected it 35 minutes
later to count from the database rather than from memory, because an in-memory
counter cannot enforce a limit across serverless instances. `b311970` taught the
audit to tell a host challenge apart from a broken feature — the first encounter
with Vercel's bot protection (§8.11).

### 7.4 Measuring decoding, not recall — Aug 5, 13:08–15:54

`4a997d6` (*"Measure decoding, not recall"*, 30 files, +1,531) built the entire
non-word probe: the bank, the `isPseudo` flag and its migration, the stress
notes, the walls around the probe, and the export columns.

`636a02f` (*"Stop a probe session reading as eight failures"*, 18 files) fixed
the first user-reported defect from that build — see §8.1.

### 7.5 Rigour — Aug 11, 02:07–12:00

`d683b3b` (*"Fit the acceptance threshold to what the specialists actually
say"*, +1,296) built the full calibration module in response to the fine-tuning
question (§1.6): the sweep, κ, MCC, Youden's J, the plateau, the bootstrap, the
replay rule, and a hand-computed verification script.

`b7782fe` stopped the production login page printing a working specialist
password. `d7dccd2` added the missing error boundary for pre-sign-in pages.

`d6c7bec` (*"Hide the machine's answer until the specialist has given theirs"*,
23 files, +1,703) built blind review, the demo quarantine, the observation tag
vocabulary, the divergence chart and the IEP draft — five features in one
migration.

`02f8349` (*"Stop a tag from rewriting how the verdict was reached"*) fixed the
provenance bug that feature introduced (§8.4).

### 7.6 The last build — Aug 11, 14:05

`6101208` (*"Show whether the child improved"*, 15 files, +1,076) closed the one
structural hole left.

The finding that prompted it: `grep phase src/lib/*.ts` returned **nothing**.
`ActivitySession.phase` existed in exactly three places — the tagging UI, a Zod
enum in the phase route, and a CSV column. Every measure the application computed
was aggregated over all time and never split. So a specialist could mark which
sessions were the baseline and which the endline, export the tags, and **never
see whether the child improved**.

For an application whose Objective 5 is *progress tracking*, that was the
headline missing — and it bit hardest exactly where the study's central question
lives, at baseline probe versus endline probe.

The same commit finished the Filipino specialist workspace and added
`docs/deferred-ideas.md`, after which a **feature freeze** was declared. The
reason is recorded in that document:

> Everything in LEXORA has been validated against automated tests and zero real
> children. Each further feature adds surface to defend at a defense, and more
> code no participant has touched. The risk stopped being "too little
> application" some time ago; it is now "the application keeps growing while the
> study does not start."

---

## 8. Defects found and fixed

Recorded with the mechanism, not just the symptom. Several are more useful as
warnings than as history.

### 8.1 A perfect probe run displayed as `0/8`

**Reported by the user**, having completed the silly-words exercise on a test
account and approved the pronunciations.

**Mechanism.** Session rows render `correct/total` in four places. Probe sessions
have `correct = 0` **by design** — the verdict comes from a specialist afterwards,
so the session's own count never moves however well the child read. A child who
read all eight non-words correctly saw "0/8", indistinguishable from getting
every one wrong, on their own dashboard and in the specialist view.

**Fix.** `src/lib/activity.ts` names the rule once:

```ts
export const UNSCORED_ACTIVITY_TYPES = ["READER", "PSEUDO_PROBE"] as const;
export function isScoredActivity(type: string): boolean { … }
```

Probe sessions now display "8 read". Naming it in one place keeps the four
rendering sites from disagreeing about it again.

**Why it mattered beyond cosmetics.** The affected child sees a zero on an
activity they did perfectly, in an application whose users already believe they
are bad at reading.

### 8.2 A working specialist password printed on the production login page

The login page listed the demo credentials as a convenience. In production that
is a published credential for an account that can see every child's records and
recordings.

**Fix.** Gated behind `NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS`. Note that this stopped
the *advertising*, not the access — `specialist@lexora.ph` / `lexora123` still
works, which is why credential rotation remains outstanding (§13).

### 8.3 256 WCAG AA contrast failures from one utility class

**Mechanism.** `text-ink-muted/70` — a muted colour at 70% opacity — computes to
3.0:1 against the card background, below the 4.5:1 AA requirement for body text.
It was used widely, so one utility produced 256 failures.

**Compounding failure:** the accessibility suite had never scanned the specialist
pages at all, so a whole role's surface was unchecked. Both were fixed: the `/70`
removed, and the specialist routes added to the a11y sweep.

### 8.4 Tagging a review silently rewrote how the verdict was reached

The most serious defect of the project, and it was introduced *by* the safeguard
in §6.3.

**Mechanism.** Adding an observation tag re-saves the review. The save path
recomputed `blind` from the current UI state — and by then the specialist had
already committed their verdict, so the anchors were revealed and `blind`
recomputed as `false`. A judgement genuinely made blind was silently rewritten as
anchored.

**Why it is severe.** It corrupts the exact provenance metadata that exists to
prove the labels are independent — and it corrupts it *in the direction of
under-claiming*, so nothing would look wrong. Worse, the corruption correlates
with tagging: the most carefully reviewed readings would be the ones marked
anchored.

**Detection.** A probe that tagged a known-blind review and re-read the column:
`true` → `false`.

**Fix.** The flag is fixed at the moment the verdict is formed:

```ts
function blindFor(attemptId: string, verdictChange: boolean): boolean {
  if (!verdictChange && judgedBlind[attemptId] !== undefined) return judgedBlind[attemptId];
  return blind && !justJudged.has(attemptId) && reviews[attemptId] === undefined;
}
```

Plus a regression test.

### 8.5 Appending rows to an existing export broke four parsers

Blind-vs-anchored agreement was first shipped as extra labelled rows appended to
the threshold-sweep CSV. That export is one row per threshold, and four consumers
— including test assertions — parsed it on that assumption.

**Reverted** to a separate `what=agreement-conditions` table.

**Why this one is uncomfortable:** a comment in `src/app/api/export/route.ts`
already warned against exactly this. The lesson is now recorded twice — in the
route and in the deferred-ideas document — because a warning that was written and
then ignored is evidence the warning was not placed where it would be read.

### 8.6 Minutes discarded when a child left an activity partway

Session totals were written only on the final screen. Words and accuracy survived
(attempts save one by one) but the **time did not**. Now flushed on the way out,
and the activity is marked completed only when it really is.

### 8.7 Switching language mid-exercise dealt a different set of words

**Mechanism.** The language toggle calls `router.refresh()`, which re-runs the
server component. Words are picked at random per request, so the refresh dealt a
different set into a component that stayed mounted. The run's state survived
while the words changed underneath — feedback showing for a word no longer on
screen, and the next answer recorded **against a word the child never saw**.

**Fix.** Language belongs to the interface; the words belong to the run. The item
set is now fixed for the duration of a session.

**Data-integrity severity:** this silently mislabels attempt rows.

### 8.8 A dormant learner's recordings were never deleted

`purgeExpiredRecordings()` was scoped to the learner who triggered it, running
when any learner started an activity. So a child who stopped using the app never
swept anything and their voice stayed in the database indefinitely — and the
learner most likely to be dormant is **one who withdrew from the study**,
precisely whose recordings should go first.

This broke the promise the privacy notice makes to families.

**Fix.** The sweep is global. The cost is close to nothing: once a sweep has run,
the next matches no rows at all, because only recordings that have just crossed
the window qualify.

### 8.9 Three tests that passed while testing nothing

Grouped because they share one shape: **an assertion can pass for the wrong
reason, and a green check is the least visible kind of failure.**

- **Vacuous fingerprint comparison.** A build-ID extractor returned empty and
  compared empty-to-empty twenty times. The fingerprint "changed" to
  `d41d8cd98f00` — which is `md5("")`. This was nearly reported as a successful
  deployment verification.
- **Vacuous i18n assertion.** A Filipino-coverage check asserted on the string
  "Blind review", which is identical in both dictionaries. Changed to
  `"nakatago ang hatol ng sistema"`.
- **Assertion window too wide.** A check slicing from "not linked to" to
  end-of-page swept in an unrelated "Word-level error patterns" section, so it
  would have passed on text it was not testing. The regex was anchored.

Also in this family: a test fixture passed `agrees` where the *specialist's
verdict* was meant (§3.6) — renamed to `saidCorrect` with the conversion done
once — and a fixture selecting `SELECT id FROM "LearnerProfile" LIMIT 1` with no
`ORDER BY`, which is non-deterministic. Both fixed.

### 8.10 Asserting against an RSC flight payload

A test asserted `(9/10)` against the raw HTTP response of a server-rendered page
and failed. **Server components serialize interpolated values as separate array
elements in the flight payload**, so `({correct}/{n})` never appears as the
literal string `(9/10)` in the response body.

Related: a streamed Next.js response interleaves rendered markup with the flight
payload, so a value can appear in one panel's props while being absent from
another panel's markup — and searching for "6.0" turns up inside an icon's SVG
path data.

**Convention established:** assert on browser `innerText` within a named section,
never on raw HTML.

### 8.11 Vercel bot protection mistaken for a broken feature

Polling the deployment during verification triggered `x-vercel-mitigated:
challenge` — a 403 to an over-polling IP. The audit was taught to distinguish
this from a genuine failure (`b311970`), and deploy verification moved to
GitHub's deployment status API.

This is also why the production run reports **403 checks against 405 locally**:
three speech-budget checks need a burst the protection challenges, and they
collapse into one skip **by design**.

### 8.12 Testing a stale server, three times

A build run while `next start` was still running serves the **old** bundle. This
produced false results on three separate occasions before it was recognised —
once confirmed by timestamps: server started 05:26:49, build finished 05:32:21.

**Convention established:** restart the server before testing, always. It is
written into the verification section of the plan template.

### 8.13 The database had a second door, and 43 passing tests could not see it

Found on 12 August, from Supabase's own Security Advisor rather than from
anything in this project — which is the point of the entry.

**Mechanism.** Supabase exposes a PostgREST endpoint next to the Postgres one,
and grants the `anon` role full DML on the public schema by default. Row Level
Security is what is meant to hold that back, and it was never enabled: Prisma
does not create policies, and nothing else did. The endpoint was live, RLS was
off on all 11 tables, and `anon` held `SELECT, INSERT, UPDATE, DELETE` **and
`TRUNCATE`** on every one — read every recording, or delete the study.

**Why it is the sharpest example of §14's theme.** `api-audit` had 43 assertions
proving that nobody can read or change data they do not own. Every one of them
was true, and every one tested the application's front door. The assurance they
provided was real and was about the wrong thing — the guarantee they seemed to
give ("learner data is protected") was broader than the guarantee they actually
made ("the app enforces access control"). A passing suite is evidence about
whatever it exercises, and nothing whatever about what it does not.

The documentation had crystallised the same gap into a sentence: "Row Level
Security is not involved; every access check happens server-side and is covered
by the audit suite." Both clauses were true. Their conjunction implied something
false, and it had been written in a document intended for a panel.

**What made it not a catastrophe** was luck with a helpful shape: exploiting it
needs the anon key, and LEXORA has no Supabase client, so the key appears in no
commit, no bundle and no `.env`. The margin was one shared dashboard screenshot
wide.

**Fix.** Data API disabled, plus RLS on all 11 tables as a second layer, plus two
new assertions in `api-audit` — that the endpoint stays shut, and that the app
can still read every table. See §10.1a.

**The lesson worth keeping.** The suite was never wrong; the inference drawn from
it was. Worth asking of any green suite: *what would still be true if this passed
and the system were compromised anyway?*

### 8.14 The backup had silently stopped covering every table

Found while taking the safety backup before the work in §8.13 — the table list
the run printed did not match the schema.

`TABLE_ORDER` in `scripts/db-tables.ts` is hand-maintained and had fallen behind
migration `20260811050000`. `ReviewErrorTag` was added to the schema and not to
the list; `SpeechClip` had never been on it. Every backup for a day omitted both
while printing a success line and a row count.

**Nothing was lost** — `ReviewErrorTag` held 0 rows, because no specialist had
tagged anything yet. It would have started costing real data the moment one did.

The same shape as the rest: a report of success covering an absence. Fixed by
checking the list against `pg_tables` before writing anything, so an unknown
table aborts the run rather than yielding a partial file that looks complete.

### 8.15 Smaller fixes worth recording

- **Safari MIME parsing** (§4.2) — every reading from an iPad would have gone
  unscored with nothing in the UI to say why.
- **Sign-out did not check success** — the session cookie is httpOnly, so a
  failed logout leaves the child signed in while showing them a login form.
- **JSX spacing** — "read talocorrectly", reported by the user. Fixed with an
  explicit `{" "}`. The mechanism first stated (line-trimming) was contradicted
  by an identical construction elsewhere that keeps its space, so the comment was
  softened rather than asserting an unverified rule.
- **Four high-severity `sharp` CVEs** — verified unreachable rather than patched
  blindly: `next/image` is unused, there are no `remotePatterns`, and the
  optimizer returns 400 for all URLs.
- **A rate-limiter hypothesis that was wrong.** The in-memory limiter was
  suspected of failing on serverless. Tested empirically: it holds — eight
  failures, then 429. The suspicion was withdrawn.
- **Identical CSV filenames** — every download was named the same, so a folder of
  exports was unusable. Now distinguished.
- **Unclear cooldown copy** — "come back to this one in a few days" replaced with
  a specific date.

---

## 9. Verification

### 9.1 The suites

Ten suites, **423 checks locally**. Run with `npm run audit [url]`.

| Suite | Checks | Covers |
|---|---:|---|
| `api-audit` | 61 | Authorization, validation, data scoping, erasure, and the two RLS checks in §10.1a |
| `logic-audit` | 22 | Scoring strictness, adaptive difficulty, mastery, agreement |
| `ui-audit` | 20 | Complete learner journeys, specialist workflows, responsive sweep |
| `links-audit` | 50 | Every route reachable from the navigation, as each role |
| `stale-session-audit` | 21 | A learner or specialist erased mid-session |
| `reporting-audit` | 43 | Decoding time, calibration band, retries, phase, retention |
| `decoding-audit` | 64 | Probe walls, latency guard, stress caveat, exports, Filipino |
| `calibration-audit` | 85 | Calibration arithmetic, blind review, tags, demo, IEP, pre/post |
| `session-integrity-audit` | 38 / 36 | Language switch mid-exercise, partial progress |
| `a11y-audit` | 19 | WCAG 2.1 AA via axe-core, keyboard, reduced motion |
| `perf-audit` | — | Budgets on a throttled low-end device |
| `prod-smoke` | — | Real Groq audio, serverless TTS, live `SPECIALIST_CODE` |

The suites create and delete their own `@lexora.test` accounts and sweep any left
behind by a run that failed partway (`86c89b1`).

### 9.2 Verification of the arithmetic, twice

Figures destined for a Validation chapter are checked by **two independent
implementations**:

1. `npm run calibration:check` — κ and MCC against values worked out by hand,
   plus the replay rule.
2. `npm run audit:calibration` — recomputes every statistic from the *exported
   confusion matrix* with a second implementation, end to end, including a
   deliberately too-strict threshold.

If the two agree, a transcription error in either is unlikely to survive.

### 9.3 Two conventions learned the hard way

**Wait on conditions, never on a fixed sleep.** A sleep tuned on localhost
expires before the deployment has responded, and an assertion that runs early can
pass for the wrong reason — a "the word did not change" check once passed only
because nothing had happened yet. Established in `3993678`, reaffirmed in
`4ffc216`.

**Assert what the child sees, in a real browser, where the behaviour is about
navigation.** The app layout is async, so a guard's redirect arrives as a
client-side redirect **inside an HTTP 200**. Asserting on the status code would
pass a broken app.

### 9.4 The performance budget is the study's own hardware

`perf-audit` throttles to the study's Table 5 minimum specification — dual-core
2.0 GHz, 5 Mbps — because a slow first paint on the centre's actual tablets shows
up directly in the children's user-acceptance ratings. Budgets: FCP 3 s, LCP 4 s,
JS 400 KB.

### 9.5 One unexplained flake, recorded rather than hidden

The UI suite's wait for the specialist learner view timed out **once**, on the
first full run against a freshly started server, and has passed on every run
since including repeated full runs. The page serves in under 2 s cold, so the
20 s wait was not the page being slow. **The cause is not established.** It is
documented in the README with the instruction to re-run before treating it as a
regression, because an intermittent failure recorded honestly is more useful than
one quietly retried away.

### 9.6 Data integrity checks

Beyond the suites: the database is 28 MB of a 500 MB allowance, with no orphan
rows and no invariant violations. All 159 fabricated attempts were confirmed to
sit on demo learners and **zero on real accounts**. The backup was verified to
contain the 42 irreplaceable recordings and 10 specialist verdicts. Word rotation
shows zero overlap between consecutive sessions at every level.

---

## 10. Security, privacy and data governance

### 10.1 Access control

Every check is server-side, in this repository, and covered by `api-audit`.
Supabase Auth is deliberately unused so that authorization is not split across
two systems.

Learners can read and export **only their own** data. Specialists can read all
learners. Specialist registration requires `SPECIALIST_CODE` and stays disabled
until it is set.

### 10.1a The second door: the Supabase Data API

An earlier draft of this section said RLS was "deliberately unused". That was a
description of the application and a mistake about the database, and the
distinction turned out to matter more than the sentence did — see §8.14.

Supabase serves a PostgREST endpoint alongside the Postgres one and grants the
`anon` role full DML on the public schema by default. RLS is the mechanism meant
to hold that back. It had never been enabled, because Prisma does not create
policies and nothing else did either.

Verified by probe on 12 August 2026, before the fix:

| Question | Method | Answer |
|---|---|---|
| Is the Data API live? | `curl .../rest/v1/` | Yes — `401 No API key found`, i.e. PostgREST answering |
| Is RLS on? | `pg_tables.rowsecurity` | `false` on all 11 tables |
| What can `anon` do? | `information_schema.role_table_grants` | `SELECT, INSERT, UPDATE, DELETE, TRUNCATE` on every table |
| Was the anon key ever leaked? | `git log -S`, `git grep` over all commits | No — never committed, and no Supabase client in the tree |

The remedy is two layers. The Data API is disabled in the dashboard, which is
sufficient on its own and costs nothing because LEXORA uses no PostgREST. RLS is
then enabled on all 11 tables with no policies — deny-by-default — so that
re-enabling the endpoint later, by a person or by a change in Supabase's
defaults, does not reopen the hole. Prisma is unaffected: it connects as
`postgres`, which holds `BYPASSRLS`, and that was measured rather than assumed.

Writing RLS *policies* was rejected. There is no PostgREST client to grant access
to, so a policy would have nothing to express, and a wrong policy resembles
protection in a way a disabled endpoint does not.

One property of `BYPASSRLS` is worth recording because it defeats the obvious way
to test this: it outranks `FORCE ROW LEVEL SECURITY`. Enabling `FORCE` on a table
does not blind a `BYPASSRLS` role — measured at 76 `PhonItem` rows both before and
during. Rehearsing the silent-zero-rows failure means running as a role without
the attribute; `FORCE` alone proves nothing.

**A third layer, added 12 August** (`20260812150000_revoke_anon_grants`). The
dashboard toggle stayed open longer than expected, so the grants underneath it
were removed instead: `anon` and `authenticated` had 77 table grants each, which
RLS emptied but did not revoke. Two things that closed.

The first is schema disclosure — PostgREST builds its OpenAPI description from
what the requesting role can see, so the grants let an anonymous request
enumerate table and column names even with every row denied. The second matters
more: while the grants existed, RLS was the *only* barrier, and a single table
created without it, or one `DISABLE ROW LEVEL SECURITY`, would have handed
`anon` the database. Revoking makes the two independent — a future mistake now
has to undo a grant *and* a policy.

`ALTER DEFAULT PRIVILEGES` is the part that makes it durable: without it the next
migration to create a table would grant `anon` afresh, and the revoke would
quietly stop being true. Verified after applying — `anon` and `authenticated` at
0 table grants, `service_role` still at 77 (the dashboard's own editor uses it),
and the app reading all 203 attempts unchanged.

**One line of that migration did nothing, and the comment inside it overstates
what it achieved.** `REVOKE USAGE ON SCHEMA public FROM anon` is a no-op: the
privilege is held by `PUBLIC` (`=U` in `nspacl`), not by the role, so `anon`
still has `USAGE`. Removing it would mean revoking from `PUBLIC`, which reaches
every role on the instance for a benefit that is already covered — with zero
table grants there is nothing inside the schema to name. The migration was left
unedited because Prisma checksums applied migrations and rewriting one breaks
every later `migrate deploy`; the correction lives here and in the assertion
instead. `api-audit` §9b now asserts the grant counts directly, which is the
durable form: a comment cannot notice when it stops being true.

Residual, recorded rather than chased: the `supabase_admin` default privileges
still name `anon`, but those apply only to objects that role creates, not to
LEXORA's tables.

The auth rate limiter counts **only failed attempts**, because everyone at the
partner institution shares one public IP and counting successes would let a class
of children signing in one after another lock each other out.

### 10.2 Data protection (RA 10173)

- **Learner data lives in one Supabase Postgres database and nowhere else.**
- **Recordings are deleted automatically** after `RECORDING_RETENTION_DAYS`
  (default 180). Only the audio goes — transcripts, scores, error types and
  reviews survive, so **no reported figure changes** when a recording expires.
  `/privacy` states whichever window is configured, reading the same constant the
  sweep enforces, so the number shown to families and the number enforced are the
  same by construction.
- **A specialist can clear recordings or erase a participant entirely** at any
  time, from the learner page. Erasure cascades.
- **Audio is not retained by the ASR provider for training.**
- **Fine-tuning was rejected partly on consent grounds** (§1.6): using recordings
  as training data is a different processing purpose from the assessment purpose
  parents consented to.

### 10.3 Backups

Supabase's free tier takes **no automatic backups**, and reading data collected
from children cannot be gathered again.

`npm run backup` writes a single gzipped JSON dump of every table using the `pg`
client, so no Postgres tooling has to be installed. Roughly 10 MB compressed,
most of it audio.

**"Every table" was not true when this document first claimed it.** `TABLE_ORDER`
in `scripts/db-tables.ts` is hand-maintained, and it fell behind migration
`20260811050000`: `ReviewErrorTag` was added to the schema and not to the list,
so for a day every backup omitted the specialist observation tags while printing
a success line and a row count. `SpeechClip` had never been on the list at all.
Discovered on 12 August while taking the safety backup before the RLS work — the
table list printed by the run did not match the schema.

Nothing was actually lost: `ReviewErrorTag` held 0 rows, because no specialist
had tagged anything yet. The gap would have started costing real data the moment
one did, and those tags are a person's judgement of what they heard — not
derivable from anything else in the database.

The list is now checked against `pg_tables` before a byte is written, and a table
it does not recognise aborts the run. Hand-maintained lists that must track a
schema do not stay correct; the fix is not to add two names but to make the
omission impossible to ship quietly.

**`--verify` performs the entire restore inside a transaction, checks every row
count, then rolls back** — proving the file is genuinely restorable without
touching live data. An untested backup is not a backup.

`scripts/schedule-backup.ps1` registers a daily Windows task, configured to run
whether or not the laptop is on mains and to catch up after sleep — a study
laptop is closed most of the day, so a task that only fires at exactly 20:00
while plugged in would mostly never fire.

**The backup stays on the local machine on purpose.** It contains children's
voice recordings and this repository is public; a GitHub Actions artifact would
be downloadable by anyone.

---

## 11. Deliberate exclusions

Recorded in full in [`docs/deferred-ideas.md`](deferred-ideas.md). Summarised
here because "why didn't you build X?" is a defense question.

| Not built | Reason |
|---|---|
| Whisper fine-tuning | Unsound three ways at n=5 (§1.6) |
| In-app significance testing | Five children cannot support a p-value; the test belongs to the analysis |
| Per-learner calibration thresholds | 30 labelled readings are needed to fit one honestly; five children cannot each supply 30 |
| Phonological clustering heatmap | Tag coverage starts at zero; a heatmap over three tagged misreadings would be read as a profile |
| Automated stress detection | Needs pitch and duration analysis a transcription API does not expose — a second audio pipeline for one feature |
| Sentence and phrase reading | Excluded by the study's own delimitation (§1.2) |
| Select-to-speak across the interface | Text selection needs a long-press and two drag handles on the partner's tablets; and it must never work inside a scored activity, where a child could have the app pronounce the target word and silently invalidate accuracy, decoding time, the adaptive level and the probe |
| Offline-first sync | Brings conflict resolution and a second copy of children's recordings on a shared tablet — a privacy surface needing its own consent discussion |
| Bulk phase tagging | Fine one at a time for five children; would not be for fifty |
| Cohort print view | Per-learner reports print; the cohort page does not |

---

## 12. Limitations to state in the paper

Five, each already visible in the application rather than discovered at
write-up.

1. **Stress is undetectable.** Filipino stress is unwritten and meaning-bearing,
   the transcript does not encode it, and readings differing only in stress are
   scored identically. Since stress errors are a documented marker of dyslexia in
   Filipino, this belongs in the delimitations. Mitigated only by the specialist's
   ear (§1.3, §6.5).

2. **ASR agreement is known to be lower for readers with disabilities** — which
   is the entire participant group. Published figures from typical readers should
   not be assumed to transfer (§4.4).

3. **The variant list was derived from synthesized speech.** In an integration
   probe over 25 words, Whisper matched the target exactly on 20/25 before
   variants. **Every miss was a Marungko stage 7 loanword or digraph** (`krus`,
   `dyip`, `tsinelas`, `mangga`, `bulaklak`), and two of them returned a
   *different* spelling on each run. The list should be re-validated against real
   recordings during the reliability check, and stage 7 items warrant closer
   specialist attention when computing agreement.

4. **Anchored reviews exist and cannot be undone.** Every review recorded before
   blind review was built has `blind = false` and its label was formed with the
   machine's verdict visible. The application reports the two populations
   separately rather than merging them, which turns the flaw into a measurable
   quantity — but the flaw is real (§6.3).

5. **Retry exclusion is a defensible choice, not a neutral fact.** It should be
   stated in the methodology, with the reason (§6.1).

---

## 13. Outstanding work

**None of it is code.** The feature freeze is in effect.

### 13.1 Security — must be done before any real child is enrolled

These get **worse** with time rather than staying still. Right now the database
holds nothing but demo history and the exposure is survivable. The day a real
child's recording is in there, it stops being survivable.

**Done (12 August 2026).** RLS enabled on all 11 tables, migration
`20260812010000`; backup coverage repaired and made self-checking; three new
assertions in `api-audit`; `npm run secrets:check` and `npm run password:set`
written. See §8.13–8.14.

**A gap found while acting on item 3 below.** LEXORA had no way to change a
password at all — no UI, no API route, no script. `bcrypt.hash` runs once at
registration and nothing ever updated the column again. Beyond making these
rotations impossible, that left **no recovery path for a participant who forgets
their password**: the only available action was deleting the account, which
cascades and would take every reading, recording and specialist verdict with it.
Five children over eight weeks will forget a password.
`scripts/set-password.ts` closes both. It refuses any value it can find in git
history, enforces 12 characters for a specialist against the app's 6 for a
learner, never accepts the password as an argument (shell history), and verifies
the change against the stored hash before reporting success.

**Active sessions survive a rotation, by design.** The session is a stateless JWT
signed with `AUTH_SECRET`, so no request asks the database whether the password
has changed; an issued cookie stays valid for its remaining 7 days
(`MAX_AGE`, `src/lib/auth.ts`). This is fine here and no mechanism was built, but
it is written down — and asserted in `api-audit` §11 — because it would otherwise
be reported as the rotation having silently failed. If every session ever needs
ending at once, rotating `AUTH_SECRET` invalidates every issued cookie.

**Outstanding.** The first is a dashboard action, the rest are rotations.

1. **Disable the Supabase Data API** — Settings → Data API. RLS already denies
   the `anon` role, so this is the second layer rather than the first, but it
   removes the endpoint instead of guarding it. Verified by
   `npm run audit:api`, which fails while PostgREST still answers.

2. **Rotate `SPECIALIST_CODE`** — Vercel → environment variables → redeploy.
   The highest-severity of the three: it gates every child's record and
   recording, and anyone holding it can self-register as a specialist without
   needing an account to begin with. The published value is `READINGOWL`.

3. **Change the specialist account password.** `specialist@lexora.ph` /
   `lexora123` still works — §8.2 stopped it being advertised, not being valid.

   ```bash
   npm run password:set -- specialist@lexora.ph --generate
   ```

   Then set `AUDIT_SPECIALIST_PASSWORD` in `.env` to the value it prints, or all
   ten audit suites fail at their opening sign-in.

4. **Re-credential the demo learners** rather than deleting them.

   ```bash
   npm run password:set -- learner1@lexora.ph --generate --random
   npm run password:set -- learner2@lexora.ph --generate --random
   ```

   `--random` because nobody types these by hand; the specialist account gets a
   passphrase instead, since three specialists sign in with it on a tablet at the
   start of every session and an unmemorable password on a shared device becomes
   a sticky note beside it. The security
   requirement is only that no account whose password sits in git history
   survives to enrolment, and re-credentialing meets it while keeping
   `learner1`'s fabricated history — which is what makes a defense demo show
   populated charts. Deleting would mean re-seeding later, and `prisma db seed`
   **wipes every table first**, which is not an operation to want near the study
   database. The `isDemo` quarantine (§6.2) is a research-integrity decision and
   is unaffected either way. Keep `NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS` unset.

5. **Never accept Prisma's "reset database" prompt** against the live study
   database. Use `migrate deploy`, never `migrate dev`.

**Git history is permanent, and rotation does not clean it.** The old values stay
readable in this public repository forever; rotation invalidates them, which is
the entire point, but it means the new values must never enter the repository at
all — environment variables and a password manager only, with `.env.example`
staying an example. `npm run secrets:check` is how that is confirmed rather than
assumed: it presents each published value and requires a refusal, and it searches
the tracked tree *and every commit* for the values now in use, because a new
secret that gets committed is not a rotation but a slower leak.

As of writing it reports three failures, which is the truthful state:

```
[1] registering a specialist with the published code is rejected   FAIL
[2] specialist@lexora.ph cannot sign in with the published password FAIL
[3] SPECIALIST_CODE has actually been rotated                       FAIL
```

They should all read `ok` before the first child reads into the application.

### 13.2 Study execution

- Enrol the five participants as their **own accounts**, not the demo ones.
- **Tag a baseline before anything else.** The pre/post comparison can only use
  sessions someone marked, and a baseline nobody tagged cannot be recovered
  afterwards except by guessing from timestamps — which is exactly what the
  tagging exists to avoid.
- Review roughly 30 readings **blind**, to reach `MIN_SAMPLE` for the
  calibration.
- Run one probe run per child per phase — 8 items, behind the 7-day cooldown.
- Check each tablet at `/diagnostics` before the first session.
- Back up before and after every session; run `--verify` on each.

### 13.3 Instruments not built in this repository

- The ISO/IEC 25010:2023 questionnaire (5-point Likert, specialists)
- The 3-point pictorial scale (children)
- Consent and assent forms

---

## 14. A closing note on method

A pattern ran through this project that is worth stating because it shaped how
the verification was built.

**The failures that mattered here were the ones that looked like success.** A
green check that tested nothing (§8.9). A fingerprint that "changed" to the md5
of an empty string. A blind-review flag that silently rewrote itself in the
direction that would raise no alarm (§8.4). A cohort chart that would have
rendered a convincing dyslexia error profile invented by a seed script (§6.2). A
`0/8` on a perfect run (§8.1).

None of those announce themselves. Each was found by asking what a result would
look like if the thing being measured were absent, and then checking whether the
observed result was distinguishable from that.

That is also why every analysis panel in the application declares its own
minimum and refuses to draw below it, why coverage percentages travel with every
distribution, and why the phase comparison stops at descriptives. The
instruments are built to be honest about their own limits.

What they need now is five children reading into them.

---

*Written at the point of feature freeze, 11 August 2026, against commit
`6101208`. Every claim above is traceable to a file, a migration or a commit in
this repository.*
