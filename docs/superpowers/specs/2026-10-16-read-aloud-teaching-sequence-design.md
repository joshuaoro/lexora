# Read aloud teaching sequence and practice lessons: design

**Status:** approved in conversation on 16 October 2026; written spec for review.
**Sub-project 2 of 5** from the reading specialist's consultation of 16 October (see the
work queue: 1 audio-only prompts, done; 2 this; 3 new activities; 4 visual redesign;
5 account management).

## 1. Why

The reading specialist asked for LEXORA to *teach*: to model a word ("Ang salitang ito
ay ___") before the child reads it, and after a misread to say the phrase (by button or
automatically) and let the child try again, recorded as a second attempt.

Modeling before every reading would break three of the study's objectives. Objective 2
(agreement on "word-level reading errors"), Objective 3 (the list of "words the learner
most frequently misreads") and Objective 4 (level matched to "the learner's current
decoding level") all rest on readings the child made **without** hearing the word
first. A reading made straight after a model measures repetition, not decoding. The app
already applies this to the "Now you try it!" re-read, which is saved but kept out of
every measure.

So each activity gets one job:

- **Read aloud: you try first, then the system teaches.** The first reading stays the
  study's measure. A model always follows it.
- **Practice: the system teaches first, then you try.** The words are ones the child
  has already misread in Read aloud, so their unmodeled reading is already on record.

## 2. Read aloud

Unchanged: the child sees the word, presses the mic and reads; the first reading is
scored, saved, and counts toward the measures.

After every first reading:

| Result | Screen | Voice | Then |
|---|---|---|---|
| Correct | chime, "Magaling!" (as now) | "Tama! *bahay*" | Next |
| Misread or skipped | chime, "Hindi pa tama — aralin natin!" (as now) | "Ang salitang ito ay *bahay*." | **Pakinggan ulit** replays the sentence; **Ikaw naman!** offers the second attempt |

- The sentence is two clips: the opening phrase ("Ang salitang ito ay" / "Tama!") from
  the instruction cache in the app's voice, then the word's own clip, a specialist's
  recording when one exists.
- The opening phrase follows the interface language: Filipino "Ang salitang ito ay…",
  English "This word is…". The word is always the Filipino clip.
- **Ikaw naman!** is the existing re-read (`isRetry`), renamed in both languages
  ("Ikaw naman!" / "Your turn!"). Its mic is enabled only once the sentence has
  finished playing, so the recording cannot capture the app's own voice. Afterwards:
  "Magaling!" or "Babalikan natin ito."
- *Silly words* (the non-word probe) is untouched: nothing is ever modeled there.

## 3. Practice

**Which words:** up to 8 unmastered practice-list words (automatic and specialist-pinned
alike), ordered:
1. words **not yet seen in Practice today** first;
2. then by times missed, most first;
3. then most recently updated.

**Each word is a lesson or a check**, decided by the server from the word's dates
(`today` is the calendar date in Philippine time, the app's clock):

- **Check** if the word has been taught before (`lastTaughtOn` set) **and** it has not
  appeared in Practice today (`lastSeenOn` ≠ today).
- **Lesson** otherwise: never taught, or already seen today.

| | Before reading | After a correct reading | After a misread |
|---|---|---|---|
| **Lesson** | Card labelled "Pakinggan muna" (ear). Voice: "Ang salitang ito ay *bahay*. Ikaw naman!" The mic is enabled when it finishes | "Magaling!" | The Read aloud lesson: "Ang salitang ito ay *bahay*", **Pakinggan ulit**, **Ikaw naman!** |
| **Check** | Card labelled "Ikaw muna". Voice and screen: "Subukan mo muna!" The child reads alone | One step of progress shown ("✓ 1 of 2"), voice "Tama! *bahay*". At the second step: "Natutunan mo na! 🎉" | Progress resets, then the same lesson as a misread lesson |

**Bookkeeping**, on a Practice first reading (never on a re-read):

| Mode | Effect on the practice-list word |
|---|---|
| Lesson | `lastTaughtOn` = today, `lastSeenOn` = today |
| Check, correct | `lastSeenOn` = today, `streak` + 1, `mastered` when `streak` reaches 2 |
| Check, misread | `lastSeenOn` = today, `streak` = 0, `lastTaughtOn` = today (the lesson that follows) |

Two correct checks therefore always fall on two different days: a check requires the
word not to have been seen today, and every check marks it seen.

- `missCount` (×N, "times missed") counts **Read aloud misreads only** and is no longer
  touched by Practice. It is the evidence for why a word is on the list (instrument 06
  Part B).
- A Read aloud misread of a word already on the list resets `streak` and `mastered` as
  today, and leaves its dates alone, so its next Practice is a check.
- If every word in a run was already seen today, the start screen says "Bukas, susubukan
  mo na itong mag-isa!" ("Tomorrow you'll try these on your own!") and the run is all
  lessons.
- The server decides the mode when it builds the run and **again when it saves each
  reading**, and stores its own answer. The client's copy only drives what the card shows.

## 4. What is recorded, and what counts

New data (one migration; three nullable columns, nothing existing altered):

| Table | Column | Meaning |
|---|---|---|
| `PracticeItem` | `lastTaughtOn DATE` | Day a lesson was last given for this word |
| `PracticeItem` | `lastSeenOn DATE` | Day this word last came up in Practice |
| `Attempt` | `practiceMode TEXT` | `lesson` or `check` for Practice readings; null otherwise |

`PracticeItem.streak` changes meaning to "correct checks in a row (0–2)".

| | Read aloud first reading | Read aloud re-read | Practice lesson | Practice check | Silly words |
|---|:---:|:---:|:---:|:---:|:---:|
| Level (Obj. 4) | ✓ | – | – | – | – |
| Accuracy, error patterns, reports, start/end record (Obj. 5) | ✓ | – | – | – | – |
| Agreement and calibration (Obj. 2) | ✓ | – | – | – | separate, as now |
| Puts a word on the practice list (Obj. 3) | ✓ if misread | – | – | – | – |
| Progress toward leaving the list | – | – | – | ✓ | – |
| Saved, recording playable | ✓ | ✓ | ✓ | ✓ | ✓ |

**One definition.** "Which readings count" is written out as
`["READ_ALOUD", "PRACTICE"]` in about ten places today (adaptive level, stats, phases,
calibration, divergence, the specialist's pages, exports). It becomes one shared
definition, `MEASURED_READING_TYPES = ["READ_ALOUD"]` with first readings only, used
everywhere; calibration and divergence add `PSEUDO_PROBE` to it as now. The attempts
route's `ADAPTIVE_TYPES` becomes Read aloud only, so a Practice reading never moves the
level or adds to the list.

**Readings already stored.** Figures are calculated from saved readings when a page
opens, so the 44 Practice readings in the database stop counting automatically. They
belong to the demo learners Ana and Juan (4 of them specialist-scored), who are already
excluded from cohort figures and calibration. No participant has a Practice reading. A
child's level is re-checked at their next Read aloud reading, not when the rule changes.

## 5. The specialist's view and exports

- **Scoring reliability check** (review list, agreement): Read aloud first readings
  only.
- **New Practice panel** on the learner page, beside *Re-reads after hearing the word*:
  recent practice readings, each marked lesson or check, with result and a play button.
- **Current practice list:** each word shows ×N (Read aloud misreads) and its progress,
  "✓ 1 of 2 checks". The confirmed/overturned evidence beside it uses Read aloud
  readings only.
- **Readings CSV:** a `practice_mode` column added at the **end** (no existing column
  moves). **Summary CSV:** Read aloud first readings only.

## 6. Spoken phrases

Pre-generated with `npm run audio:instructions`, in both languages: "Ang salitang ito
ay" / "This word is"; "Tama!"; "Ikaw naman!" / "Your turn!"; "Subukan mo muna!";
"Natutunan mo na!"; "Bukas, susubukan mo na itong mag-isa!". Played before the word's
clip where the sentence needs it.

## 7. Testing (written first, run against the previous deployment to fail)

- **logic-audit** (server rules, through the API):
  - a Practice reading never changes level, accuracy or agreement;
  - a word's first Practice reading is a lesson, and so is a second one the same day;
  - with its dates moved back a day (SQL, on the test account only) it becomes a check;
  - two correct checks on different days master it; a misread check resets `streak`;
  - only Read aloud misreads add to `missCount`;
  - the stored `practiceMode` is the server's, whatever the client sends.
- **ui-audit:** Read aloud **Skip** brings up **Pakinggan ulit** and **Ikaw naman!**;
  a Practice lesson card shows "Pakinggan muna" and a check card "Ikaw muna"; the
  practice list shows progress; the specialist's Practice panel lists the readings.
- **a11y-audit:** a Practice item mid-question.
- Existing suites that assume Practice counts are updated in the same change.

## 8. Rollout

1. `npm run backup` (the live database is the study database).
2. Push: the migration is applied by the usual `vercel-build`.
3. `npm run audio:instructions` for the new phrases.
4. Run the affected suites against production.

## 9. Docs

User manual (Read aloud steps, Practice), data guide (what counts, `practice_mode`),
proposal alignment (manuscript wording for the teaching sequence and the practice
list), consultation brief (the sequence, for the specialists), development record.

## 10. Not in scope

Silly words; the listening activities; new activities (sub-project 3); visual polish of
these screens (sub-project 4); any change to the scoring threshold or level criteria.
