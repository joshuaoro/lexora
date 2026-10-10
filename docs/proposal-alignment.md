# LEXORA and the Capstone Proposal — Alignment Notes

**For the research team and the research adviser.** The proposal (*LEXORA: Development
of an AI-Assisted Reading and Progress Tracking Web Application for Persons with
Dyslexia Using the Marungko Approach*, July 2026) is the authority on what this
application is for. This document compares the two, section by section, and says what
was changed in the application, what the application does beyond the proposal and how
to present it, and where the **manuscript** should change — with wording you can adapt.

Compared on 8 October 2026, against the application as deployed that day. The figures,
which the text export did not carry, were compared on 10 October against the manuscript
of that date (*76-11 LEXORA*, .docx and .pdf), whose text is otherwise the proposal's.

---

## 1. Summary

| | Status |
|---|---|
| Objectives 1–6 | Each has a feature in the application **and** an instrument that determines it (§2) |
| Scope and delimitation | Followed. Baseline/endline features no longer present change as a gain (§3) |
| Data set | Followed, including phoneme-level manipulation (added 9 October, with specialist-recorded sounds) (§4) |
| Validation | Followed, including the threshold refinement the proposal describes |
| Evaluation instruments | All nine ISO/IEC 25010 characteristics rated; Table 1 and Table 2 used as written |
| Statistical treatment | The analysis guide uses only the proposal's four descriptive measures |
| Hardware and software (Tables 4–6) | **The manuscript should be updated** to the real deployment (§6) |
| Ethics | The application now matches the proposal; **one sentence of the manuscript** contradicts the proposal's own Validation and should change (§7) |
| Title | **Inconsistent within the manuscript** (§8) |
| Figures 1–3 | **Figs. 1 and 2 name four features that neither the text nor the application has**; they should be redrawn (§9) |

---

## 2. Objectives — how each is built and how each is determined

| # | Objective (abridged) | In the application | Determined by |
|---|---|---|---|
| 1 | Display customization, TTS with synchronized highlighting, adjustable speed, reading focus tools; the extent they address the access needs the specialists identified | Settings (font, size, letter/word spacing, line height, colour overlay, focus ruler, speech rate); Reader (word-by-word TTS with highlighting) | **Instrument 06, Part A** — specialists rate each feature against each need; weighted mean, Table 1 |
| 2 | Accuracy of the pre-trained ASR, as percentage of agreement with a reading specialist on the same recordings | Read aloud records and scores; specialists review each recording **blind**; the app computes agreement | **Percentage of agreement**, on blind reviews of first readings of real words (data guide §5.2) |
| 3 | Immediate pronunciation feedback and a personalized practice list; whether the list matches the words most frequently misread, verified by a specialist | Feedback after every reading, with the word modelled and "Now you try it!"; practice list built from misreads, each word showing the misreads the specialist **confirmed or overturned** | **Instrument 06, Part B** — percentage of list words the specialist confirms |
| 4 | Adaptive exercises driven by recorded accuracy; whether the assigned level matches the decoding level a specialist assesses | Levels 1–5 following the **skill-progression map** (§4); a *Skill progression* panel per learner | **Instrument 06, Part C** — blind assessment against the assigned level; percentage matching |
| 5 | Dashboard of accuracy, error patterns and completed activities over time; usefulness of the reports | Dashboard, Reports, specialist learner pages, exports | The records described per child; **Instrument 06, Part D** — weighted mean |
| 6 | Software quality (ISO/IEC 25010, three specialists) and user acceptance (pictorial scale, five children) | — | **Instrument 03** (weighted mean, Table 1) and **Instrument 04** (frequency and percentage, Table 2) |

**Suggested manuscript addition** (Statistical Treatment — the proposal gives no measure
for Objectives 1, 3, 4 and 5):

> *Percentage of Correspondence.* For Objective 3, the reading specialist marks each
> word of a learner's system-generated practice list as one the learner frequently
> misreads or not; correspondence is the number of words confirmed divided by the number
> of words judged, multiplied by 100. For Objective 4, the specialist independently
> assesses each learner's current decoding level before viewing the level assigned by the
> system; correspondence is the number of learners whose assigned level matches the
> assessed level divided by the number of learners, multiplied by 100. Objectives 1 and 5
> are determined from the specialists' ratings on a five-point scale, summarized by
> weighted mean and interpreted with Table 1.

---

## 3. Scope and delimitation

**"The study does not measure gains in reading proficiency, reading fluency…"** The
application has optional *baseline* and *endline* tags and a panel that puts the first
and last sessions side by side. Until 8 October that panel, its export and several
documents described it as evidence that "decoding itself improved", called faster times
"the improvement", and pointed to a significance test. All of that was removed. The panel
is now titled *Start and end of testing*, and states that it is a descriptive record, not
a gain, with no inferential test. **Do not report it as a result.**

**Reading rate.** Response time is recorded — the proposal lists it among the system
usage data — and the reports show a typical time per correct word. It is described
everywhere as recorded time, not reading rate or fluency, which the study excludes.

**"Avoidance of Harm … no comparative or public reporting of individual reading
performance."** The specialist's *Cohort overview* shows the five children side by side,
ordered by code, not ranked. It is a working view for planning; **do not print or
circulate it**, and report individual results in Chapter 4 by code without ranking.

---

## 4. Data set

**Phonological awareness item bank.** The proposal lists sound isolation, rhyming,
blending and segmentation, "sequenced from simple to complex (syllable-level awareness,
onset-rime awareness, and phoneme-level manipulation)".

| Task in the proposal | In the application |
|---|---|
| Segmentation | *Count the syllables* — syllable level |
| Blending | *Blend the parts* — **added 8 October**; syllable level. Until then, blending was missing, and "Listen & choose" (hearing a whole word and finding it, which is word recognition) carried the label. Each syllable is spoken as its own clip, about half a second to a second apart: the original generated clips ran the syllables together, so blending would have played the answer. A syllable that is a lone vowel (*a-so*) is played from the specialist's recording of that vowel; until it is recorded, the word is left out |
| Rhyming | *Rhyme time* — onset–rime |
| Sound isolation | *First sound* — phoneme isolation |
| Phoneme-level manipulation | *Change the sound* — **added 9 October**, phoneme substitution: the child hears a word (*bata*), then the sound to take out (/b/) and the sound to put in (/m/), and picks the word that makes (*mata*, against *bata* unchanged and *lata*). Built from the 48 pairs of bank words that differ only in their first sound. The sounds are **recorded by the reading specialists** — the speech voice says a lone letter by its name ("bi", "ey"), the opposite of Marungko's sounds before names — so a pair is used only once both of its sounds are recorded |

**The letter sounds.** The research team decided on 9 October that the specialists record
the sounds. The word bank has a *Letter sounds* panel for the twenty the activities need —
the vowels a, e, i, o, u; the consonants m, s, b, t, k, l, y, n, g, p, r, d, h, w; and the
digraph ng. Each is trimmed to the sound in the browser and stored once. The same
recordings fix a second problem the team heard: the voice's lone vowels sounded "so
English", so a lone-vowel syllable is now only ever spoken from the specialist's vowel.

**Suggested manuscript wording** for the Data Set's item bank:

> Phonological awareness item bank, consisting of sound-isolation, rhyming, blending,
> segmentation and phoneme-manipulation tasks sequenced from simple to complex:
> syllable-level awareness (blending and segmenting syllables), onset-rime awareness
> (rhyming), and phoneme-level awareness (isolating and substituting the initial sound of
> a word), consistent with the principles of Structured Literacy and with approaches such
> as Orton-Gillingham. Isolated phonemes are presented from recordings made by the
> reading specialists of the partner institution, so that each letter is heard by its
> sound rather than its name, consistent with the Marungko Approach.

And, if the manuscript describes the activities, for the System Development or Scope:

> The phonological-awareness activities are Blend the Parts (syllable blending), Count the
> Syllables (syllable segmentation), Rhyme Time (rhyming), First Sound (initial-sound
> isolation) and Change the Sound (initial-sound substitution). Each presents its prompt
> as audio and its answer choices in print; the word to be read is never shown before it
> is answered.

**Leveled word lists** — 254 Filipino words in five levels by structure (CV-CV open
syllables; closed syllables and vowel sequences; three syllables; clusters and complex
codas; four or more syllables). Each word is stored with its syllable pattern (CVCV,
CVCVC…), level and Marungko stage, as the proposal's "tagged with its target phoneme or
syllable pattern and its difficulty level" requires.

**Skill-progression map** — "the mastery criteria that a learner must meet at each stage
(phonological awareness, then single-word decoding) before the system advances the
learner". Until 8 October promotion read oral reading alone. It now follows the map.
**Suggested manuscript wording:**

> A learner advances to the next difficulty level only after meeting, at the current
> level, (a) the phonological-awareness criterion — at least eight responses in the
> listening activities with at least 80% correct over the latest twelve — and then
> (b) the single-word decoding criterion — at least eight oral readings with at least 80%
> correct over the latest twelve, provided correct readings are not becoming more than
> 25% slower. A learner moves down a level when decoding accuracy over the latest twelve
> readings falls to 50% or below. The reading specialist may set a learner's level
> directly at any time.

Both thresholds are 80%, set by the research team on 9 October (decoding was 85%); the
specialists confirm them at the consultation (decision 8). The listening activities are
the five above.

**Instructional content reviewed by the specialists before use** — the consultation
brief is that review, with every item listed in its appendices and a sign-off line
(decision 14). The specialists can also record any word, and now any word's syllables,
in their own voice from the word bank; learners then hear the recording.

**Reading activity data** — "the words presented during each reading session, the
learner's transcribed spoken response, reading accuracy, the type of word-level error
identified, response time, and completed learning activities … recorded with a timestamp
and linked to the learner's profile." All recorded, with one small gap: a word on screen
when a child leaves an activity, unanswered, is not stored (the session's totals count
answered words). If the manuscript claims every word *presented*, say *every word read
or skipped*.

---

## 5. Validation and statistical treatment

**ASR integration validation** "across the supported browsers and microphone
configurations" — the `/diagnostics` page records three seconds on the device and scores
it end to end. Running the proposal's browser list against the code found that **Firefox
recordings could not be scored at all**: Firefox labels its audio with a space the server
refused. Fixed on 8 October; `npm run asr:check` now holds every browser's format. Firefox
has still not been tested on a device — do that before relying on it.

**Reading assessment validation** — "Discrepancies will be documented and used to refine
the scoring logic and the feedback thresholds." The application lists both kinds of
discrepancy and, from 30 reviewed readings, recommends whether the acceptance threshold
should move. It never moves it by itself. Refine it **once, when validation ends**, and
report the percentage of agreement at both thresholds (the similarity is stored on every
reading, so both can be computed).

**Percentage of agreement** — computed on **blind** reviews: the system's verdict is
hidden until the specialist has given theirs. A verdict given with the answer visible can
be pulled toward it. **Suggested addition** to the Statistical Treatment:

> Agreement is computed over first readings of real words, scored by the specialist
> before the system's verdict is shown to them.

**Statistics beyond the proposal.** The calibration page also reports Cohen's κ, the
Matthews correlation and a bootstrap interval. They are not among the proposal's
measures; use them, if at all, in the Validation discussion to explain why a threshold
was chosen, and keep percentage of agreement as the Objective 2 result.

**Descriptive treatment only.** The analysis guide (`docs/data-guide.md` §5) now uses
only frequency and percentage, weighted mean, percentage of agreement and qualitative
analysis, objective by objective, with everything else labelled supplementary.

---

## 6. Hardware and software specifications

**Table 3 (development hardware)** — accurate. One observation from this build: on an
8 GB machine the full automated test run regularly exhausted memory, which supports the
16 GB recommendation.

**Table 4 (deployment environment)** describes a provisioned Linux server (2 vCPU,
4 GB, 40 GB, Ubuntu). LEXORA does not run on one. **Suggested replacement:**

| Component | Specification |
|---|---|
| Application hosting | Vercel — serverless functions (Node.js), region `icn1` (Seoul), alongside the database |
| Database | Supabase PostgreSQL 17, region `ap-northeast-2` (Seoul); row-level security on every table; public data API disabled |
| Server provisioning | None by the researchers: compute, memory and storage are managed by the platforms |
| Security | HTTPS/TLS for every request (platform-managed certificate); TLS to the database with the server's certificate verified (added 8 October — until then the database connection was unencrypted); passwords stored as bcrypt hashes |

**Table 5 (end-user requirements)** names Chrome, Edge or Firefox. The application
targets Chrome, Edge and **Safari on iPad (iPadOS 14.3 or later)**; Firefox's recordings
are now accepted but it has not been tested on a device, and it has no browser fallback
recognizer. **Suggested browser row:** *Google Chrome, Microsoft Edge, or Safari (iPadOS
14.3 or later), latest stable version.* Add Firefox back once it passes `/diagnostics`.

**Table 6 (software).** **Suggested replacement:**

| Category | Software / technology |
|---|---|
| Front-end | Next.js 16 (React 19, TypeScript 5) with Tailwind CSS 4; responsive, dyslexia-friendly interface in English and Filipino |
| Back-end | Next.js route handlers on Node.js; input validation (Zod); signed session tokens; bcrypt password hashing |
| Database | PostgreSQL 17 (Supabase), accessed through the Prisma ORM |
| Speech recognition | Pre-trained Whisper large-v3-turbo, hosted by Groq, through an API, with Tagalog as the language; no custom model is trained |
| Text-to-speech | Microsoft neural Filipino voice (fil-PH-BlessicaNeural), clips stored for reuse; browser speech synthesis as a fallback; synchronized highlighting and adjustable rate |
| Development tools | Visual Studio Code; Git and GitHub for version control |
| Testing tools | Ten automated test suites driving a headless browser (authorization, logic, interface, navigation, sessions, reporting, decoding, calibration, data integrity, and WCAG 2.1 AA accessibility), performance budgets measured on the study's minimum end-user specification, and manual and user acceptance testing |
| Documentation | Word processing and diagramming tools; the repository's own documentation |

Keep Figma in *Development tools* only if it was used.

**Disclosure.** The repository's commit history records AI coding assistance. Check
whether the College or the panel requires it to be declared in the methodology.

---

## 7. Ethics

The application and the consent forms were brought into line with the proposal on
8 October:

| Proposal | Before | Now |
|---|---|---|
| Records held "under a coded learner identifier" | Children registered under a first name or nickname | Enrolled as `L1`…`L5`, with a sign-in made from the code; the name stays on the paper intake sheet |
| Audio "not linked to the child's name in the transmitted request" | True | True, and now stated in the consent form and privacy notice |
| Audio "retained only for the duration of the evaluation phase, after which all audio files will be permanently deleted" | Deleted after 180 days or when cleared | Cleared at close-out on every learner page, **then every backup written before that is deleted** — backups held copies the app could not reach; each backup now says how many recordings it holds |
| Benefits: "improved access to reading support tools, personalized … practice … organized progress monitoring" | Consent form: "your child may improve at reading" | Consent form describes access, practice and records, and says the study does not measure improvement |

**One sentence in the manuscript should change.** *Privacy and Confidentiality:* "Only
the resulting text transcription and the derived reading-accuracy record are stored in
the system database." The proposal's own Validation and Statistical Treatment need the
specialist to score "the same recordings" as the system, so the recordings must be kept
until that is done. **Suggested replacement:**

> The audio recordings are stored in the system database under the coded learner
> identifier only for the duration of the evaluation phase, so that the reading
> specialist can score the same recordings the system scored; they are then permanently
> deleted, including from every backup copy. The text transcription and the derived
> reading-accuracy record are retained.

---

## 8. The title

The title page reads *LEXORA: Development of an AI-Assisted Reading and Progress
Tracking Web Application for Persons with Dyslexia Using the Marungko Approach*. Three
places in the body use *LEXORA: Design and Development of an AI-Assisted Reading and
Progress Tracking Web Application for Persons with Dyslexia*: the last paragraph of the
Background, the description of Fig. 2 (Conceptual Framework), and the first paragraph of
Research Design. Pick one. The application's documents and consent form now use the
title page's wording, since that is the one an ethics protocol registers.

---

## 9. The figures

**Fig. 1 (Scope) and Fig. 2 (Conceptual Framework) list four features that appear
nowhere in the text.** The Statement of Objectives, the Scope paragraph and the
description of Fig. 2 never mention them, and the application does not have them.
Fig. 2's own description gives the AI features as exactly three: pronunciation
feedback, adaptive word-level exercises and personalized practice word lists. A panel
reading Fig. 1, titled *Scope of the LEXORA web application*, will expect to see all
four.

| In the figures | In the application | Recommendation |
|---|---|---|
| **Bionic Reading** (Reading Support Module) | No | Remove. It bolds the first part of every word at a fixed fraction, cutting across syllables (**bah**ay), while the Marungko Approach reads by syllable (ba-hay). It also invites a child to guess a word from its beginning, the habit decoding practice works to replace. Its benefit for readers with dyslexia is not established, and *Bionic Reading* is a registered trademark |
| **Dictionary** (Reading Support Module) | No | Remove. The study concerns decoding single words, and no objective or instrument covers word meaning. Building it would mean writing a meaning for each of the 254 words and having the specialists review them |
| **Text Simplification** (AI Assistance Module) | No | Remove. Simplification rewrites sentences and passages, and the Delimitation places passage-level reading outside the study |
| **Teacher/Parent Dashboard** (Output) | A learner dashboard and a specialist dashboard; no parent account | Rename it *Learner and Specialist Dashboards*. The text gives the dashboard to "the learner and the authorized reading specialist", and names parents as beneficiaries, not users. A parent sees progress on the child's dashboard, with the child, or on the printed report. A parent account would be a new route to a child's records that the consent form and *Privacy and Confidentiality* do not cover |

**The two figures also differ from each other.** Fig. 2 includes *Speech Responses*
(input) and *Reading Ruler*; Fig. 1 has neither. Both are in the text and in the
application, so add them to Fig. 1.

**Every other item is in the application:**

| Figure item | In the application |
|---|---|
| User information | Learner profiles under codes L1–L5, with level; learner and specialist accounts |
| Reading materials | The 254-word leveled bank; the Reader's word sets |
| Accessibility preferences | Settings |
| Speech responses | Read aloud recordings |
| Reading performance data | Every reading and activity, timestamped and linked to the learner |
| User management | Sign-in; learner and specialist roles; enrolment and specialist access codes |
| Accessibility features, text-to-speech, reading ruler | Settings; the Reader (highlighting, adjustable speed); focus ruler |
| Syllable breakdown | **Show syllables** in the Reader (added 10 October; also a saved setting), which splits each word where the word bank does (ba-hay); *Count the syllables* and *Blend the parts*; the feedback after every reading. Read aloud never splits the word, because the split would do part of the decoding being measured |
| Adaptive reading exercises | Levels 1–5 on the skill-progression map (§4) |
| Speech-to-text | Whisper, through Groq |
| Pronunciation feedback | After every reading, with the word modelled and "Now you try it!" |
| Personalized word lists | The practice list, built from misreads |
| Reading history | *Recent activities* on Reports and on the specialist's learner page |
| Performance monitoring, analytics, reports | Dashboard, Reports, error patterns, the Cohort overview, exports |
| The six outputs | All of the above; the dashboard output as renamed |

**Fig. 3 (Agile SDLC)** matches the six phases in the text. The image has one typo: under
*Testing*, "verify Lexora Lexora quality".

**Suggested item lists** for a redrawn Fig. 2 (Fig. 1 uses the same lists):

> **Input:** User Information; Reading Materials (leveled word lists); Accessibility
> Preferences; Speech Responses; Reading Performance Data.
>
> **Process:** (1) User Management. (2) Reading Support Module: Display Customization;
> Text-to-Speech with Word Highlighting; Adjustable Reading Speed; Reading Focus Ruler;
> Syllable Breakdown. (3) AI Assistance Module: Speech-to-Text (pre-trained ASR);
> Pronunciation Feedback; Adaptive Exercises (phonological awareness and decoding);
> Personalized Practice Word Lists. (4) Progress Tracking Module: Reading History;
> Performance Monitoring; Analytics; Reports.
>
> **Output:** AI-Assisted Reading Support; Personalized Reading Activities; Reading
> Progress Reports; Learner and Specialist Dashboards; Accessible Reading Environment;
> Reading Performance Analytics.

If the team would rather keep any of the four, each must also be added to the
Objectives or Scope and given an instrument item. Otherwise a panel can ask how it was
evaluated.

---

## 10. What the application does beyond the proposal

None of these contradicts the proposal. Present them as tools for the specialist or as
validation evidence, **not as results**.

| Feature | How to present it |
|---|---|
| Blind review | Part of Objective 2's method: why the agreement can be trusted |
| Observation tags (vowel, cluster, stress…) | Part of "word-level error patterns" (Objective 5) — what the specialist heard, beside what the machine recorded |
| Threshold calibration (κ, MCC, bootstrap) | Validation evidence for refining the threshold |
| Latency guard in the level rule | Part of the adaptive mechanism (Objective 4): promotion waits while correct readings slow |
| Decoding probe (made-up words) and the decoding-vs-recall panel | A specialist tool for telling decoding from memorising the bank; supplementary record |
| Start and end of testing | A descriptive record for planning; **not** a gain |
| "Now you try it!" re-read | Part of immediate pronunciation feedback (Objective 3) |
| IEP draft | Part of the progress reports (Objective 5; rated in instrument 06, D7) |
| Cohort overview | The specialist's working view; not for circulation (§3) |
| `/diagnostics` | ASR integration validation, per device |
| English/Filipino interface | Interaction capability |
| Enrolment and specialist access codes | Security |

---

## 11. Decisions still open

Decided by the research team on 9 October: the specialists record the letter sounds, and
Change the sound is built on them; both level thresholds are 80%; lone vowels are spoken
only from a specialist's recording; `ENROLMENT_CODE` is set on the deployment.

Still open, for the team, mostly with the specialists — the consultation brief carries
each one:

1. **The specialists record the twenty letter sounds** (word bank → *Letter sounds*)
   before testing. Until a pair's two sounds exist, Change the sound has nothing to play,
   and 27 lone-vowel words stay out of blending and syllable counting.
2. Confirming the 80% thresholds and the 50% demotion line (decision 8), and that every
   session includes a listening activity.
3. The blending and sound-change activities as built (decisions 11–12).
4. Who completes instrument 06, when, and how decoding level is assessed (decision 13).
5. Whether Table 2's labels, which describe ease of use, should be generalised for the
   two pictorial items about enjoyment and wanting to use it again (instrument 04).
6. Figs. 1 and 2: redraw them without Bionic Reading, Dictionary and Text
   Simplification, with the dashboard renamed (§9). The alternative is to build those
   features and add them to the Objectives and instruments.
7. The manuscript changes in §2 and §4–§9 above.

And before the first child, operationally: ethics clearance; adviser review of every
instrument; a Cebuano translation of the consent and assent forms; the demo passwords
rotated; the daily backup task registered (`scripts/schedule-backup.ps1`).
