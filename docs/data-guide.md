# LEXORA — Data Gathering and Analysis Guide

Every piece of data the study collects: what it is, how it is produced, what to
do with it, and why it is done that way.

This is the companion to Chapter 3 (Methodology) and Chapter 4 (Results). The
[operating manual](user-manual.md) says which buttons to press; this says what
comes out and what it means. **The capstone proposal is the authority on the
design:** its six objectives, its descriptive statistical treatment and its
ethics commitments decide what is analysed here, and anything the application
records beyond them is labelled supplementary (§5.8). Where the application and
the proposal differ, [`proposal-alignment.md`](proposal-alignment.md) lists it.

**Every number, column name and threshold in this document was checked against
the running application, not written from memory.** Where a figure comes from the
code, the file is named so a future change is traceable.

- [1. What data exists at all](#1-what-data-exists-at-all)
- [2. Data dictionary — every column](#2-data-dictionary--every-column)
- [3. The gathering protocol](#3-the-gathering-protocol)
- [4. The evaluation instruments](#4-the-evaluation-instruments)
- [5. Analysis, objective by objective](#5-analysis-objective-by-objective)
- [6. Tables for Chapter 4](#6-tables-for-chapter-4)
- [7. Limitations](#7-limitations)

---

## 1. What data exists at all

Three layers. They differ in how they are produced, and therefore in how far
they can be trusted and what happens if you neglect them.

### Layer A — Machine-generated

Written automatically whenever a child reads. Complete, timestamped, and
entirely without human judgement.

| Data | Where |
|---|---|
| Every word reading: target, transcript, correct/incorrect, similarity | `Attempt` |
| Which recogniser scored it, and the other engine's transcript | `Attempt.engine`, `altTranscript` |
| Response time in milliseconds | `Attempt.responseMs` |
| Error type: substitution / omission / insertion / no-response | `Attempt.errorType` |
| The voice recording | `Attempt.audio` (deleted after 180 days) |
| Activity sessions, duration, completion | `ActivitySession` |
| Adaptive level and Marungko stage over time | `Attempt.levelAtTime` |
| Practice list and mastery | `PracticeItem` |

**This layer needs no effort and answers no question on its own.** It tells you
what the machine thought. Whether the machine was right is Layer B.

### Layer B — Human judgement, recorded inside the app

Produced only when a reading specialist sits down and does it. **This is the
layer the study's central claims rest on, and it does not accumulate by itself.**

| Data | Where | Without it you lose |
|---|---|---|
| Specialist verdict on a recording | `AttemptReview.agrees` | Objective 2 entirely — no percentage of agreement, and no evidence for refining the threshold |
| Whether the verdict was made blind | `AttemptReview.blind` | The ability to show the verdicts were independent of the machine's |
| Observation tags (vowel, cluster, stress…) | `ReviewErrorTag` | Any error profile that describes the child rather than the recogniser (Objective 5) |
| Probe verdicts, scored by ear | `AttemptReview` on `isPseudo` items | The probe record — supplementary (§5.8) |
| Phase tags, optional: BASELINE / REGULAR / ENDLINE | `ActivitySession.phase` | The start-and-end-of-testing record — supplementary (§5.8) |

**A study that collects Layer A diligently and Layer B sporadically has a large
dataset and no findings.** Section 3 is built around this.

### Layer C — Outside the application

The app will never produce these. They do not exist yet.

| Data | Instrument | Status |
|---|---|---|
| ISO/IEC 25010:2023 ratings, 3 specialists — Objective 6 | 5-point Likert questionnaire | **Drafted** — [`instruments/03`](instruments/03-iso-25010-questionnaire.md), needs ethics review |
| Children's acceptance, 5 participants — Objective 6 | 3-point pictorial scale | **Drafted** — [`instruments/04`](instruments/04-pictorial-scale.md), needs ethics review |
| Specialist verification — Objectives 1, 3, 4, 5 | Verification sheet | **Drafted** — [`instruments/06`](instruments/06-objective-verification.md), needs ethics review |
| Interviews with the specialists; parents as key informants | Interview guides | **Drafted** — [`instruments/07`](instruments/07-interview-guides.md) |
| Consent (parents) and assent (children) | Forms | **Drafted** — [`instruments/01`](instruments/01-consent-parent.md), [`02`](instruments/02-assent-child.md), need ethics review |
| Participant characteristics: age, sex, grade, prior diagnosis | Intake sheet | **Drafted** — [`instruments/05`](instruments/05-intake-and-field-log.md) |
| Structured observation: usability issues, technical errors, points of confusion | Field log | **Drafted** — [`instruments/05`](instruments/05-intake-and-field-log.md) |

That last one is easy to skip and hard to reconstruct. When a child's accuracy
drops 30 points in one session, the field log is the only thing that will ever
tell you the aircon was being repaired that afternoon.

---

## 2. Data dictionary — every column

Six CSV exports (105 columns) plus one plain-text export. All are UTF-8 with a
BOM, so Excel and SPSS open them without mangling Filipino characters.

Download from the specialist dashboard, or:
`/api/export?what=<name>[&learnerId=…]`

### 2.0 Four filters that silently corrupt an analysis

Read these before computing anything.

**① `is_retry = 1` — exclude from every accuracy and latency figure.**

A retry is the second reading in the *"Now you try it!"* correction, taken after
the child has just heard the word pronounced. Instructionally it is the point of
the exercise. Statistically it is not an independent measure of decoding.

Measured on the current data — the inflation is small but systematic and always
upward:

| Learner | First readings only | Retries included |
|---|---|---|
| Ana | **63.6%** (n=22) | 65.4% (n=26) |
| Juan | **81.7%** (n=126) | 81.9% (n=127) |

The left column is correct and matches what the app reports. Report retries
separately as re-reads after modelling (`retries`, `retries_correct`,
`retry_success_pct`) — a real and interesting behaviour, just not accuracy. Do not
call them self-correction: in running-record terms that is a child fixing an error
unprompted, which the specialist records separately as the `self_corrected` tag.

**② Demo learners — never include them.**

`learner1` (Juan) and `learner2` (Ana) carry a fortnight of *fabricated* history.
`mutate()` in `prisma/seed.ts` invents misreadings by swapping `b↔d`, `p→b`,
`m↔n`, `u→o`, `e→i` — very nearly the textbook dyslexia error profile. Mixed
with real participants it does not look like noise, it looks like a finding.

They are excluded by default. **Never pass `&includeDemo=true` for analysis.**
Check every file you analyse: if `learner` is Juan or Ana, you have the wrong
export.

**③ `pseudo_scored` is the probe denominator — not `pseudo_items`.**

A probe item a specialist has not yet listened to is neither correct nor
incorrect. Dividing by `pseudo_items` counts unreviewed items as failures and
understates the child.

**④ Tag coverage must travel with any error distribution.**

Tagging is optional by design — a blank is honest missing data. So a tag
distribution describes only the misreadings someone tagged. Always report
"categories recorded for N of M reviewed misreadings (X%)" beside it.

### 2.1 `attempts` — 28 columns, one row per word reading

The raw data. Everything else can be recomputed from this.

| Column | What it is |
|---|---|
| `attempt_id` | Unique id |
| `learner` | Display name |
| `timestamp_iso` | When |
| `activity_type` | `READ_ALOUD`, `PRACTICE`, `PSEUDO_PROBE`, `LISTEN_CHOOSE`, `BLEND`, `SYLLABLES`, `RHYME`, `FIRST_SOUND` |
| `target_word` | The word shown. Denormalised, so history survives word edits |
| `syllables` | Hyphenated, e.g. `ba-hay` |
| `pattern` | CV, CVC, CVCV, CCVC … |
| `pattern_family` | Collapsed into six instructional families (§5.5) |
| `word_stage` | Marungko stage 1–7 |
| `word_level` | Difficulty 1–5 |
| `level_at_time` | The learner's level when they read it — use this, not their current level, for anything historical |
| `transcript` | What the recogniser heard |
| `asr_engine` | `server` (Whisper) or `browser` (Web Speech, used only when Whisper could not be reached); blank when nothing was heard. Report how many readings each engine scored, and repeat accuracy without the `browser` rows as a sensitivity check — the fallback is a weaker recogniser, and before 7 October it kept whichever of five guesses was closest to the target, which favours "correct" |
| `alt_transcript` | The other engine's transcript, when both ran |
| `correct` | The machine's verdict, 1/0 |
| `similarity_score` | Levenshtein similarity 0–1 — the continuous variable the calibration sweeps |
| `error_type` | `correct`, `substitution`, `omission`, `insertion`, `no_response` |
| `response_ms` | Time to answer |
| `has_audio` | Whether a recording is still stored |
| `specialist_review` | `agree` / `disagree` / blank — whether the specialist agreed with the machine. Filter on these exact values |
| `is_retry` | **Filter ①** |
| `study_phase` | `BASELINE` / `REGULAR` / `ENDLINE` |
| `is_pseudoword` | 1 = probe non-word |
| `specialist_correct` | The specialist's own verdict, 1/0, blank if unreviewed. **This is the ground truth**, on both real and probe words |
| `stress_pair` | Non-empty where meaning depends on unwritten stress — `correct` on these rows is not evidence about stress |
| `review_blind` | 1 = the machine's transcript, verdict and similarity were hidden until the specialist had judged; 0 = anchored; blank if unreviewed. Lets the blind percentage of agreement (§5.2) be recomputed from the rows |
| `learner_id` | A stable, meaningless id for the child — the join key across `attempts`, `sessions` and `summary`. Join on this, never on `learner`: two children can share a first name |
| `review_tags` | What the specialist heard, semicolon-separated tag ids (`vowel;stress`), from the vocabulary in §5.5. Blank on a reviewed row means *untagged* — honest missing data, so apply filter ④ |

**`specialist_review` vs `specialist_correct`.** The first stores whether the
specialist *agreed with the machine*; the second is their own verdict, already
converted for you. Use `specialist_correct`. Confusing the two inverts your
results on every reading the machine got wrong.

### 2.2 `sessions` — 12 columns, one row per activity

`session_id`, `learner`, `timestamp_iso`, `activity_type`, `items`, `correct`,
`accuracy_pct`, `duration_ms`, `level_at_time`, `study_phase`, `completed`,
`learner_id`.

- `completed = 0` — the child started and left partway. The words they read are
  real data; the session is just unfinished. Exclude these when counting
  activities completed, keep their minutes.
- Probe sessions show `correct = 0` **by design** — the verdict comes later from
  a specialist. Do not read it as eight failures.
- Only sessions with `items > 0` appear.

### 2.3 `summary` — 28 columns, one row per learner

Pre-aggregated, and every figure already applies filter ①. This is the
convenient file; `attempts` is the authoritative one.

**Identity** `learner`, `learner_id`, `level`, `marungko_stage` — no email: an
analysis needs a join key, not a way to contact the family

**Pseudonymising before the data leaves the research team.** `learner` is the
display name the child was registered under — their participant code, if they
were enrolled as §3.1 says. If any child was registered under a name, map their
`learner_id` to its code (`L1`…`L5`) using the intake sheet, replace `learner`
with that code in every file, and only then share. The id itself identifies no one — it is
a random string — but it must not be published next to anything that does.

**Accuracy** `oral_attempts`, `oral_correct`, `oral_accuracy_pct`

**Error profile** `substitution`, `omission`, `insertion`, `no_response`

**Engagement** `sessions_completed`, `sessions_partial`, `minutes_practiced`,
`practice_words_active`, `practice_words_mastered`

**Agreement** `attempts_reviewed`, `reviews_agreed`, `agreement_pct` — over
first readings of real words (`READ_ALOUD`, `PRACTICE`, `is_retry = 0`), the same
population the `calibration` export fits. Probe reviews are *not* in it: on a
non-word the recogniser returns the nearest real word, so its verdict is wrong
by construction and would pull agreement down whenever a child decoded well.
They are reported in the `pseudo_*` columns instead.

**Re-reads after modelling** `retries`, `retries_correct`, `retry_success_pct`

**Decoding latency** `median_decode_ms`, `timed_readings` — median milliseconds
over correct, first, plausible readings

**Probe** `pseudo_items`, `pseudo_scored`, `pseudo_correct`,
`pseudo_accuracy_pct` — see filter ③

### 2.4 `calibration` — 16 columns, one row per candidate threshold

The threshold sweep, 0.50 to 1.00 in steps of 0.01 (51 rows).

`threshold`, `true_positive`, `false_positive`, `true_negative`,
`false_negative`, `n_reviewed`, `accuracy`, `sensitivity`, `specificity`,
`precision`, `cohens_kappa`, `matthews_mcc`, `youden_j`, `marker`,
`in_plateau`, `in_bootstrap_ci`

- Positive class = "the specialist judged this read correctly".
- `marker` flags the current setting and the fitted optima.
- `in_plateau = 1` — within 0.01 MCC of the peak. **If many rows carry it, the
  optimum is weakly identified and the single best value must not be quoted
  alone.**
- `in_bootstrap_ci = 1` — inside the 95% interval over 1,000 resamples.

### 2.5 `agreement-conditions` — 12 columns, two rows

`condition` (blind / anchored), `n_reviews`, `threshold`, the four confusion
cells, `accuracy`, `sensitivity`, `specificity`, `cohens_kappa`, `matthews_mcc`.

The blind row's `accuracy` is the percentage of agreement for Objective 2; the
anchored row is reported beside it. See §5.2.

### 2.6 `phase-comparison` — 9 columns, two rows

`phase`, `readings`, `correct`, `accuracy_pct`, `median_decode_ms`,
`probe_reviewed`, `probe_correct`, `probe_accuracy_pct`, `untagged_readings`.

`untagged_readings` counts readings with no session and therefore no phase. They
are **complete records**, counted in every other export, and excluded from this
table alone. Report the number; do not describe them as errors.

### 2.7 `iep` — plain text, per learner

A reading summary for pasting into a DepEd IEP. Not analysis data. Refuses to
generate for a demo learner.

---

## 3. The gathering protocol

The proposal's order is **validation, then evaluation**: the speech-recognition
check and the scoring review are "completed prior to the final evaluation of the
system", and the questionnaires come last. Each step below names what it
produces, so a skipped step has a visible cost.

### 3.1 Before the first child

| Action | Produces |
|---|---|
| Ethics clearance from the HCDC research ethics review committee, and the partner institution's written approval | Permission for any data gathering at all (proposal, *Informed Consent*) |
| Specialist consultation — [`consultation-brief.md`](consultation-brief.md), every decision ticked and the content signed off | "The instructional content is reviewed by the reading specialists for appropriateness before use" (proposal, *Data Set*) |
| Research adviser and subject-matter experts review the ISO questionnaire | The instrument review the proposal requires before administration |
| Consent from parents, assent from children, consent from the three specialists | The ethical basis for everything below |
| Set `ENROLMENT_CODE` on Vercel; rotate the demo passwords (manual §7.1) | Only enrolled children can register |
| **Enrol each child under their participant code** — name `L1`, email `l1@participant.lexora` — never their real name | Records held "under a coded learner identifier" (proposal, *Privacy and Confidentiality*) |
| Intake sheet per child ([`instruments/05`](instruments/05-intake-and-field-log.md)) | The participants table |
| `/diagnostics` on every device and browser to be used, copied into the device validation log ([`instruments/05`](instruments/05-intake-and-field-log.md) §2) | ASR integration validation "across the supported browsers and microphone configurations" (proposal, *Validation*) — the page keeps nothing, so the log is the record |
| Specialist sets each child's starting level | Sensible first sessions instead of everyone at level 1 |
| `npm run backup` | A restore point |

### 3.2 Every session

- The child signs in under their code.
- **Pair a listening activity with a reading activity.** One of *Blend the parts*,
  *Count the syllables*, *Rhyme time* or *First sound*, and one *Read aloud* run.
  The skill-progression map needs both to move a child up a level
  (`src/lib/adaptive.ts`): a child who only reads aloud never shows the
  phonological-awareness criterion and stays where they are.
- **Structured observation** in the field log: usability issues, technical
  errors, how the child interacted, and any point of confusion — the proposal's
  observation categories. Draw a dash when there was nothing.
- `npm run backup` afterwards.

### 3.3 Weekly, by the specialist — the scoring review (Objective 2)

This is the work that turns recordings into the percentage of agreement.

1. **Review blind** (the default). The machine's verdict stays hidden until the
   specialist has given theirs. Do not switch to quick review without a reason;
   note it if you do.
2. **Aim for 30 reviewed readings across the children as early as possible.**
   `MIN_SAMPLE = 30` in `src/lib/calibration.ts` is the point at which the
   application will suggest whether the acceptance threshold should move. The
   proposal: "Discrepancies will be documented and used to refine the scoring
   logic and the feedback thresholds". The suggestion is that refinement; the
   application never moves the threshold by itself.
3. **Tag observations** where confident (vowel, cluster, stress…). Coverage is
   reported, so partial tagging is honest.
4. *Optional:* one decoding-probe run per child, rested 7 days between runs
   (`PROBE_COOLDOWN_DAYS`), scored by ear. A supplementary record (§5.8).

### 3.4 Near the end of testing — the specialists' verification (Objectives 3 and 4)

[`instruments/06`](instruments/06-objective-verification.md), per child:

1. **Part C first, blind:** the specialist records their own assessment of the
   child's decoding level *before* opening the learner's page.
2. Then **Part B:** the practice list, word by word, against the words the child
   most often misreads — using the *confirmed · overturned* evidence shown beside
   each practice word.

### 3.5 Close-out — the evaluation, then the deletion

**Evaluation** (the proposal's final evaluation, after validation):

- ISO/IEC 25010 questionnaire to the three specialists ([`instruments/03`](instruments/03-iso-25010-questionnaire.md))
- Instrument 06, Parts A and D, to the three specialists
- Pictorial scale to the five children ([`instruments/04`](instruments/04-pictorial-scale.md)),
  with a specialist, teacher or guardian present
- Interviews with the specialists, notes kept by theme (§5.7)

**Then the data:**

1. Download all six CSV exports **without** `includeDemo`. They hold no audio.
2. Record the application version: `git rev-parse --short HEAD`.
3. **Delete every recording.** On each learner's page, *Clear recordings*. The
   proposal: audio is "retained only for the duration of the evaluation phase,
   after which all audio files will be permanently deleted". Every learner page
   should then show no recordings.
4. **Take one new backup, then delete every earlier backup file and every copy of
   one** — on this laptop, on drives, in cloud folders. Each backup taken before
   step 3 holds the recordings, and `npm run backup` says so when it writes one.
   Deleting them in the application does not reach those files.

---

## 4. The evaluation instruments

All are drafts in [`instruments/`](instruments/), and need adviser and
ethics-committee review before use.

### 4.1 ISO/IEC 25010:2023 questionnaire — the three specialists (Objective 6)

[`instruments/03`](instruments/03-iso-25010-questionnaire.md). **All nine
characteristics the proposal names are rated:** Functional Suitability,
Performance Efficiency, Compatibility, Interaction Capability, Reliability,
Security, Maintainability, Flexibility, Safety. Maintainability and Flexibility
are worded around what a specialist could see during the study — changing the
word bank without a developer, an error message that explained itself, using it
on several devices — rather than developer concepts like modularity.

**Verify the characteristic names against the standard itself before printing.**
The 2023 revision renamed Usability to Interaction Capability and Portability to
Flexibility, and added Safety — as the proposal itself says.

**Five-point scale, Table 1 labels exactly:** 5 Strongly Agree (4.21–5.00),
4 Agree (3.41–4.20), 3 Neutral (2.61–3.40), 2 Disagree (1.81–2.60),
1 Strongly Disagree (1.00–1.80).

**Triangulate.** Several characteristics have objective evidence in this
repository — accessibility checks, performance budgets, authorization tests. Put
it beside the weighted mean; a characteristic that measures well but rates poorly
is the interesting finding.

### 4.2 Three-point pictorial scale — the five children (Objective 6)

[`instruments/04`](instruments/04-pictorial-scale.md). Eight items on usability,
ease of use and accessibility, read aloud. **Nothing on it asks whether the child
read better** — the study does not measure gains. Administered "with assistance
by the researchers in the presence of a reading specialist, teacher, or
guardian"; choose the researcher the child knows least, because acquiescence
toward a familiar adult is the main threat here.

### 4.3 Specialist verification sheet (Objectives 1, 3, 4, 5)

[`instruments/06`](instruments/06-objective-verification.md). Four of the six
objectives end in a specialist's judgement. Part A rates how far the features
address the reading-access needs the specialists identified; Part B checks the
practice lists; Part C compares levels, blind; Part D rates the usefulness of each
part of the progress dashboard.

### 4.4 Interviews and structured observation (qualitative)

Interviews with the specialists — requirements at the start, recommendations at
the end — and the field log's structured observation, using the guides in
[`instruments/07`](instruments/07-interview-guides.md). Parents are key
informants: what they say informs the design, and is not tabulated as a finding. The proposal organises
both "by theme" to explain the quantitative results and to identify "usability
and accessibility issues for the succeeding development iteration".

---

## 5. Analysis, objective by objective

### 5.0 The statistical treatment — as the proposal states it

"The data gathered will be subjected to **descriptive treatment only**. No
inferential statistical tests will be applied, and no claim of statistical
generalizability is made." Four measures, and only these as the study's results:

| Measure | Applied to | Formula |
|---|---|---|
| **Frequency and percentage** | The children's pictorial-scale responses, per item; the verification percentages (Objectives 3 and 4); the records in Objective 5 | f, and f ÷ n × 100 |
| **Weighted mean** | The specialists' ratings: ISO/IEC 25010 (Objective 6) and instrument 06 Parts A and D | WM = Σ(f × w) / n, read with Table 1 |
| **Percentage of agreement** | System scoring against the specialist's, on the same recordings (Objective 2) | PA = items scored identically ÷ items scored × 100 |
| **Qualitative analysis** | Interviews and structured observation | Organised by theme |

The five children and three specialists are the **total enumeration** of those
eligible at the partner institution, not a sample, and the findings describe
LEXORA there. **The study does not measure gains in reading** — so no figure in
Chapter 4 is a change score, and none is tested for significance.

### 5.1 Objective 1 — the features against the reading-access needs

**Source** instrument 06, Part A.

**Present** each access need with the feature addressing it, its weighted mean
over the three specialists, the lowest and highest rating, and the Table 1
rating. A need no feature addresses is a finding; report it, do not drop it.

**Alongside** the children's view of the same features — pictorial items 4–6
(seeing the words, understanding the voice, hearing the words) — from §5.6.

### 5.2 Objective 2 — percentage of agreement

**Source** the `agreement-conditions` export, or `attempts`: first readings of
real words (`activity_type` `READ_ALOUD` or `PRACTICE`, `is_retry = 0`,
`is_pseudoword = 0`) that carry a specialist verdict (`specialist_correct` not
empty).

```
PA = rows where specialist_correct = correct  ÷  all such rows  × 100
```

**Report the blind reviews as the figure.** A verdict given with the machine's
answer on screen can be pulled toward it, so the blind row of
`agreement-conditions` (`accuracy` × 100) is the percentage of agreement the
study stands on. Report the anchored row beside it, with its n, as what it is;
do not pool them. `summary.agreement_pct` pools both and is the per-child view.

**The discrepancies are part of the result.** The proposal has them "documented
and used to refine the scoring logic and the feedback thresholds". Report the
two kinds separately:

| Discrepancy | Cell in the export | What it means |
|---|---|---|
| System accepted, specialist rejected | `false_positive` | A misreading the child was told was right — the costlier error |
| System rejected, specialist accepted | `false_negative` | A correct reading marked wrong, and put on the practice list |

and say what was done about them: the threshold the calibration suggested
(§5.8), whether it was adopted, and the PA at that threshold — re-scored from the
stored similarity, so both figures can be reported.

**Context, not a target.** Published figures for automatic scoring of
children's oral reading — κ = .54 with classification accuracy of 92% for human
scorers and 88% for ASR; MCC = 0.63 for the best of six systems on Dutch oral
reading — were measured on typically developing readers, and agreement was found
to be lower for students with disabilities, which is this whole group. The
proposal's own literature makes the same point (Kim et al., on mispronounced
items).

### 5.3 Objective 3 — the practice list against frequent misreads

**Source** instrument 06, Part B.

```
Correspondence = words marked Yes ÷ words marked Yes or No × 100
```

per child and for all five. Report *Cannot say* as its own count, and list the
words the specialist named as frequently misread but missing from the list —
the list's completeness, as distinct from its accuracy. Specialist-pinned words
are left out: they were not generated.

The **immediate pronunciation feedback** half of the objective is a feature to
describe and demonstrate (the corrective sequence: the verdict, the word
modelled, "Now you try"), supported by the specialists' ratings of A1 (the
functions they need) and G3 (feedback to the child is encouraging) on the ISO
questionnaire.

### 5.4 Objective 4 — the assigned level against the assessed level

**Source** instrument 06, Part C.

```
Correspondence = children whose LEXORA level matched the specialist's assessment
                 ÷ children assessed × 100
```

Report the direction of every mismatch, and **whether a specialist set the level
by hand** during the study — a hand-set level is not the system's assignment.
The skill-progression panel on each learner's page shows which criterion was
holding a child at their level at the end; quote it where it explains a
mismatch.

### 5.5 Objective 5 — what the progress dashboard recorded, and its usefulness

The proposal uses the system usage data "to demonstrate and evaluate the
application's progress-tracking functionality". So describe, per child, what it
recorded — then report how useful the specialists judged it.

**Reading accuracy** `summary.oral_accuracy_pct`, or from `attempts`:

```
accuracy = correct = 1 AND is_retry = 0 AND activity_type IN (READ_ALOUD, PRACTICE)
           ÷ all rows with is_retry = 0 and the same activity types
```

Retries measure repetition (filter ①). The listening activities are not oral
reading — `LISTEN_CHOOSE` is recognition, `BLEND` and `SYLLABLES` are syllable
awareness, `RHYME` and `FIRST_SOUND` are sound awareness — and are reported as
their own frequencies. Probe items are excluded (filter ③).

**Word-level error patterns — two views, kept apart.**

- *What the machine recorded:* `substitution`, `omission`, `insertion`,
  `no_response` per child, as frequency and percentage of misreadings. These
  describe the difference between two strings — the transcript and the target —
  not necessarily the child's phonology.
- *What the specialist heard:* `attempts.review_tags`. Error categories (vowel,
  first sound, last sound, digraph, consonant cluster, syllable dropped, syllable
  added, stress) are offered only on readings judged misread, so count them over
  rows with `specialist_correct = 0` — and **always report coverage**: "categories
  recorded for N of M reviewed misreadings (X%)". The behaviours (self-corrected,
  could not tell) are not errors and are counted over all reviewed rows.

Stress deserves its own sentence: Filipino does not write it, so *búkas* and
*bukás* reach the scorer as identical letters, and the specialist's ear is the
only instrument the study has for it. Eight bank words are flagged.

**By syllable-pattern family** `attempts.pattern_family` — Open (CV·CV), Closed
syllable, Vowel pair, Consonant cluster, ng words, Long (4+ syllables). "Reads
CVCV fine, misses clusters" points straight at what to teach next.

**Completed practice activities** `sessions` — count per activity type per child,
completed and partial; `summary.minutes_practiced`.

**Usefulness** — instrument 06, Part D: weighted mean per part of the dashboard,
Table 1, with the comments organised by theme.

### 5.6 Objective 6 — software quality and user acceptance

**ISO/IEC 25010** (instrument 03). Weighted mean per item and per
characteristic — all nine — with the Table 1 rating, the lowest and highest
rating, and the objective evidence beside it (§4.1). The proposal treats the
weighted mean "as a descriptive summary of the evaluators' assessment and not as
an estimate of a population parameter"; say so. No α, no ICC — three raters
cannot support them.

**Pictorial scale** (instrument 04). Per item, the frequency and percentage of
each face — with five children, each is 20%. Then each item's mean, Σ(f × w) / n,
read with Table 2 (2.34–3.00 Easy to Use; 1.67–2.33 Moderately Easy to Use;
1.00–1.66 Difficult to Use), always printed beside the frequencies it came from.
Report the practice-item result and who administered it.

### 5.7 Qualitative analysis

Interview notes and the field log's structured observation, coded into themes —
at least: usability issues, accessibility issues, technical errors, points of
confusion, and recommendations. For each theme: how often it came up, a short
quotation, and **what was changed in response** (SDLC Phase 6, review and
iteration). Use the themes to explain the numbers in §5.1–§5.6, as the proposal
intends, rather than as a separate chapter.

### 5.8 Supplementary records — not results of the study

The application records more than the proposal's analysis uses. These exist for
the specialist working with a child, and for the Validation discussion. **If any
appear in the manuscript, put them in an appendix or in the Validation section,
described as records — never as reading gains or reading rate.**

| Record | Source | What it is — and is not |
|---|---|---|
| Decoding time | `summary.median_decode_ms` over `timed_readings` | The median time to a correct, first, plausible reading (300 ms – 60 s). Response time is among the usage data the proposal lists; it is **not** a measure of reading rate or fluency, which the study excludes |
| Non-word probe | `summary.pseudo_*` | Made-up words scored by ear. Shows whether a child decodes or recognises the bank — useful for planning; **not** an outcome |
| Start and end of testing | `phase-comparison` | What the app recorded in sessions tagged `BASELINE` and `ENDLINE`. **Not** a pre/post measure: the study does not measure gains, and applies no tests |
| Threshold calibration | `calibration` (51 rows) | The evidence behind refining the acceptance threshold. κ, MCC and a bootstrap interval go beyond the proposal's statistics; use them, if at all, to explain *why* a threshold was chosen, and keep PA as the Objective 2 result |
| Blind against anchored agreement | `agreement-conditions` | How much seeing the machine's answer moved the specialists' verdicts — relevant to Objective 2's validity |

Three things about the calibration, if it is reported. *The sweep replays the
real scoring rule*, not `score >= t`: approved ASR spellings and words of three
letters or fewer are decided without the threshold. *Nothing is recommended
below 30 labelled readings.* And *a threshold changed after validation* means
readings before and after were scored by different rules — since similarity is
stored on every attempt, re-score and report both.

---

## 6. Tables for Chapter 4

One table per objective, in the proposal's order. Each needs a sentence saying
what it shows; numbers left alone get read however the reader is inclined. (The
proposal's Tables 1–6 belong to Chapter 3; number these to follow on.)

| Table | Objective | Rows | Columns |
|---|---|---|---|
| Participants | — | L1…L5 | Age, sex, grade, home language, prior assessment, starting level, sessions completed |
| Features and access needs | 1 | Each access need | Feature, weighted mean, lowest–highest, Table 1 rating |
| Percentage of agreement | 2 | Blind, anchored | Readings reviewed, scored identically, PA, the two discrepancy counts |
| Practice-list correspondence | 3 | L1…L5, all | Words on the list, Yes, No, Cannot say, correspondence %, words missing |
| Level correspondence | 4 | L1…L5 | Specialist's level, LEXORA's level, match, direction, hand-set? |
| Recorded reading performance | 5 | L1…L5 | Readings, accuracy %, error types f (%), observation coverage, activities completed |
| Usefulness of the reports | 5 | Each part of the dashboard | Weighted mean, lowest–highest, Table 1 rating |
| Software quality | 6 | The nine characteristics | Weighted mean, lowest–highest, Table 1 rating, objective evidence |
| User acceptance | 6 | The eight items | ☹️ / 😐 / 😊 f (%), mean, Table 2 rating |

**Figures worth having:** accuracy by pattern family per child as grouped bars;
the pictorial responses as stacked bars per item.

---

## 7. Limitations

1. **Filipino stress is undetectable** by the scorer; mitigated only by the
   specialist's ear.
2. **ASR agreement is known to be lower for readers with disabilities** — the
   entire participant group here.
3. **The variant list was derived from synthesized speech.** In an integration
   probe over 25 words, Whisper matched exactly on 20/25 before variants, and
   **every miss was a Marungko stage 7 loanword or digraph** — two returned a
   different spelling on each run.
4. **Reviews made with the machine's answer visible exist and cannot be undone**
   — reported separately rather than merged.
5. **Retry exclusion is a defensible choice, not a neutral fact.**
6. **The respondents are the total enumeration of one centre** — five children
   and three specialists. The findings describe LEXORA at The Reading Owl and are
   not statistically generalizable, as the proposal says.
7. **Three raters.** Weighted means are descriptive summaries; no reliability
   statistic is possible.
8. **The specialists are not blind to the study's purpose**, and they both use
   the application and evaluate it. Blind review addresses anchoring to the
   *machine's* verdict, not their investment in the outcome.
9. **Acquiescence in the children's ratings**, mitigated by who administers the
   scale and by the "Bakit?" answers, not removed.
10. **Phoneme-level manipulation** is in the proposal's item bank and not in the
    application (consultation brief, decision 12), unless the specialists record
    the sounds it needs.

---

*§1–§2 checked against the running application on 13 August 2026. §3–§7
realigned to the capstone proposal on 8 October 2026, with every constant named
checked against the code that day. If the code changes, this document does not
follow automatically — `src/app/api/export/route.ts` and the constants named in
§3 and §5 are the source of truth.*
