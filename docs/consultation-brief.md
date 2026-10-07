# LEXORA — Brief for the Reading Specialist Consultation

**Purpose of the meeting:** to settle the decisions about reading content and scoring
that only a reading specialist can make, *before testing with the children begins*. The
proposal has the instructional content "reviewed by the reading specialists for
appropriateness before use", and this meeting is that review. Once testing starts, keep
these fixed: if a scoring rule changes partway, the readings before and after the change
were judged by different rules, and the percentage of agreement (Objective 2) would mix
the two.

Each item below states what LEXORA does now, the question, and what changes depending
on the answer. Tick a box or write the decision beside it. The appendices list every item
in full, generated from the application's own files on 7 October 2026, so what you
review is what the children will see.

---

## What LEXORA is, in two paragraphs

A web application for word-level Filipino reading practice with children aged 7–12 who
have dyslexia, sequenced by the Marungko Approach. A child reads single words aloud; a
pre-trained speech recogniser (Whisper, via Groq) transcribes the recording, and the
transcript is compared letter by letter with the target word. The child also does
listening activities (listen and choose, blend the parts, syllable counting, rhyme, first
sound), a Reader
where words are spoken to them, and a short **decoding probe** of made-up words.

LEXORA does not diagnose and does not replace a specialist. Your verdicts are the ground
truth: every recording can be replayed and judged **blind** (the machine's answer is
hidden until you have given yours). The study measures how often the machine agrees with
you, and the probe is scored by you alone.

---

## Decisions needed, in order of how much they affect the study

### 1. Do e↔i and o↔u count as reading errors?

**Now:** yes. A child who reads *mesa* as "misa", or *bote* as "boti", is scored as
having made a vowel substitution. The "Vowel" error category's own example is *"tila" for
tela*. A scored error lowers accuracy, can move the child down a level, and puts the word
on their practice list.

**Why it matters here:** the children are in Davao and many will speak Cebuano at home.
Cebuano has three vowels — a, i, u — with *e* and *o* mostly in borrowed words, so these
alternations can be how a child *speaks* rather than a failure to *decode*. Scoring them as
errors could make a Cebuano-dominant child look like a weaker reader than they are.

**Options:**
- ☐ Keep strict scoring. The analysis then reports, alongside, accuracy re-scored with
  e/i and o/u treated as equal — every transcript is stored, so this is possible later.
- ☐ Accept e↔i and o↔u as correct from the start. (A small change in the application;
  must be made before testing begins.)
- ☐ Accept them only on some words, or only for some children: ______________________

### 2. The made-up words of the decoding probe (Appendix C)

**Now:** 26 non-words, 8 shown to a child per sitting, at most once every 7 days, scored
by you by ear. Every one was checked against Tagalog and Cebuano when written.

**The problem:** the bank's own rule is that a non-word must not be one letter away from a
word the child practises, because a child who reads *mesu* as "mesa" has shown guessing,
not a decoding failure. **Eight break that rule** (marked ⚠ in Appendix C): *mesu, sobi,
kelo, sabim, misab, taklo, kanit, obisa*.

**Decide:** ☐ keep them ☐ replace them (the Word bank screen's *Suggest probe words*
generates candidates for you to screen; each needs a Tagalog **and** Cebuano check).
Also: ☐ re-confirm that none of the 26 is a Cebuano word, name or brand familiar in Davao.

Keep the probe list fixed once testing starts, so every child meets the same items.

### 3. Spellings accepted as a correct reading (Appendix D)

**Now:** for 24 words, certain recogniser spellings are accepted as correct outright —
*krus* written as "cross", for example. Each was added because the recogniser writes a
correctly read word that way.

**The concern:** some of them accept what the error categories call errors:

| Accepted | For | Looks like |
|---|---|---|
| poblema | problema | the *pr* cluster simplified — the "Consonant cluster" category |
| bas | bus | a vowel substitution |
| trama, grato | drama, grado | *d* read as *t* |
| sinelas, sinilas, sinalas | tsinelas | *ts* reduced; vowel changes |
| sobri, libru | sobre, libro | e/i and o/u — see decision 1 |
| dape | dyip | unclear why this was added |

**Decide per row:** ☐ keep ☐ remove. You can also edit these yourself on the Word bank
screen (*Accepted spellings*).

### 4. Where a new child starts

**Now:** every new learner starts at difficulty level 1, which draws words from Marungko
stage 3 — the letters **m, s, a, i, o, b, e, u**. Stages 1 and 2 alone hold only 14 words
in the bank, too few for an eight-word session not to repeat itself within a sitting.
LEXORA has no activity that teaches single letter–sound correspondences, and no control
for setting a child's stage directly: you set the **level** on the learner's page, and
the stage follows (level 1 → stage 3, 2 → 4, 3 → 5, 4 → 6, 5 → 7).

**Decide:** ☐ stage 3 is a suitable starting point for these participants ☐ a child must
show stage 1–2 letters first (outside LEXORA, or with the specialist), before using it
☐ other: ______________________

### 5. What counts as a rhyme (Appendices A and B)

**Now:** an answer must share the prompt's **whole last syllable** when that syllable ends
in a vowel (*ma-ta / ba-ta*), or its vowel and closing consonant when it ends in a
consonant (*da-mit / ga-mit*). Sharing only the last vowel (*lo-lo / lo-bo*) is a rhyme in
Tagalog verse, but was judged too subtle for a seven-year-old learning to hear one. No
wrong option may share even the last vowel, so a child is never marked wrong for an answer
a teacher would accept.

Seventeen items were revised on 7 October to meet this rule (marked *revised*); the old
set included pairs such as *tren / krus* and *oso / ubo* (first sound).

**Decide:** ☐ the rule is right ☐ looser (vowel-only) ☐ stricter. Then review all 76
items, especially the revised ones.

### 6. Words whose meaning depends on stress (Appendix E)

Filipino does not write stress, so *búkas* and *bukás* reach the scorer as the same letters
and are marked the same however they were said. Flagged words show you a caveat so you
judge them by ear. **Eight** are flagged; *basa* and *gabi* were added on 7 October.

**Decide:** ☐ confirm each reading — in particular the second reading of *puto* ☐ add
others from the bank: ______________________

### 7. The observation categories you record (10)

Errors: vowel, first sound, last sound, digraph (ng, ts, dy, sy), consonant cluster,
syllable dropped, syllable added, stress. Behaviours (not errors): self-corrected in the
recording, could not tell. All optional; blank is honest missing data.

**Decide:** ☐ the categories are complete and distinct ☐ change: ______________________
(Decision 1 affects whether e↔i belongs under "vowel".)

### 8. How the difficulty level moves — the skill-progression map

**Now:** the proposal's map — "phonological awareness, then single-word decoding" — in
that order. To move **up** a level, a child must meet both at their current level:

1. **Phonological awareness:** at least 8 answers in the listening activities (blend the
   parts, count the syllables, rhyme, first sound), **80% or more** correct over the latest
   12. Taken across the four together, not each one, so a short session does not hold a
   child back; the split per activity is shown to you.
2. **Single-word decoding:** at least 8 first readings aloud, **85% or more** correct over
   the latest 12 — unless correct readings are getting more than 25% slower, a sign of
   effortful decoding (Filipino is regular enough that a struggling reader is often
   accurate but slow).

**50% or less** on the readings → **down** a level; phonological awareness plays no part in
moving down. A practice word is mastered after two correct readings in a row. A new
*Skill progression* panel on each learner's page shows where the child stands on both,
and you can set the level by hand at any time.

One consequence to agree on: **a child who only ever does Read aloud will not move up**,
because the first criterion is never shown. Sessions need a listening activity as well.

**Decide:** ☐ reasonable ☐ adjust the 80% / 85% / 50%: ______________________
☐ sessions will include a listening activity ☐ other: ______________________

### 9. The word bank itself (Appendix F)

254 real words in five levels. Each word's Marungko stage is worked out from its letters,
so a word never appears before its letters are taught. Some everyday words are kept out
deliberately because their colloquial sense is adult or upsetting (for example *suso*,
*patay*, *dugo*).

**Decide:** ☐ suitable for the participants ☐ remove / move: ______________________

### 10. The scoring procedure

- Review **blind** (the default). Roughly **30** reviewed readings are needed before the
  application will suggest whether the acceptance threshold (0.95 similarity) should move;
  it never moves it by itself.
- Probe readings are yours alone to score; until you do, they count as neither right nor
  wrong.
- *Optional:* tag the first and last sessions of testing (Study timeline on each learner's
  page). This labels the record for you; it is not a pre/post measure, because the study
  does not measure reading gains.

**Decide:** ☐ one specialist scores everything ☐ two specialists score an overlapping
sample, for inter-rater agreement (recommended — it shows the human verdicts the machine is
measured against are themselves reliable). Who: ______________________

### 11. Blend the parts — the new blending activity

**Now:** the proposal's phonological-awareness bank lists sound isolation, rhyming,
**blending** and segmentation; until 8 October LEXORA had every one except blending. The
child hears a word only in its syllables — *ba… ta* — and taps the word they make, from
three. The wrong options share a syllable with the answer wherever the bank allows (*bata*
against *baso* and *lata*), so catching the first part alone is not enough. The whole word
is played only after the answer, as feedback. The syllables come from the same clips the
syllable-counting activity uses.

**Decide:** ☐ suitable as written ☐ the parts should be shown in print as well ☐ the gap
between syllables is too short / too long on the clips ☐ other: ______________________

### 12. Phoneme-level manipulation — in the proposal, not yet in LEXORA

**Now:** the proposal's item bank runs "from simple to complex (syllable-level awareness,
onset-rime awareness, and phoneme-level manipulation)". LEXORA covers syllable level
(blending, counting), onset–rime (rhyme) and phoneme **isolation** (first sound) — but has
no task that *manipulates* a phoneme (say *bata* without /b/; change /b/ to /m/).

**Why it is not built:** such a task has to play single sounds — /b/, /m/ — and the speech
voice says letters by their **names** ("bi", "em"). The Marungko Approach teaches sounds
*before* names, so a voice that says "bi" for /b/ would teach the opposite of the method.
It would need your own recordings of each sound.

**Decide:** ☐ record the sounds (about 20 short clips) and add the task ☐ the study
covers phoneme level through first-sound isolation; the manuscript wording is amended
☐ other: ______________________

### 13. Verifying Objectives 3 and 4 — instrument 06

The proposal has a reading specialist verify two things LEXORA produces:

- **Objective 3** — whether each child's practice list holds the words they most often
  misread. Each practice word on the learner's page now shows how many of its misreads
  you **confirmed** or **overturned** when reviewing recordings — the evidence for this.
- **Objective 4** — whether the level LEXORA assigned matches the child's decoding level
  as **you** assess it. To be fair to the comparison, you record your assessment *before*
  looking at LEXORA's level.

**Decide:** who completes the sheet ______ · when (near the end of testing) ______ · how
you assess decoding level for Objective 4 (your usual method; Appendix F lists the words
by level) ______________________

### 14. Signing off the content

The proposal: "The instructional content is reviewed by the reading specialists for
appropriateness before use." The appendices below are that content, generated from the
application itself.

**Decide:** ☐ approved as it stands ☐ approved with the changes marked above
Reviewed by: ______________________ Date: __________

---

## What was corrected before this meeting

So nothing you see contradicts this brief:

- **Made-up words were reachable in the Reader.** The Reader listed the probe's non-words
  and read them aloud, which would have taught them. Fixed before any participant used it;
  no study data was affected.
- **Seventeen rhyme and first-sound items** were wrong or ambiguous (decision 5).
- **The agreement percentage** on a learner's page included probe items, where the machine
  is wrong by design; it now covers real words only.
- **The IEP draft** paired an all-time accuracy with a 14-day count; it now states both.
- **Dates and times** showed in UTC on the live site — 8 hours behind; they now show
  Philippine time.
- **A new child's stage** showed as 1 while they were taught from stage 3 (decision 4).
- **"Self-correction" meant two things.** The panel of re-reads taken *after LEXORA said
  the word* is now called "Re-reads after hearing the word". Self-correction — fixing an
  error unprompted — is what you record with the *Self-corrected* observation, which can
  now be recorded on a reading you mark correct.
- **The backup recogniser leaned towards "correct".** When the main speech recogniser was
  unreachable, the browser's own picked whichever of five guesses was closest to the
  target word. It now takes its own best guess.
- **A word's stage could be typed by hand** when adding it to the bank; it is now always
  worked out from its letters.
- **Readings made in Firefox could not be scored.** Firefox labels its recordings slightly
  differently from Chrome and Safari, and the server refused the label. Firefox is one of
  the three browsers the proposal's requirements name; its recordings are now accepted.
- **"Listen and choose" was described as blending.** Hearing a whole word and finding it is
  word recognition; blending is now its own activity (decision 11).

---

## Appendices — the content as the children will see it

### A. Rhyme items (46)

| Level | Prompt (spoken) | Answer | Distractors | |
|---|---|---|---|---|
| 1 | bahay | **buhay** | bola, gatas |  |
| 1 | bola | **lola** | dahon, mais |  |
| 1 | tasa | **masa** | ilog, yelo |  |
| 1 | puso | **oso** | ulan, aklat |  |
| 1 | mata | **bata** | puno, gulay |  |
| 1 | lolo | **talo** | mesa, sakit | revised |
| 1 | pito | **dito** | bola, ulap | revised |
| 1 | sabi | **gabi** | damo, takot | revised |
| 1 | tela | **dila** | bato, hipon | revised |
| 1 | buko | **tuko** | pera, silid |  |
| 1 | baso | **aso** | bibe, dagat | revised |
| 1 | hita | **lata** | kuko, labas | revised |
| 1 | kuya | **tiya** | bote, kanin | revised |
| 1 | ate | **bote** | lobo, gamit | revised |
| 1 | sala | **wala** | puso, tinig |  |
| 2 | ilaw | **araw** | mesa, kuto |  |
| 2 | damit | **gamit** | baso, ulap |  |
| 2 | ulan | **kanan** | tela, oso |  |
| 2 | gatas | **lakas** | puno, dila |  |
| 2 | takot | **kamot** | mata, hari |  |
| 2 | sakit | **sabit** | bola, daga |  |
| 2 | nanay | **tatay** | baso, ilog |  |
| 2 | bahay | **sanay** | kuto, damo |  |
| 2 | hilaw | **dilaw** | puso, mani |  |
| 2 | hapon | **sipon** | tela, buko |  |
| 2 | bakod | **pusod** | lola, gabi |  |
| 2 | labas | **ubas** | pito, yelo |  |
| 2 | kulot | **pulot** | mesa, hita |  |
| 2 | lamok | **manok** | bato, wika |  |
| 2 | bukas | **lakas** | dito, lobo | revised |
| 3 | salamin | **damdamin** | mesa, bola | revised |
| 3 | payong | **tulong** | baso, mata |  |
| 3 | ngiti | **kalapati** | gulay, damit | revised |
| 3 | salamat | **watawat** | puso, lobo |  |
| 3 | kandila | **dila** | takot, manok |  |
| 3 | mabilis | **malinis** | bato, araw |  |
| 3 | gulong | **tulong** | tasa, kanin |  |
| 3 | langit | **sakit** | puno, yelo |  |
| 3 | tinapay | **tatay** | kilo, ubas |  |
| 3 | kamatis | **atis** | daga, hapon | revised |
| 4 | plato | **bato** | saging, damit |  |
| 4 | prutas | **gatas** | ngiti, kandila |  |
| 4 | braso | **baso** | payong, malinis |  |
| 4 | prito | **kwento** | hangin, tinapay | revised |
| 4 | klase | **kotse** | gulong, salamat | revised |
| 4 | blusa | **prinsesa** | gulong, libro | revised |

### B. First-sound items (30)

| Level | Prompt (spoken) | Answer | Distractors | |
|---|---|---|---|---|
| 1 | mama | **mesa** | aso, baso |  |
| 1 | aso | **ama** | mesa, sisi |  |
| 1 | sabi | **sama** | bola, mata | revised |
| 1 | baso | **bibe** | mama, aso |  |
| 1 | ube | **ubo** | sabi, mesa |  |
| 1 | misa | **mata** | aso, bato |  |
| 1 | isa | **ina** | baso, tasa |  |
| 1 | iba | **isa** | mama, sala | revised |
| 2 | lata | **lobo** | bato, kuto |  |
| 2 | tasa | **tubo** | mesa, bola |  |
| 2 | kuto | **kilo** | daga, sabi |  |
| 2 | bola | **bato** | lata, tasa |  |
| 2 | gulay | **gatas** | nanay, tatay |  |
| 2 | nanay | **niyog** | gulay, bola |  |
| 2 | yelo | **yaya** | mata, kuto |  |
| 2 | mani | **manok** | tela, lobo |  |
| 3 | puso | **pera** | daga, wika |  |
| 3 | dila | **damo** | puno, hari |  |
| 3 | hari | **hita** | pusa, relo |  |
| 3 | wika | **watawat** | dila, puso |  |
| 3 | relo | **radyo** | hipon, pako |  |
| 3 | pusa | **pito** | damo, hilo |  |
| 3 | damit | **dagat** | hapon, pulot |  |
| 3 | hipon | **hilaw** | sipa, putik |  |
| 4 | ngiti | **ngipin** | saging, bola |  |
| 4 | saging | **sungay** | ngiti, payong |  |
| 4 | plato | **prutas** | bola, tasa |  |
| 4 | tren | **trapo** | klase, braso |  |
| 4 | krus | **klase** | tren, plato |  |
| 4 | bangka | **bangus** | ngiti, gulong |  |

### C. Probe non-words (26)

| Non-word | Syllables | Level | Marungko stage | One letter from a real practice word |
|---|---|---|---|---|
| bimo | bi-mo | 1 | 3 | — |
| mesu | me-su | 1 | 3 | ⚠ mesa |
| sobi | so-bi | 1 | 3 | ⚠ sabi |
| kelo | ke-lo | 1 | 4 | ⚠ kilo, yelo, relo |
| tebu | te-bu | 1 | 4 | — |
| gemi | ge-mi | 1 | 5 | — |
| riho | ri-ho | 1 | 6 | — |
| sabim | sa-bim | 2 | 3 | ⚠ sabi, sabit |
| besam | be-sam | 2 | 3 | — |
| misab | mi-sab | 2 | 3 | ⚠ misa |
| bosam | bo-sam | 2 | 3 | — |
| sebim | se-bim | 2 | 3 | — |
| sulek | su-lek | 2 | 4 | — |
| kitam | ki-tam | 2 | 4 | — |
| lakib | la-kib | 2 | 4 | — |
| taklo | tak-lo | 2 | 4 | ⚠ talo |
| yumal | yu-mal | 2 | 5 | — |
| kanit | ka-nit | 2 | 5 | ⚠ kanin |
| purad | pu-rad | 2 | 6 | — |
| hudam | hu-dam | 2 | 6 | — |
| pardik | par-dik | 2 | 6 | — |
| obisa | o-bi-sa | 3 | 3 | ⚠ bisa |
| tibalo | ti-ba-lo | 3 | 4 | — |
| batuke | ba-tu-ke | 3 | 4 | — |
| sadimo | sa-di-mo | 3 | 6 | — |
| gunayo | gu-na-yo | 3 | 5 | — |

### D. Spellings accepted as a correct reading (24 words)

| Word | Accepted as correct when the recogniser writes |
|---|---|
| krus | cross, kurs |
| dyip | deep, jeep, dip, dape, dyp |
| tsinelas | chinelas, sinelas, sinilas, sinalas |
| mangga | manga |
| bulaklak | bulaklaq, bulaklac |
| kotse | kotche, coche |
| radyo | radio |
| tren | train |
| plato | platto |
| bus | boss, bas |
| trak | truck |
| drama | trama |
| grado | grato |
| libro | libru |
| sobre | sobri |
| kwento | cuento, kuwento |
| kwaderno | cuaderno, kuwaderno |
| alkansya | alkansiya, alcancia |
| bisikleta | bicicleta |
| klase | clase |
| blusa | bluza |
| gitara | guitara, guitarra |
| prinsesa | princesa |
| problema | poblema |

### E. Words flagged for stress (8)

| Word | The two readings |
|---|---|
| bukas | búkas (tomorrow) / bukás (open) |
| tubo | túbo (pipe) / tubó (sugarcane; profit) |
| pito | píto (whistle) / pitó (seven) |
| puto | púto (rice cake) / putó (cut off) |
| buhay | búhay (life) / buháy (alive) |
| hapon | hápon (afternoon) / Hapón (Japanese) |
| basa | bása (read) / basâ (wet) |
| gabi | gabí (night) / gábi (taro) |

### F. The word bank (254 words)

Stage is derived from the letters, never typed by hand.

**Level 1 — 72 words**

| Word | Syllables | Pattern | Stage | Meaning |
|---|---|---|---|---|
| ama | a-ma | VCV | 1 | father |
| mama | ma-ma | CVCV | 1 | mom |
| masa | ma-sa | CVCV | 1 | dough |
| sama | sa-ma | CVCV | 1 | to join |
| asa | a-sa | VCV | 1 | to hope |
| aso | a-so | VCV | 2 | dog |
| oso | o-so | VCV | 2 | bear |
| isa | i-sa | VCV | 2 | one |
| misa | mi-sa | CVCV | 2 | mass (church) |
| sisi | si-si | CVCV | 2 | blame |
| amo | a-mo | VCV | 2 | boss |
| abo | a-bo | VCV | 3 | ash |
| ube | u-be | VCV | 3 | purple yam |
| ubo | u-bo | VCV | 3 | cough |
| iba | i-ba | VCV | 3 | other |
| baso | ba-so | CVCV | 3 | drinking glass |
| mesa | me-sa | CVCV | 3 | table |
| bibe | bi-be | CVCV | 3 | duckling |
| baba | ba-ba | CVCV | 3 | chin |
| sabi | sa-bi | CVCV | 3 | said |
| basa | ba-sa | CVCV | 3 | wet; to read |
| bisa | bi-sa | CVCV | 3 | effect |
| lata | la-ta | CVCV | 4 | tin can |
| bola | bo-la | CVCV | 4 | ball |
| tela | te-la | CVCV | 4 | cloth |
| bato | ba-to | CVCV | 4 | stone |
| tubo | tu-bo | CVCV | 4 | pipe; sugarcane |
| talo | ta-lo | CVCV | 4 | defeated |
| kuto | ku-to | CVCV | 4 | head louse |
| tasa | ta-sa | CVCV | 4 | cup |
| lobo | lo-bo | CVCV | 4 | balloon |
| buko | bu-ko | CVCV | 4 | young coconut |
| mata | ma-ta | CVCV | 4 | eye |
| bata | ba-ta | CVCV | 4 | child |
| sala | sa-la | CVCV | 4 | living room |
| tali | ta-li | CVCV | 4 | rope |
| bote | bo-te | CVCV | 4 | bottle |
| kuko | ku-ko | CVCV | 4 | fingernail |
| sulo | su-lo | CVCV | 4 | torch |
| tuko | tu-ko | CVCV | 4 | gecko |
| kilo | ki-lo | CVCV | 4 | kilo |
| lola | lo-la | CVCV | 4 | grandmother |
| lolo | lo-lo | CVCV | 4 | grandfather |
| ate | a-te | VCV | 4 | older sister |
| gabi | ga-bi | CVCV | 5 | night; taro |
| yelo | ye-lo | CVCV | 5 | ice |
| yaya | ya-ya | CVCV | 5 | nanny |
| mani | ma-ni | CVCV | 5 | peanut |
| ina | i-na | VCV | 5 | mother |
| tiya | ti-ya | CVCV | 5 | aunt |
| kuya | ku-ya | CVCV | 5 | older brother |
| yema | ye-ma | CVCV | 5 | egg yolk |
| puno | pu-no | CVCV | 6 | tree |
| pera | pe-ra | CVCV | 6 | money |
| pusa | pu-sa | CVCV | 6 | cat |
| puso | pu-so | CVCV | 6 | heart |
| dila | di-la | CVCV | 6 | tongue |
| daga | da-ga | CVCV | 6 | mouse |
| damo | da-mo | CVCV | 6 | grass |
| relo | re-lo | CVCV | 6 | watch |
| wika | wi-ka | CVCV | 6 | language |
| pito | pi-to | CVCV | 6 | whistle; seven |
| hita | hi-ta | CVCV | 6 | thigh |
| hari | ha-ri | CVCV | 6 | king |
| puto | pu-to | CVCV | 6 | rice cake |
| pako | pa-ko | CVCV | 6 | nail |
| sipa | si-pa | CVCV | 6 | kick |
| dito | di-to | CVCV | 6 | here |
| hilo | hi-lo | CVCV | 6 | dizzy |
| sapa | sa-pa | CVCV | 6 | creek |
| para | pa-ra | CVCV | 6 | for; stop |
| wala | wa-la | CVCV | 6 | none; nothing |

**Level 2 — 73 words**

| Word | Syllables | Pattern | Stage | Meaning |
|---|---|---|---|---|
| mas | mas | CVC | 1 | more |
| mais | ma-is | CVVC | 2 | corn |
| asim | a-sim | VCVC | 2 | sourness |
| ubas | u-bas | VCVC | 3 | grapes |
| bus | bus | CVC | 3 | bus |
| buo | bu-o | CVV | 3 | whole |
| bao | ba-o | CVV | 3 | coconut shell |
| sulat | su-lat | CVCVC | 4 | letter; to write |
| takot | ta-kot | CVCVC | 4 | fear |
| bukas | bu-kas | CVCVC | 4 | tomorrow; open |
| bakal | ba-kal | CVCVC | 4 | steel |
| lakas | la-kas | CVCVC | 4 | strength |
| sakit | sa-kit | CVCVC | 4 | pain |
| lamok | la-mok | CVCVC | 4 | mosquito |
| kamot | ka-mot | CVCVC | 4 | scratch |
| tulak | tu-lak | CVCVC | 4 | push |
| bilis | bi-lis | CVCVC | 4 | speed |
| kulot | ku-lot | CVCVC | 4 | curly |
| sabit | sa-bit | CVCVC | 4 | to hang |
| tikim | ti-kim | CVCVC | 4 | a taste |
| labas | la-bas | CVCVC | 4 | outside |
| loob | lo-ob | CVVC | 4 | inside |
| isip | i-sip | VCVC | 6 | mind |
| atis | a-tis | VCVC | 4 | sugar apple |
| nanay | na-nay | CVCVC | 5 | mother |
| tatay | ta-tay | CVCVC | 5 | father |
| gulay | gu-lay | CVCVC | 5 | vegetable |
| gatas | ga-tas | CVCVC | 5 | milk |
| bunso | bun-so | CVCCV | 5 | youngest child |
| niyog | ni-yog | CVCVC | 5 | coconut |
| bantay | ban-tay | CVCCVC | 5 | guard |
| itlog | it-log | VCCVC | 5 | egg |
| ulan | u-lan | VCVC | 5 | rain |
| ilog | i-log | VCVC | 5 | river |
| kanin | ka-nin | CVCVC | 5 | cooked rice |
| gamit | ga-mit | CVCVC | 5 | thing; to use |
| banig | ba-nig | CVCVC | 5 | sleeping mat |
| sinag | si-nag | CVCVC | 5 | ray of light |
| tinig | ti-nig | CVCVC | 5 | voice |
| manok | ma-nok | CVCVC | 5 | chicken |
| sanay | sa-nay | CVCVC | 5 | accustomed |
| yaman | ya-man | CVCVC | 5 | wealth |
| buntot | bun-tot | CVCCVC | 5 | tail |
| kanan | ka-nan | CVCVC | 5 | right side |
| damit | da-mit | CVCVC | 6 | clothes |
| dahon | da-hon | CVCVC | 6 | leaf |
| bahay | ba-hay | CVCVC | 6 | house |
| buhay | bu-hay | CVCVC | 6 | life |
| araw | a-raw | VCVC | 6 | sun; day |
| ilaw | i-law | VCVC | 6 | light |
| ulap | u-lap | VCVC | 6 | cloud |
| hipon | hi-pon | CVCVC | 6 | shrimp |
| hilaw | hi-law | CVCVC | 6 | unripe |
| isda | is-da | VCCV | 6 | fish |
| pinto | pin-to | CVCCV | 6 | door |
| radyo | rad-yo | CVCCV | 7 | radio |
| hardin | har-din | CVCCVC | 6 | garden |
| sampay | sam-pay | CVCCVC | 6 | hung laundry |
| lapis | la-pis | CVCVC | 6 | pencil |
| palad | pa-lad | CVCVC | 6 | palm of the hand |
| dagat | da-gat | CVCVC | 6 | sea |
| hapon | ha-pon | CVCVC | 6 | afternoon |
| putik | pu-tik | CVCVC | 6 | mud |
| silid | si-lid | CVCVC | 6 | room |
| sabaw | sa-baw | CVCVC | 6 | soup |
| kahoy | ka-hoy | CVCVC | 6 | wood |
| sipon | si-pon | CVCVC | 6 | runny nose |
| bakod | ba-kod | CVCVC | 6 | fence |
| pusod | pu-sod | CVCVC | 6 | navel |
| dilaw | di-law | CVCVC | 6 | yellow |
| pulot | pu-lot | CVCVC | 6 | honey |
| duyan | du-yan | CVCVC | 6 | hammock |
| paa | pa-a | CVV | 6 | foot |

**Level 3 — 54 words**

| Word | Syllables | Pattern | Stage | Meaning |
|---|---|---|---|---|
| bumasa | bu-ma-sa | CVCVCV | 3 | to read |
| babae | ba-ba-e | CVCVV | 3 | woman |
| salamat | sa-la-mat | CVCVCVC | 4 | thank you |
| kamatis | ka-ma-tis | CVCVCVC | 4 | tomato |
| makulit | ma-ku-lit | CVCVCVC | 4 | persistent |
| kulambo | ku-lam-bo | CVCVCCV | 4 | mosquito net |
| matamis | ma-ta-mis | CVCVCVC | 4 | sweet |
| mabilis | ma-bi-lis | CVCVCVC | 4 | fast |
| bumili | bu-mi-li | CVCVCV | 4 | to buy |
| tumakbo | tu-mak-bo | CVCVCCV | 4 | ran |
| malakas | ma-la-kas | CVCVCVC | 4 | strong |
| masakit | ma-sa-kit | CVCVCVC | 4 | painful |
| salamin | sa-la-min | CVCVCVC | 5 | mirror; eyeglasses |
| nilaga | ni-la-ga | CVCVCV | 5 | boiled dish |
| malinis | ma-li-nis | CVCVCVC | 5 | clean |
| maligo | ma-li-go | CVCVCV | 5 | to bathe |
| binata | bi-na-ta | CVCVCV | 5 | young man |
| malamig | ma-la-mig | CVCVCVC | 5 | cold |
| watawat | wa-ta-wat | CVCVCVC | 6 | flag |
| tinapay | ti-na-pay | CVCVCVC | 6 | bread |
| kandila | kan-di-la | CVCCVCV | 6 | candle |
| diwata | di-wa-ta | CVCVCV | 6 | fairy |
| payaso | pa-ya-so | CVCVCV | 6 | clown |
| sapatos | sa-pa-tos | CVCVCVC | 6 | shoes |
| mapula | ma-pu-la | CVCVCV | 6 | red |
| malapit | ma-la-pit | CVCVCVC | 6 | near |
| bituin | bi-tu-in | CVCVVC | 5 | star |
| paniki | pa-ni-ki | CVCVCV | 6 | bat |
| tahimik | ta-hi-mik | CVCVCVC | 6 | quiet |
| malusog | ma-lu-sog | CVCVCVC | 5 | healthy |
| mabuhay | ma-bu-hay | CVCVCVC | 6 | long live |
| damdamin | dam-da-min | CVCCVCVC | 6 | feeling |
| ngipin | ngi-pin | CVCVC(ng) | 7 | tooth |
| ngiti | ngi-ti | CVCV(ng) | 7 | smile |
| ngayon | nga-yon | CVCVC(ng) | 7 | now; today |
| saging | sa-ging | CVCVC(ng) | 7 | banana |
| payong | pa-yong | CVCVC(ng) | 7 | umbrella |
| gunting | gun-ting | CVCCVC(ng) | 7 | scissors |
| mangga | mang-ga | CVCCV(ng) | 7 | mango |
| bangka | bang-ka | CVCCV(ng) | 7 | boat |
| bangus | ba-ngus | CVCVC(ng) | 7 | milkfish |
| tulong | tu-long | CVCVC(ng) | 7 | help |
| gulong | gu-long | CVCVC(ng) | 7 | wheel |
| hangin | ha-ngin | CVCVC(ng) | 7 | wind |
| langit | la-ngit | CVCVC(ng) | 7 | sky |
| singsing | sing-sing | CVCCVC(ng) | 7 | ring |
| lungsod | lung-sod | CVCCVC(ng) | 7 | city |
| sungay | su-ngay | CVCVC(ng) | 7 | horn |
| bunga | bu-nga | CVCV(ng) | 7 | fruit |
| bango | ba-ngo | CVCV(ng) | 7 | scent |
| linggo | ling-go | CVCCV(ng) | 7 | week; Sunday |
| sinigang | si-ni-gang | CVCVCVC(ng) | 7 | sour soup |
| kotse | kot-se | CVCCV | 7 | car |
| tunog | tu-nog | CVCVC | 5 | sound |

**Level 4 — 30 words**

| Word | Syllables | Pattern | Stage | Meaning |
|---|---|---|---|---|
| aklat | ak-lat | VCCVC | 4 | book |
| bulaklak | bu-lak-lak | CVCVCCVC | 4 | flower |
| klase | kla-se | CCVCV | 4 | class |
| blusa | blu-sa | CCVCV | 4 | blouse |
| plato | pla-to | CCVCV | 6 | plate |
| braso | bra-so | CCVCV | 6 | arm |
| prito | pri-to | CCVCV | 6 | fried |
| tren | tren | CCVC | 6 | train |
| trak | trak | CCVC | 6 | truck |
| krus | krus | CCVC | 6 | cross |
| prutas | pru-tas | CCVCVC | 6 | fruit |
| trapo | tra-po | CCVCV | 6 | rag |
| plano | pla-no | CCVCV | 6 | plan |
| drama | dra-ma | CCVCV | 6 | drama |
| grado | gra-do | CCVCV | 6 | grade |
| trabaho | tra-ba-ho | CCVCVCV | 6 | work |
| prinsesa | prin-se-sa | CCVCCVCV | 6 | princess |
| problema | prob-le-ma | CCVCCVCV | 6 | problem |
| libro | lib-ro | CVCCCV | 6 | book |
| sobre | sob-re | CVCCCV | 6 | envelope |
| tainga | ta-i-nga | CVVCV(ng) | 7 | ear |
| pinggan | ping-gan | CVCCVC(ng) | 7 | dish |
| singkamas | sing-ka-mas | CVCCVCVC(ng) | 7 | jicama |
| pangalan | pa-nga-lan | CVCVCVC(ng) | 7 | name |
| pangako | pa-nga-ko | CVCVCV(ng) | 7 | promise |
| pangarap | pa-nga-rap | CVCVCVC(ng) | 7 | dream |
| tanghali | tang-ha-li | CVCCVCV(ng) | 7 | noon |
| dyip | dyip | CCVC | 7 | jeepney |
| gitara | gi-ta-ra | CVCVCV | 6 | guitar |
| kwento | kwen-to | CCVCCV | 6 | story |

**Level 5 — 25 words**

| Word | Syllables | Pattern | Stage | Meaning |
|---|---|---|---|---|
| kalabasa | ka-la-ba-sa | CVCVCVCV | 4 | squash |
| paaralan | pa-a-ra-lan | CVVCVCVC | 6 | school |
| mahalaga | ma-ha-la-ga | CVCVCVCV | 6 | important |
| karagatan | ka-ra-ga-tan | CVCVCVCVC | 6 | ocean |
| kaibigan | ka-i-bi-gan | CVVCVCVC | 5 | friend |
| matalino | ma-ta-li-no | CVCVCVCV | 5 | intelligent |
| kalayaan | ka-la-ya-an | CVCVCVVC | 5 | freedom |
| kasaysayan | ka-say-sa-yan | CVCVCCVCVC | 5 | history |
| paruparo | pa-ru-pa-ro | CVCVCVCV | 6 | butterfly |
| kalapati | ka-la-pa-ti | CVCVCVCV | 6 | dove |
| pamilihan | pa-mi-li-han | CVCVCVCVC | 6 | market |
| maliwanag | ma-li-wa-nag | CVCVCVCVC | 6 | bright |
| kababayan | ka-ba-ba-yan | CVCVCVCVC | 5 | countryman |
| kalusugan | ka-lu-su-gan | CVCVCVCVC | 5 | health |
| himpapawid | him-pa-pa-wid | CVCCVCVCVC | 6 | sky |
| talahiban | ta-la-hi-ban | CVCVCVCVC | 6 | grassland |
| kasiyahan | ka-si-ya-han | CVCVCVCVC | 6 | celebration |
| karunungan | ka-ru-nu-ngan | CVCVCVCVC(ng) | 7 | knowledge |
| pangungusap | pa-ngu-ngu-sap | CVCVCVCVC(ng) | 7 | sentence |
| tsinelas | tsi-ne-las | CCVCVCVC | 7 | slippers |
| kwaderno | kwa-der-no | CCVCVCCV | 6 | notebook |
| bisikleta | bi-sik-le-ta | CVCVCCVCV | 4 | bicycle |
| alkansya | al-kan-sya | VCCVCCCV | 7 | coin bank |
| kapatid | ka-pa-tid | CVCVCVC | 6 | sibling |
| magulang | ma-gu-lang | CVCVCVC(ng) | 7 | parent |

