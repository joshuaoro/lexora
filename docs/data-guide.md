# LEXORA — Data Gathering and Analysis Guide

Every piece of data the study collects: what it is, how it is produced, what to
do with it, and why it is done that way.

This is the companion to Chapter 3 (Methodology) and Chapter 4 (Results). The
[operating manual](user-manual.md) says which buttons to press; this says what
comes out and what it means.

**Every number, column name and threshold in this document was checked against
the running application on 13 August 2026, not written from memory.** Where a
figure comes from the code, the file is named so a future change is traceable.

- [1. What data exists at all](#1-what-data-exists-at-all)
- [2. Data dictionary — every column](#2-data-dictionary--every-column)
- [3. The gathering protocol](#3-the-gathering-protocol)
- [4. The evaluation instruments](#4-the-two-instruments-you-still-have-to-build)
- [5. Analysis, measure by measure](#5-analysis-measure-by-measure)
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
| Specialist verdict on a recording | `AttemptReview.agrees` | Objective 2 entirely — no agreement %, no κ, no threshold calibration |
| Whether the verdict was made blind | `AttemptReview.blind` | The ability to show the labels were independent |
| Observation tags (vowel, cluster, stress…) | `ReviewErrorTag` | Any error profile that describes the child rather than the recogniser |
| Probe verdicts, scored by ear | `AttemptReview` on `isPseudo` items | The decoding-vs-memorisation finding — the study's sharpest result |
| Phase tags: BASELINE / REGULAR / ENDLINE | `ActivitySession.phase` | The entire pre/post comparison |

**A study that collects Layer A diligently and Layer B sporadically has a large
dataset and no findings.** Section 3 is built around this.

### Layer C — Outside the application

The app will never produce these. They do not exist yet.

| Data | Instrument | Status |
|---|---|---|
| ISO/IEC 25010:2023 ratings, 3 specialists | 5-point Likert questionnaire | **Drafted** — [`instruments/03`](instruments/03-iso-25010-questionnaire.md), needs ethics review |
| Children's acceptance, 5 participants | 3-point pictorial scale | **Drafted** — [`instruments/04`](instruments/04-pictorial-scale.md), needs ethics review |
| Consent (parents) and assent (children) | Forms | **Drafted** — [`instruments/01`](instruments/01-consent-parent.md), [`02`](instruments/02-assent-child.md), need ethics review |
| Participant characteristics: age, sex, grade, prior diagnosis | Intake sheet | **Drafted** — [`instruments/05`](instruments/05-intake-and-field-log.md) |
| Session notes: interruptions, mood, technical problems | Field log | **Drafted** — [`instruments/05`](instruments/05-intake-and-field-log.md) |

That last one is easy to skip and hard to reconstruct. When a child's accuracy
drops 30 points in one session, the field log is the only thing that will ever
tell you the aircon was being repaired that afternoon.

---

## 2. Data dictionary — every column

Six CSV exports (101 columns) plus one plain-text export. All are UTF-8 with a
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
separately as self-correction (`retries`, `retries_correct`,
`retry_success_pct`) — it is a real and interesting behaviour, just not accuracy.

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

### 2.1 `attempts` — 25 columns, one row per word reading

The raw data. Everything else can be recomputed from this.

| Column | What it is |
|---|---|
| `attempt_id` | Unique id |
| `learner` | Display name |
| `timestamp_iso` | When |
| `activity_type` | `READ_ALOUD`, `PRACTICE`, `PSEUDO_PROBE`, `LISTEN_CHOOSE`, `SYLLABLES`, `RHYME`, `FIRST_SOUND` |
| `target_word` | The word shown. Denormalised, so history survives word edits |
| `syllables` | Hyphenated, e.g. `ba-hay` |
| `pattern` | CV, CVC, CVCV, CCVC … |
| `pattern_family` | Collapsed into six instructional families (§5.8) |
| `word_stage` | Marungko stage 1–7 |
| `word_level` | Difficulty 1–5 |
| `level_at_time` | The learner's level when they read it — use this, not their current level, for anything historical |
| `transcript` | What the recogniser heard |
| `asr_engine` | `server` (Whisper) or `browser` (Web Speech) |
| `alt_transcript` | The other engine's transcript, when both ran |
| `correct` | The machine's verdict, 1/0 |
| `similarity_score` | Levenshtein similarity 0–1 — the continuous variable the calibration sweeps |
| `error_type` | `correct`, `substitution`, `omission`, `insertion`, `no_response` |
| `response_ms` | Time to answer |
| `has_audio` | Whether a recording is still stored |
| `specialist_review` | `agrees` / `disputes` / blank |
| `is_retry` | **Filter ①** |
| `study_phase` | `BASELINE` / `REGULAR` / `ENDLINE` |
| `is_pseudoword` | 1 = probe non-word |
| `specialist_correct` | The specialist's own verdict, 1/0, blank if unreviewed. **This is the ground truth**, on both real and probe words |
| `stress_pair` | Non-empty where meaning depends on unwritten stress — `correct` on these rows is not evidence about stress |

**`specialist_review` vs `specialist_correct`.** The first stores whether the
specialist *agreed with the machine*; the second is their own verdict, already
converted for you. Use `specialist_correct`. Confusing the two inverts your
results on every reading the machine got wrong.

### 2.2 `sessions` — 11 columns, one row per activity

`session_id`, `learner`, `timestamp_iso`, `activity_type`, `items`, `correct`,
`accuracy_pct`, `duration_ms`, `level_at_time`, `study_phase`, `completed`.

- `completed = 0` — the child started and left partway. The words they read are
  real data; the session is just unfinished. Exclude these when counting
  activities completed, keep their minutes.
- Probe sessions show `correct = 0` **by design** — the verdict comes later from
  a specialist. Do not read it as eight failures.
- Only sessions with `items > 0` appear.

### 2.3 `summary` — 28 columns, one row per learner

Pre-aggregated, and every figure already applies filter ①. This is the
convenient file; `attempts` is the authoritative one.

**Identity** `learner`, `email`, `level`, `marungko_stage`

**Accuracy** `oral_attempts`, `oral_correct`, `oral_accuracy_pct`

**Error profile** `substitution`, `omission`, `insertion`, `no_response`

**Engagement** `sessions_completed`, `sessions_partial`, `minutes_practiced`,
`practice_words_active`, `practice_words_mastered`

**Agreement** `attempts_reviewed`, `reviews_agreed`, `agreement_pct`

**Self-correction** `retries`, `retries_correct`, `retry_success_pct`

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

The difference between the two rows is a **finding about anchoring**, not a
footnote about method. See §5.5.

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

Each step names what it produces and what it unblocks, so a skipped step has a
visible cost.

### 3.1 Before the first child

| Action | Produces |
|---|---|
| Rotate `learner1`/`learner2` passwords (§7.1 of the manual) | The last security gate |
| Consent from parents, assent from children | Ethical basis for everything below |
| Intake sheet per child: age, sex, grade, prior assessment | Table 1 of Chapter 4 |
| `/diagnostics` on every tablet | Confidence the recording chain works on that device |
| `npm run backup` | A restore point |
| Specialist sets each child's starting level and Marungko stage | Sensible first sessions instead of everyone at level 1 |

### 3.2 Baseline — the irreplaceable one

Per child: **one Read-aloud run (8 words) and one Silly-words run (8 non-words).**

Then, immediately: **Specialist → learner → Study timeline → tag both sessions
`BASELINE`.**

> A baseline nobody tagged cannot be reconstructed afterwards except by guessing
> from timestamps, which is exactly what tagging exists to avoid. Every pre/post
> figure in Chapter 4 depends on this one action.

Within the same week, review those baseline recordings **blind**. Baseline probe
accuracy is the anchor for the study's central comparison, and it only exists
once someone has listened.

### 3.3 Every session

- Child signs in as themselves. Read-aloud is the activity that produces scored
  data; the others support it.
- Leave sessions as `REGULAR` unless baseline or endline.
- Note anything unusual in the field log — interruptions, distress, a tablet
  problem, a child who was unwell.
- `npm run backup` afterwards.

### 3.4 Weekly, by the specialist

This is Layer B, and it is the work that turns recordings into findings.

1. **Review blind.** Do not switch to quick review without a reason; note it if
   you do.
2. **Target 30 reviewed readings cohort-wide as early as possible** —
   `MIN_SAMPLE = 30` in `src/lib/calibration.ts` is the point at which the
   threshold calibration will recommend an operating point.
3. **Tag observations** where confident. Coverage is reported, so partial
   tagging is honest — but coverage is also what makes the error profile worth
   anything.
4. **One probe run per child per phase.** Rests 7 days between runs
   (`PROBE_COOLDOWN_DAYS`).
5. **Watch the divergence panel** once a child has 10 reviewed real words and 8
   reviewed probe words. A gap of 25+ points in favour of real words says the
   child is recognising the bank rather than decoding it — worth acting on
   during the study, not discovering at the end.

### 3.5 Endline

Mirror the baseline exactly — same activities, same length — then tag `ENDLINE`
immediately and review those recordings blind.

Using a different instrument at endline than at baseline would make the
comparison meaningless, which is also why the probe bank is fixed and reviewed
rather than generated fresh each run.

### 3.6 Close-out

- ISO/IEC 25010 questionnaire to the three specialists (§4.1)
- Pictorial scale to the five children (§4.2)
- Download all six CSV exports **without** `includeDemo`
- Final `npm run backup` plus a verified restore rehearsal
- Record the app version: `git rev-parse --short HEAD`

---

## 4. The evaluation instruments

**Both now exist as drafts** in [`instruments/`](instruments/) — [ISO 25010 questionnaire](instruments/03-iso-25010-questionnaire.md) and [pictorial scale](instruments/04-pictorial-scale.md), alongside the [parental consent](instruments/01-consent-parent.md) and [child assent](instruments/02-assent-child.md) forms. They require adviser and ethics-committee review before use. The sections below are the reasoning behind their design.

### 4.1 ISO/IEC 25010:2023 questionnaire — 3 reading specialists

**Verify the characteristic and sub-characteristic names against the standard
itself before printing.** The 2023 revision renamed and added things — Usability
became **Interaction Capability**, Portability became **Flexibility**, and
**Safety** is new — and the list below is written from knowledge of that
revision, not from the paywalled text. A questionnaire citing the 2011 list
under a 2023 heading is the kind of error a panel notices immediately.

The nine characteristics: Functional Suitability, Performance Efficiency,
Compatibility, Interaction Capability, Reliability, Security, Maintainability,
Flexibility, Safety.

**Do not ask a reading specialist to rate all nine.** Maintainability and
Flexibility are developer-facing — a reading specialist rating "modularity"
produces a number with nothing behind it, and a panel is entitled to ask what
they based it on. Rate what they can observe; evidence the rest objectively.

**The stronger move: triangulate.** Several characteristics already have
objective measurements in this repository, so the evaluation need not rest on
three opinions. Present both.

| Characteristic | Rated by specialists? | Objective evidence already available |
|---|---|---|
| Functional Suitability | Yes | `audit:logic`, `audit:decoding`, `audit:calibration` |
| Performance Efficiency | Yes | `audit:perf` — FCP < 3 s, LCP < 4 s, JS < 400 KB on the study's own minimum spec (dual-core 2.0 GHz, 5 Mbps) |
| Compatibility | Yes | Chrome, Edge, Safari iOS 14.3+; `/diagnostics` per device |
| **Interaction Capability** | **Yes — the main one** | `audit:a11y` — WCAG 2.1 AA, 19 checks, every route as every role |
| Reliability | Yes | 423 checks; stale-session and dropped-connection handling |
| Security | Partly | `audit:api` authorization, RLS on 11 tables, `secrets:check` |
| Safety | Yes | Non-diagnostic disclaimers; IEP refuses prescriptive language |
| Maintainability | **No** | Test suite, typed codebase, documented decisions |
| Flexibility | **No** | Responsive; deploys from one command |

**Item design.** 4–6 statements per rated characteristic, in Taglish, about the
application rather than about reading. Answer on 1–5: Strongly Disagree →
Strongly Agree. Include a free-text comment box per characteristic — with three
raters, the comments will be worth more than the means.

**Scoring.** Report per characteristic: **mean and range**. Not SD — with three
raters an SD is close to meaningless and invites over-reading. Interpret with
the conventional bands:

| Mean | Interpretation |
|---|---|
| 4.21 – 5.00 | Excellent / Strongly Agree |
| 3.41 – 4.20 | Very Good / Agree |
| 2.61 – 3.40 | Good / Neutral |
| 1.81 – 2.60 | Fair / Disagree |
| 1.00 – 1.80 | Poor / Strongly Disagree |

**No inter-rater reliability statistic.** Three raters cannot support Cronbach's
α or an ICC in any meaningful way. If you want to say something about
consistency, report the range, or percent exact agreement. Claiming α from three
raters is worse than claiming nothing.

### 4.2 Three-point pictorial scale — 5 children

**Design.** 5–8 items, each a short Filipino sentence with three faces: 😊
happy = 3, 😐 neutral = 2, ☹️ sad = 1. Read aloud to the child — the participants
are children with a reading disability, so a self-administered written
questionnaire would be measuring the thing the study is trying to help with.

Items should ask about the experience, not about performance: was it easy to
use, did you like the voice, was the text easy to see, would you use it again.

**Two design constraints that matter more than the wording.**

*Administer it by someone who did not run the sessions.* Acquiescence bias in
7–12-year-olds toward a familiar adult is the main threat to this instrument.
A child who has spent eight weeks with you will tell you they liked it.

*Report per-child, not as a cohort mean.* The mean of five judgements on a
3-point scale carries almost no information and implies a precision that is not
there. A table of five rows is more honest and more informative.

**Scoring.** Per item: how many chose each face. Per child: their pattern across
items. Report the mode, and quote anything a child said unprompted.

---

## 5. Analysis, measure by measure

### 5.0 The statistical stance — read this first

**With five participants, the Wilcoxon signed-rank test cannot reach p < .05
two-tailed.** The minimum attainable p is **.0625**, even in the best case where
all five children improve. One-tailed can reach .03125, but a one-tailed test
chosen after seeing the direction of the data is not a test.

A design that cannot produce a significant result should not be presented as
testing for one. So this study reports:

- **A per-participant table for every outcome** — five rows: baseline, endline,
  change, direction. This is standard for small-n intervention research.
- **Medians, not means**, across the cohort. Five values, any one of which can
  drag a mean.
- **"4 of 5 children improved"** as the headline figure. Honest, and exactly what
  a reader of small-n work expects.
- **Effect as raw and percentage change.** Not Cohen's *d* — it is unstable at
  n=5 and would imply a precision the design does not have.

This is not a weaker analysis. It is the analysis the design supports, and it
cannot be attacked for over-reaching — which a p of .0625 presented as a near-miss
certainly can.

### 5.1 Single-word reading accuracy — Objectives 3, 4, 5

**Source** `summary.oral_accuracy_pct`, or from `attempts`:

```
accuracy = correct=1 AND is_retry=0 AND activity_type IN (READ_ALOUD, PRACTICE)
           ÷ all rows matching is_retry=0 AND the same activity types
```

**Present** per child, baseline vs endline, plus the cohort median.

**Why filtered this way.** Retries measure repetition (filter ①). The other
activity types are not oral reading — `LISTEN_CHOOSE` is recognition,
`SYLLABLES` is segmentation — and mixing them would make "accuracy" mean nothing
in particular. Probe items are excluded here and analysed separately (§5.3),
because the machine's verdict on a non-word is not evidence.

### 5.2 Decoding latency — co-primary, not secondary

**Source** `summary.median_decode_ms` over `timed_readings`.

**Definition** the median milliseconds for a **correct**, **first**, **plausible**
reading. Plausible means 300 ms – 60,000 ms (`PLAUSIBLE` in `src/lib/stats.ts`):
faster is a mis-click, slower means the child walked away. Reported only at
`MIN_LATENCY_SAMPLE = 5` timed readings or more.

**Why it is co-primary.** Filipino is a transparent orthography — letters map to
sounds with few surprises. In transparent orthographies, dyslexia presents as
*slow* reading far more reliably than as *inaccurate* reading; the finding
replicates across Spanish, Italian and German. **A child can sit at 90% accuracy
and still be sounding out every word**, and no accuracy figure will show it.

Two children at 85% can be doing completely different things. Only the latency
separates them. Report it beside accuracy, not beneath it.

**Why the median.** One distraction mid-session drags a mean badly.

**Why correct readings only.** A wrong answer's latency measures giving up, not
decoding.

### 5.3 Non-word probe accuracy — the study's sharpest measure

**Source** `summary.pseudo_correct ÷ pseudo_scored` (filter ③).

**Verified** — hand-computed from `attempts.csv` and matched against the app:
Ana 8/8 = 100%, Juan 0 items. The arithmetic in this guide and the arithmetic in
the application agree.

**Why this measure exists.** A real word can be read from memory. After eight
weeks on a fixed 254-word bank, a gain on those same words cannot be told apart
from having learned those 254 items — and the study claims to measure decoding.
A word that has never existed can only be sounded out.

**Why scored by ear.** Whisper is a language model before it is a transcriber,
and here it is transcribing words that exist in no language. The transcript is
stored *beside* the human verdict rather than instead of it, which turns the
uncertainty into a measurement: human-vs-machine agreement on unfamiliar items,
directly comparable with the same figure on real words.

**Baseline probe → endline probe is the closest this study comes to asking its
own question directly.**

### 5.4 Human–machine agreement — Objective 2

**Source** `summary.agreement_pct`; `calibration` for the full statistics.

Report three figures at the operating threshold (0.95):

- **Percent agreement** — intuitive, but inflated when one class dominates.
- **Cohen's κ** — the figure the oral-reading literature reports, so the one
  that makes your result comparable.
- **Matthews correlation (MCC)** — the honest one here. Most readings are
  correct, so a scorer that accepted everything would post high accuracy and a
  respectable F1 while being useless. MCC only rises when all four cells of the
  confusion matrix are good.

**Interpreting κ** with Landis & Koch: <0 poor, .01–.20 slight, .21–.40 fair,
.41–.60 moderate, .61–.80 substantial, .81–1.00 almost perfect. State that these
bands are **conventional rather than principled** — they are a rule of thumb,
not a standard.

**Comparators**, already collected: published agreement for automatic scoring of
children's oral reading is **κ = .54, human 92% vs ASR 88%** accuracy; the best
of six ASR systems on Dutch oral reading reached **MCC = 0.63**. Both were
measured on **typically-developing readers**, and the first study found agreement
**significantly lower for students with disabilities** — which is this entire
participant group. Treat them as context, never as targets.

### 5.5 Blind versus anchored agreement — a finding, not a footnote

**Source** `agreement-conditions`, two rows.

Until blind review was built, the review screen showed the machine's transcript,
verdict and similarity **above the play button** — so a specialist met the answer
before they could hear the reading. Every review recorded before that repair is
`blind = 0`, and that is the truthful value.

Report κ under each condition side by side. **The gap between them is a result
about anchoring bias in human scoring of ASR output**, which is worth reporting
in its own right. If the blind κ is lower, that is not a failure — it is the
honest number, and the anchored one was inflated.

If too few reviews exist in one condition, say so rather than pooling them.

### 5.6 Error-type profile — Objective 5

**Source** `summary`: `substitution`, `omission`, `insertion`, `no_response`.

Present as counts and percentages of misreadings, per child.

**Caveat to state.** These are derived from comparing the ASR transcript against
the target — so they describe the *string difference*, not necessarily the
child's phonology. A transcript is what a recogniser wrote down. §5.7 is the
version that describes the child.

### 5.7 Specialist observation tags — the error profile that describes a child

**Source** `ReviewErrorTag` (via the app's panels; not in a CSV export).

Ten categories, split by kind:

- **Errors** — vowel, first sound, last sound, digraph, consonant cluster,
  syllable dropped, syllable added, **stress**
- **Behaviours** — self-corrected in the recording, could not tell

**Why these come from a person.** Most transcripts in a database like this carry
the recogniser's own spelling — "Bahai" for *bahay*, "CC" for *sisi* — which is
orthography and noise, not a child's phonology. A profile built from them would
read convincingly and describe nobody.

**Why the split matters.** `self_corrected` describes a child who *arrived at the
right word*, and `unclear` describes the specialist rather than the child.
Counting either as an error overstates how much went wrong.

**Always report coverage** (filter ④): "categories recorded for N of M reviewed
misreadings (X%)".

**Stress deserves its own sentence in the results.** Filipino does not write
stress, so *búkas* and *bukás* reach the scorer as identical letters. Six bank
words are flagged for it. A specialist's ear is the only instrument the study has
for a marker its own literature calls diagnostic.

### 5.8 Accuracy by syllable-pattern family — the most actionable view

**Source** `attempts.pattern_family`, grouped.

Six families: `Open (CV·CV)`, `Closed syllable`, `Vowel pair`,
`Consonant cluster`, `ng words`, `Long (4+ syllables)`.

**Why families rather than raw patterns.** "Reads CVCV fine, fails on clusters"
points straight at what to teach next. A list of thirty raw patterns does not.

Report per child, and only for families with enough attempts to mean anything —
the app suppresses families with none rather than showing a misleading 0%.

### 5.9 Baseline to endline — Objective 5

**Source** `phase-comparison`, two rows, per child and for the cohort.

Minimums enforced: 10 readings per phase (`MIN_PHASE_READINGS`), 8 reviewed
probe readings per phase (`MIN_PHASE_PROBES`). Below 20 in either phase the app
flags the comparison as thin — read the direction, not the size.

**Present three rows per child**: accuracy, median decoding time, probe accuracy.

**Read the probe row first.** Real-word accuracy rising over eight weeks is
ambiguous — the child may have learned to decode, or learned those 254 words.
Non-word accuracy rising is not ambiguous.

**And read decoding time in the right direction:** falling is improvement.

Follow §5.0 — per-participant table, cohort median, count improving. No p-value.

### 5.10 Threshold calibration — the Validation chapter's table

**Source** `calibration`, 51 rows.

Report: the operating point in force (0.95), its confusion matrix and statistics,
the MCC-optimal threshold, the plateau span, and the bootstrap interval.

**Three things to state.**

*The sweep replays the real scoring rule*, not `score >= t`. `scoreReading()`
also accepts an approved ASR spelling outright and demands an exact match for
words of ≤ 3 letters — both ignore the threshold. A naive sweep would report
metrics for a classifier the app does not run.

*Nothing was recommended below 30 labelled readings*, and if you finish below 30,
the honest report is that the calibration could not be fitted.

*The threshold was never changed mid-study.* Doing so would mean baseline and
endline were scored by different rules. Since similarity is stored on every
attempt, a change indicated by the calibration can be applied by re-scoring the
exported data at analysis time — reporting both figures.

---

## 6. Tables for Chapter 4

Skeletons to fill. Each needs a sentence that says what it shows; numbers left
alone get read however the reader is inclined.

**Table 1 — Participants.** ID, age, sex, grade, prior assessment, starting level
and Marungko stage, sessions completed. *(From the intake sheet + `summary`.)*

**Table 2 — Reading accuracy, baseline to endline.** One row per child: baseline
%, endline %, change in points, direction. Cohort median. Count improving.

**Table 3 — Decoding latency.** Same shape, median ms. **Note in the caption that
a fall is an improvement** — otherwise a reader scanning the change column reads
every negative as a loss.

**Table 4 — Non-word probe.** Same shape. This is the table the discussion should
lean on.

**Table 5 — Human–machine agreement.** Reviewed n, agreement %, κ, MCC, with the
published comparators in adjacent rows and their caveat in the note.

**Table 6 — Blind vs anchored.** Two rows, n and κ each.

**Table 7 — Error profile.** Error-type counts from the machine, and specialist
tag counts with coverage %, clearly separated as two different things.

**Table 8 — ISO/IEC 25010:2023.** Characteristic, mean, range, interpretation —
and a column for the objective evidence where it exists (§4.1).

**Table 9 — Pictorial scale.** Items down the side, five children across, faces
in the cells. Plus a modal response per item.

**Figures worth having:** per-child pre/post slope charts for the three outcomes
(five lines, immediately readable); the threshold sweep with MCC against
threshold and the plateau shaded; accuracy by pattern family as grouped bars.

---

## 7. Limitations

Five carried over from [`development-record.md`](development-record.md) §12:

1. **Filipino stress is undetectable** by the app; mitigated only by the
   specialist's ear.
2. **ASR agreement is known to be lower for readers with disabilities** — the
   entire participant group here.
3. **The variant list was derived from synthesized speech.** In an integration
   probe over 25 words, Whisper matched exactly on 20/25 before variants, and
   **every miss was a Marungko stage 7 loanword or digraph** — two returned a
   different spelling on each run.
4. **Anchored reviews exist and cannot be undone** — reported separately rather
   than merged.
5. **Retry exclusion is a defensible choice, not a neutral fact.**

And four that belong to the analysis specifically:

6. **n = 5 precludes inferential statistics.** State the .0625 floor explicitly
   so a reader does not mistake descriptive reporting for a failed test.
7. **Three raters preclude reliability statistics.** No α, no ICC.
8. **No control group.** Eight weeks of maturation and ordinary classroom
   teaching are uncontrolled, so pre/post change **cannot be attributed to
   LEXORA alone**. This is the single largest threat to any causal reading of
   the results, and it is better stated by you than raised by a panel.
9. **The specialists are not blind to the study's purpose**, and they both
   deliver the intervention and score it. Blind review addresses anchoring to the
   *machine's* verdict; it does not address their investment in the outcome.

---

*Written 13 August 2026. Every column name, threshold and worked figure verified
against the running application on that date. If the code changes, this document
does not follow automatically — `src/app/api/export/route.ts` and the constants
named in §5 are the source of truth.*
