# Considered and deliberately deferred

A record of ideas that were weighed during LEXORA's development and set aside on
purpose, with the reason and what would have to change to revisit them.

This is **not a backlog**. Nothing here is owed. It exists for three reasons: it
feeds the Future Work section directly, it lets a good idea be let go of without
being lost, and it gives whoever continues this project the reasoning rather
than only the code.

Written at the point of feature freeze, before the study began collecting real
data. Every item below was declined for a stated reason, not for lack of time.

---

## Deferred pending real usage data

### Per-learner calibration thresholds
The acceptance threshold is fitted once, across every learner
(`src/lib/calibration.ts`). A child with an unusual accent or a quiet voice may
warrant a different cut-point from the rest.

**Why not now:** thirty labelled readings are needed to fit one threshold
honestly. Five children cannot each supply thirty before the study ends, and a
per-learner threshold fitted to ten readings would be noise wearing a decimal
point. **Revisit when:** any single learner has accumulated enough reviewed
readings to fit their own curve, and the cohort curve shows they are an outlier.

### Phonological error clustering
`ReviewErrorTag` collects what a specialist heard — vowel, digraph, cluster,
stress. With enough of them, a per-learner heatmap of phonetic weaknesses
becomes possible.

**Why not now:** tagging is optional and coverage starts at zero. A heatmap over
three tagged misreadings would be read as a profile. It is also the version of
this idea that survived: computing the same chart from ASR transcripts was
designed, then abandoned once the transcripts turned out to be 159 fabricated
seed rows plus recogniser spelling quirks. **Revisit when:** tag coverage is
high enough to state a denominator anyone would accept.

### Automated pre/post significance testing
`src/lib/phases.ts` reports baseline against endline as descriptives. It stops
there.

**Why not now:** five participants cannot support a p-value, and one rendered on
a web page would be quoted long after the caveat was forgotten. The test also
depends on the design — paired, non-parametric, corrected for multiple measures
— which is a decision for the analysis, not a default in an app. **Revisit
when:** never, in this form. A future version with a larger cohort should still
export to a statistics package rather than compute inline.

---

## Deferred on methodological grounds

### Fine-tuning Whisper on learner recordings
Considered in response to an expectation that the study would fine-tune a model.

**Why not:** unsound three times over. With five participants there is no
held-out set, so fine-tuning on their recordings and evaluating on the same
children is training on the test set. Using children's voice recordings as
training data is a different processing purpose under RA 10173 from the
assessment purpose parents consented to. And the deployment is serverless, which
cannot host the result. Calibrating the decision layer against human labels is
the defensible adaptation at this sample size. **Revisit when:** there is a
corpus large enough to hold out a test set, and consent that covers training.

### Stress detection from audio
Filipino does not write stress, so *búkas* and *bukás* reach the scorer as the
same five letters. Six words in the bank are flagged for this
(`STRESS_NOTES` in `prisma/word-bank.ts`) and a specialist can tag it by ear.

**Why not automated:** detecting it requires pitch and duration analysis of the
waveform, which a transcription API does not expose. It would mean a second
audio pipeline for one feature. **Revisit when:** stress errors turn out to be
frequent enough in the tagged data to justify the machinery.

### Sentence and phrase reading
**Why not:** excluded by the study's own delimitation. LEXORA is word-level:
phonological awareness and single-word decoding. Connected text, fluency (WCPM),
spelling and comprehension are out of scope by design, and adding them would
make the app answer a question the research design does not ask.

---

## Deferred on interaction grounds

### Select-to-speak across the interface
Highlight any text and hear it read aloud.

**Why not:** two reasons. Text selection on the partner's low-end Android
tablets means a long-press and two drag handles, which is demanding for a
seven-year-old with motor and attention differences — the primary users would
struggle to reach the feature. More seriously, it must never work inside a
scored activity: a child could select the target word and have the app pronounce
it, which would silently invalidate accuracy, decoding time, the adaptive level,
and the non-word probe entirely. **Revisit when:** there is a design that is
touch-first and provably inert during assessment. The Reader's existing
tap-a-word already covers the safe case.

### Offline-first sync
The app requires a connection; a dropped one is handled gracefully
(`src/lib/net.ts`) but readings cannot be recorded offline.

**Why not now:** the partner site has usable connectivity, and a sync layer
brings conflict resolution, local storage of children's voice recordings, and a
second copy of personal data on a shared tablet — a privacy surface that needs
its own consent discussion. **Revisit when:** connectivity proves to be a real
obstacle during the study rather than an anticipated one.

---

### A password-reset button in the specialist workspace
`npm run password:set` changes any account's password and is the recovery path
when a participant forgets theirs. A specialist could reasonably expect to do
that from the learner page instead of asking the researcher.

**Why not now:** it is new application surface during a feature freeze, and new
surface on the highest-privilege screen in the app — a control that rewrites
another account's credentials wants more care than a CLI run by one person on
one machine. The CLI covers five participants at one site adequately. **Revisit
when:** the tool is used beyond a single site, or by someone who does not have a
terminal.

## Small, deferred only for the freeze

- **Bulk phase tagging.** Tagging sessions one at a time is fine for five
  children; it would not be for fifty.
- **Cohort print view.** Per-learner reports print
  (`src/components/PrintButton.tsx`); the cohort page does not.
- **Filipino for the learner-facing exercise internals.** Complete for
  everything a child sees; the specialist workspace was finished at the freeze.

---

## Why the freeze

Everything in LEXORA has been validated against automated tests and zero real
children. Each further feature adds surface to defend at a defense, and more
code no participant has touched. The risk stopped being "too little
application" some time ago; it is now "the application keeps growing while the
study does not start."

The instruments are built. What they need is children reading into them.
