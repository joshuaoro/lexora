# LEXORA — Operating Manual

Everything needed to run the application: what each screen does, how to demonstrate
it to a panel and to reading specialists, and how to operate it during real data
gathering with children.

Written for the person who built it. It assumes you know what the study is; it does
not assume you remember which button does what three weeks from now.

- [1. Orientation](#1-orientation)
- [2. Accounts and signing in](#2-accounts-and-signing-in)
- [3. Where it runs](#3-where-it-runs)
- [4. The learner side](#4-the-learner-side-what-a-child-sees)
- [5. The specialist side](#5-the-specialist-side)
- [6. Demonstrating it](#6-demonstrating-it--panel-and-specialists)
- [7. Real data gathering](#7-real-data-gathering)
- [8. Troubleshooting](#8-troubleshooting)
- [9. Data safety](#9-data-safety)
- [10. Command reference](#10-command-reference)

---

## 1. Orientation

LEXORA does two things, and deliberately nothing else:

1. **A child practises word-level reading** — phonological awareness and single-word
   decoding, in Filipino, sequenced by the Marungko Approach.
2. **A reading specialist watches what happened** — accuracy, decoding speed, error
   patterns, and their own verdict on recordings the child made.

Everything else in the app exists to keep those two honest. Connected text, fluency
(WCPM), spelling and comprehension are **out of scope by design**, not missing.

**The one-sentence version for a panel:** *the child reads a word aloud, a pre-trained
Whisper model transcribes it, the app scores the transcript against the target, and a
reading specialist can confirm or dispute every one of those verdicts — which is what
lets the study report agreement rather than assert accuracy.*

### Two roles

| Role | Sees | Cannot |
|---|---|---|
| **Learner** | Own dashboard, exercises, reader, own report, own settings | See any other learner, or any specialist screen |
| **Specialist** | Every learner, cohort view, calibration, word bank, all exports | — |

---

## 2. Accounts and signing in

### Current demo accounts

All three share one password. **These are published in the repository's git history**,
so they are for demonstration only and must be rotated before a real child is enrolled
(§7.1).

| Email | Password | Role | State |
|---|---|---|---|
| `specialist@lexora.ph` | `lexora123` | Specialist — "Teacher Maria Santos" | Reviews everything |
| `learner1@lexora.ph` | `lexora123` | Learner — "Juan" | **Level 4, stage 6, 135 readings, 23 sessions** — the account with history |
| `learner2@lexora.ph` | `lexora123` | Learner — "Ana" | Level 1, stage 1, 68 readings, 19 sessions |

> **After you rotate** (§7.1) these passwords change. Do not write the new ones into
> this file or any other file in the repository — that is how the current ones became
> public. Password manager only.

### Registering a new account

- **A learner** can be registered by anyone at `/register`.
- **A specialist** additionally needs the access code (`SPECIALIST_CODE`). Without it,
  specialist registration is refused. This is the single most important credential in
  the system: anyone holding it can create a specialist account and read every child's
  records and recordings.

### Signing in

`/login`. Sessions last **7 days**, stored in an httpOnly cookie. Signing out is a
button in the sidebar (or the top bar on a tablet).

---

## 3. Where it runs

**Live:** https://lexora-snowy-six.vercel.app

**Locally:**

```bash
npm install
npm run build
npm start          # http://localhost:3000
```

Local and live **share the same database**. A change made in one appears in the other.
This matters more than it sounds — see §9.

For development with hot reload use `npm run dev`, but demo from `npm start`: the dev
build is slower and shows overlays a panel will ask about.

---

## 4. The learner side (what a child sees)

Navigation is a sidebar on desktop and a slide-out drawer on tablet/phone. Every screen
has an **EN / FIL** toggle. Reading content is always Filipino regardless.

### Dashboard `/dashboard`

The child's own summary, written for a seven-year-old rather than a researcher:
accuracy, words read in the last fortnight, minutes practised, activities completed,
and a **practice streak** in days ("four days in a row" is something a child can act
on; a percentage is not). A speaker button reads the greeting aloud.

### Exercises `/exercises`

Seven activities. Each draws **8 items** per run, matched to the learner's level and
Marungko stage.

| Activity | Slug | What the child does |
|---|---|---|
| **Read aloud** | `read-aloud` | Sees a word, presses the mic, reads it. **This is the one that records audio and produces the scored data.** |
| **Listen & choose** | `listen-choose` | Hears a word, picks it from look-alike options |
| **Count the syllables** | `syllables` | Taps how many *pantig* a word has |
| **Rhyme time** | `rhyme` | Picks the word that rhymes |
| **First sound** | `first-sound` | Picks the word starting with the same sound |
| **Practice list** | (via `/practice`) | Their own previously-misread words |
| **Silly words** | `silly-words` | **The decoding probe.** Made-up words. Assessment only |

**How Read aloud works, step by step** — worth knowing precisely because it is what you
will demonstrate:

1. The word appears large, in the child's chosen font and spacing.
2. **Listen to this** plays a Filipino neural recording of the word (whole word, or
   syllable by syllable).
3. The child presses the microphone and reads.
4. Recording stops automatically after ~1.2 s of silence *following speech*, or 7 s
   maximum, or when the mic is tapped again.
5. The audio goes to the server, Whisper transcribes it, the app scores the transcript
   against the target and shows immediate feedback.
6. **If wrong:** the correct pronunciation plays, then **"Now you try it!"** invites a
   second reading — so the last time the child says a word they missed, they say it
   right. That re-read is recorded as a *retry* and is **excluded from every statistic**
   (it measures repetition, not decoding).

**Silly words is different and the difference is the point.** No audio is ever played,
no verdict is shown to the child, it never affects their level, and none of it enters
the practice list. A specialist scores it later by ear. It rests for **7 days** after a
run.

### Practice list `/practice`

Words the child previously misread. Two correct readings in a row master a word and
retire it from the list. A specialist can also pin words here manually.

### Reader `/reader`

A text display with all the accessibility settings applied, word-by-word
text-to-speech, and synchronised highlighting. Tap any word to hear it alone. **Nothing
here is scored** — reader time counts toward "minutes practised" but produces no
accuracy figure.

### Reports `/reports`

The child's own progress: accuracy over time, accuracy by difficulty level, by Marungko
stage, by syllable pattern, error-type breakdown, and **typical time per correct word**.
Printable.

### Settings `/settings`

Per-learner display customisation, saved to their profile:

| Setting | Options | Default |
|---|---|---|
| Font | Lexend, Atkinson Hyperlegible, Comic Neue, System | Lexend |
| Text size | slider | 32 px |
| Letter spacing | slider | 0.08 em |
| Word spacing | slider | 0.25 em |
| Line height | slider | 2.0 |
| Colour overlay | none, cream, yellow, blue, green, pink | none |
| Focus ruler | on / off | off |
| Speech rate | 0.5 – 1.2 | 0.85 |

Also here: **Check this device** → `/diagnostics`.

### Diagnostics `/diagnostics`

Run this on **every tablet before its first session**. It checks microphone permission,
recording format support, whether a spoken instruction can be fetched and played, and
then **records three seconds of real audio and scores it end to end** — the only honest
way to know the whole chain works on that device.

Rows marked *offline fallback only* describe what the app would do without a server. A
tablet with no Filipino voice of its own is **normal** and not a problem: the app plays
its own recordings.

---

## 5. The specialist side

### Specialist dashboard `/specialist`

Every learner, with accuracy, sessions and agreement at a glance. Links to the cohort
view, threshold calibration, and the three CSV exports.

> **Demo accounts are hidden here by default.** See §6.1 — this is the single most
> common way a demonstration goes wrong.

### Learner detail `/specialist/learner/<id>`

The main working screen. Panels, top to bottom:

1. **Full report** — everything the learner sees in their own report, plus specialist
   detail.
2. **Learner controls** — override the adaptive level (1–5) manually.
3. **Study timeline** — tag each session `BASELINE`, `REGULAR` or `ENDLINE`. **Tagging
   is what makes pre/post comparison possible.** It is retroactive: you can tag sessions
   after the fact.
4. **Scoring reliability check (Review list)** — the core research instrument. Covered
   below.
5. **Self-correction** — the retry pairs, kept apart from accuracy.
6. **Decoding vs recall (Divergence)** — real-word accuracy beside non-word accuracy.
7. **Baseline → endline (Phase comparison)** — whether the child improved.
8. **Borderline readings (Threshold calibration)** — readings that scored just below the
   acceptance line, with audio, so you can hear whether the line is set right.
9. **IEP draft** — plain text for pasting into a DepEd IEP.
10. **Data controls** — clear recordings, or erase the participant entirely.

### The review list — how to score a reading

This is the instrument the study's Objective 2 rests on, so the procedure matters.

1. A row shows the **target word** and a **play button**. The system's transcript, its
   verdict, and the similarity score are **not shown** — they are absent from the page,
   not merely hidden.
2. **Play the recording. Listen.**
3. Answer the question asked: **did the learner read this correctly?** — *Correct* or
   *Not correct*.
4. Only then does the system's reading appear, so you can see whether it agreed.
5. Optionally, chips appear: **"What did you observe?"** — vowel, first sound, last
   sound, digraph, cluster, syllable dropped, syllable added, **stress**, self-corrected,
   could not tell. Leaving them blank is fine and honest.

**Why blind by default:** if you see the machine's answer first, your judgement is no
longer independent of the thing it is measuring, and the agreement percentage, Cohen's κ
and the fitted threshold all inherit that. The mode is displayed at all times, and
leaving it takes a deliberate press of *"Switch to quick review"*.

**Stress:** Filipino does not write it, so *búkas* and *bukás* reach the scorer as the
same letters. Six bank words carry a caveat telling you to judge by ear. The `stress`
chip is the only instrument the study has for it.

### Cohort overview `/specialist/cohort`

All learners side by side, plus accuracy per syllable-pattern family across the group.

### Threshold calibration `/specialist/calibration`

The acceptance threshold (0.95) swept from 0.50 to 1.00 against every specialist verdict,
reporting accuracy, sensitivity, specificity, precision, **Cohen's κ**, **MCC** and
**Youden's J**, with a plateau and a bootstrap interval.

**It recommends; it never changes the threshold.** Changing it mid-study would mean the
baseline and endline were scored by different rules.

### Word bank `/specialist/words`

- **🔊 / ba·hay** — hear exactly what learners hear
- **🎤 Record** — record a word in your own voice, preview, then keep or discard
- **🗑 Remove** — restores the synthesized voice instantly
- **✨ Generate** — synthesize audio for a word that has none
- **Add word** — extend the bank
- **Accepted spellings** — add ASR spellings that are legitimately correct (`krus` →
  "cross")
- **Suggest probe words** — generates candidate non-words for you to screen. **You must
  approve each one**, because a generator does not know Cebuano and Davao children do.

---

## 6. Demonstrating it — panel and specialists

### 6.1 Pre-flight checklist — do this the day before

**① Turn on the demo accounts, or your specialist screens will be empty.**

The demo learners are flagged `isDemo` and **excluded from every aggregate by default** —
that quarantine exists so fabricated seed data can never be mistaken for a finding. It
also means that, out of the box, your specialist dashboard shows *no learners*.

- Add **`?demo=1`** to the URL: `/specialist?demo=1`, `/specialist/cohort?demo=1`
- Or use the **Show demo accounts** toggle on the page

Do this once before the demo and confirm you can see Juan and Ana.

**② Know which panels will say "not enough data", and decide what you want.**

Current state of the database:

| Panel | Needs | Has now | Shows |
|---|---|---|---|
| Review list | any recordings | **42 recordings** | ✅ works |
| Reports / charts | a few readings | 135 + 68 readings | ✅ works |
| Divergence | 10 real + 8 probe reviews | 4 real + 8 probe | ❌ empty |
| Calibration | 30 reviewed readings | 12 reviews | ❌ empty |
| Phase comparison | 10 readings each in BASELINE and ENDLINE | 0 BASELINE | ❌ empty |

**You have two honest options, and the first is genuinely the stronger demo:**

- **Present the empty states as the feature they are.** "The app refuses to draw this
  chart because it does not have enough data to draw it honestly, and it tells you
  exactly how much more it needs." For a research panel that is a better moment than a
  populated chart — it shows the instrument knows its own limits. Every panel names its
  minimum on screen.
- **Or populate them beforehand**, which takes about twenty minutes:
  - **Divergence** — review **6 more real-word readings** on Juan's page.
  - **Phase comparison** — in *Study timeline*, tag ~10 of Juan's early sessions
    `BASELINE` and ~10 recent ones `ENDLINE`.
  - **Calibration** — review **18 more readings** (30 total). This is the slowest one.

**③ Check the room's equipment.** Open `/diagnostics` on the actual laptop or tablet you
will present from and run it to the end. Microphone permission is the usual failure, and
it fails silently until you try.

**④ Confirm Silly words is not on cooldown.** Both demo learners are currently clear —
Juan has never run the probe, and Ana's last run has aged past the 7-day window. If you
run a probe while rehearsing, that learner is locked out for a week; **rehearse the probe
on Ana and demo it on Juan.**

**⑤ Have the live URL and a local instance ready.** If the venue's wifi fails, `npm start`
on your laptop still works — but note it uses the same database, so anything you do
locally is real.

### 6.2 A 15-minute demonstration script

**Minutes 0–2 — The problem, on the login page**

Open the live URL. Say what the study is: five children with dyslexia at The Reading Owl,
word-level reading only, Filipino, Marungko.

**Minutes 2–7 — Be the child** *(sign in as `learner1@lexora.ph`)*

1. **Dashboard** — press the speaker. Point out it speaks to the child first, because
   the users cannot reliably read the interface.
2. **Settings** — change the font to Atkinson, raise the letter spacing, switch the
   overlay to cream. Show it applying live. Mention the focus ruler is pointer-driven so
   it works with touch and stylus, not just a mouse.
3. **Exercises → Read aloud** — the money shot.
   - Press **Listen to this** — *"almost no device has a Filipino voice, so the app
     ships its own; a browser reading Tagalog produces something a child cannot follow."*
   - Press the mic and **read the word correctly.** Show the feedback.
   - Press the mic and **read the next word wrong on purpose.** Show the correction, then
     the **"Now you try it!"** re-read. Say plainly: *this re-read is recorded but
     excluded from every statistic, because the child has just been told the answer.*
4. **Exercises → Silly words** — run two or three items. *"These are made-up words. A real
   word can be read from memory; a word that has never existed can only be decoded. This
   is how the study tells 'learned to read' apart from 'learned these 254 words'. The
   child is shown no verdict, and a specialist scores it by ear afterwards."*

**Minutes 7–13 — Be the specialist** *(sign out, sign in as `specialist@lexora.ph`, add `?demo=1`)*

5. **Dashboard → Juan** — walk the report: accuracy, **and typical time per word beside
   it**. Explain why: *Filipino is a transparent orthography, and in transparent
   orthographies dyslexia shows up as slow reading more reliably than as inaccurate
   reading. A child can sit at 90% and still be sounding out every word.*
6. **Scoring reliability check** — the centrepiece. Play the reading you just recorded.
   Note that the system's answer is not on screen. Give your verdict, *then* show the
   reveal. Explain: *if I saw the machine's answer first, my judgement would not be
   independent of the thing it is measuring — and every agreement figure in the study
   rests on these labels.*
7. **Add an observation chip** — pick `stress` and explain that Filipino does not write
   stress, so the app is structurally blind to it and a specialist's ear is the only
   instrument the study has.
8. **Threshold calibration** — even empty, this is worth showing. *"This is what the study
   adapts. The acoustic model is pre-trained and never fine-tuned — with five children
   there is no held-out set, so fine-tuning and then testing on the same five would be
   training on the test set. What is fitted is the decision layer: the similarity at
   which a transcript counts as correct, fitted to the specialists' own verdicts. And it
   refuses to recommend anything below 30 labelled readings."*

**Minutes 13–15 — Close on the data**

9. **Download the attempts CSV.** Open it. Point at `is_retry` and `study_phase` and say
   these must be handled before computing anything.
10. **IEP draft** — show that suggestions sit under *"Points to consider (data-derived
    prompts — for the teacher's professional judgement)"* and that the app never writes
    "recommended intervention", because it states it does not diagnose.

### 6.3 Demonstrating to the reading specialists

Different audience, different emphasis. They are going to *use* this, and they are
scoring it under ISO/IEC 25010, so let them drive.

Spend the time on:

1. **The review workflow**, hands-on. Have them score five recordings themselves. This
   is what they will do most.
2. **Why blind review**, briefly — then let them try *"Switch to quick review"* so they
   feel the difference.
3. **The observation chips** — walk the vocabulary. Ask whether the categories match what
   they actually hear; that is real feedback worth writing down.
4. **The word bank** — show them **🎤 Record**, because a specialist's own voice takes
   priority over the synthesized clip. This is usually the feature they most want.
5. **Study timeline tagging** — show it and explain that a baseline nobody tagged cannot
   be recovered later.
6. **Language toggle** — switch the whole workspace to Filipino.

Have them do it on a real tablet, not your laptop. Interaction Capability is one of the
characteristics they are scoring.

---

## 7. Real data gathering

### 7.1 Before the first child — non-negotiable

The demo credentials are published in this repository's public git history. Until these
are done, the study database is one search away from anybody.

```bash
# 1. Disable the Supabase Data API
#    Dashboard → Settings → Data API → off.
#    Verify (expect a connection failure or 404, NOT "401 No API key found"):
curl -s -o /dev/null -w "%{http_code}\n" https://<your-ref>.supabase.co/rest/v1/

# 2. Rotate the specialist access code
#    Vercel → Settings → Environment Variables → SPECIALIST_CODE → redeploy.
#    Highest severity: it lets anyone create a specialist account.

# 3. Rotate the specialist password
npm run password:set -- specialist@lexora.ph --generate
#    Then put the printed value in AUDIT_SPECIALIST_PASSWORD in .env,
#    or all ten audit suites will fail at their opening sign-in.

# 4. Re-credential the demo learners
npm run password:set -- learner1@lexora.ph --generate --random
npm run password:set -- learner2@lexora.ph --generate --random

# 5. Confirm it all took effect
npm run secrets:check          # must report 0 failures
npm run audit                  # 417 checks
```

**Store the new values in a password manager. Never in a file in this repository** —
that is exactly how the current ones became public.

**Note:** changing a password does **not** sign anyone out. Sessions are stateless JWTs
valid for 7 days; anyone already signed in stays signed in until it expires. This is
expected. To end every session at once, rotate `AUTH_SECRET` in Vercel and redeploy.

### 7.2 Enrolling the five participants

1. Register each child at `/register` as a **learner**, with their own account. **Do not
   use `learner1` / `learner2`** — those are demo accounts and are excluded from every
   aggregate figure by design, so real data in them would be invisible to the cohort
   view, calibration, divergence and phase comparison.
2. Use a name the specialists recognise but that is not more identifying than the consent
   allows. First name or an initial is usually right.
3. Set each password with `npm run password:set -- <email> --generate`, and keep the list
   somewhere the specialists can reach and nobody else can.
4. On the specialist page, set each child's **starting level and Marungko stage** to match
   the specialist's judgement, rather than letting them all begin at 1.
5. Run `/diagnostics` on every tablet that will be used.
6. **Take a backup** before the first session: `npm run backup`.

### 7.3 The baseline — the one that cannot be recovered

**Do this first, and tag it immediately.**

1. Each child completes a Read aloud run (8 words) and, if the specialist agrees, a
   Silly words run (8 non-words).
2. **Immediately afterwards**, on each learner page → **Study timeline**, tag those
   sessions **`BASELINE`**.

A baseline you forgot to tag cannot be reconstructed afterwards except by guessing from
timestamps, which is exactly what the tagging exists to avoid. The pre/post comparison —
the thing the whole study turns on — can only use sessions someone marked.

### 7.4 Each session

**Before**

- Confirm the tablet is charged and on wifi.
- `/diagnostics` if it is a tablet you have not used before.

**During**

- The child signs in as themselves.
- Read aloud is the activity that produces scored data. The others support it.
- Leaving an activity partway is fine — the words already read are saved, and the app
  says so.
- A dropped connection is handled: the child is told plainly and can resume.

**After**

- Sessions default to `REGULAR`. Leave them unless this is a baseline or endline run.
- `npm run backup` — before and after every testing session. Reading data from children
  cannot be gathered again.

### 7.5 Weekly, by the specialist

1. **Review recordings.** This is the study's main instrument, not an optional extra.
   Review **blind** — do not switch to quick review unless you have a reason, and note it
   if you do.
2. Aim for **30 reviewed readings across the cohort** as early as you can; that is the
   threshold at which the calibration page starts recommending an operating point.
3. **Add observation chips** where you are confident. Coverage is reported alongside every
   distribution, so partial tagging is honest — but more coverage makes the error profile
   worth more.
4. Run **Silly words once per child per phase**. It rests 7 days between runs.
5. Check the **Divergence** panel once each child has 10 reviewed real words and 8
   reviewed probe words. A gap of 25+ points in favour of real words suggests the child is
   recognising the bank rather than decoding it — which calls for a different
   intervention, and is worth acting on during the study rather than discovering at the
   end.

### 7.6 The endline

1. Mirror the baseline: a Read aloud run and a Silly words run per child.
2. **Tag those sessions `ENDLINE` immediately.**
3. Review the endline recordings, blind, as usual.
4. Open **Baseline → endline** on each learner page and on the cohort page.

**Read the probe row first.** Real-word accuracy rising over eight weeks is ambiguous —
the child may have learned to decode, or learned those 254 words. Non-word accuracy
rising is not ambiguous, because a made-up word cannot have been memorised. That row is
the closest this study comes to asking its own question directly.

The panel reports **descriptives only, deliberately**. Whether a change is
distinguishable from chance is a question for your statistical analysis, using the
exported data and a test chosen for the design — five participants cannot support a
p-value computed in a web page.

### 7.7 Exporting for analysis

From the specialist dashboard, or directly:

| Export | URL | One row per |
|---|---|---|
| Summary | `/api/export?what=summary` | learner |
| All attempts | `/api/export?what=attempts` | word reading |
| All sessions | `/api/export?what=sessions` | activity |
| Calibration | `/api/export?what=calibration` | candidate threshold |
| Agreement by condition | `/api/export?what=agreement-conditions` | blind / anchored |
| Phase comparison | `/api/export?what=phase-comparison` | phase |
| IEP draft | `/api/export?what=iep&learnerId=…` | (plain text) |

All are UTF-8 with BOM, so they open cleanly in Excel and SPSS.

**Two columns to handle before computing anything:**

- **`is_retry = 1`** — a second reading taken after the correct pronunciation was played.
  **Filter these out.** Every figure inside the app already does. They are reported
  separately as `retries` / `retry_success_pct`.
- **`study_phase`** — `BASELINE`, `REGULAR` or `ENDLINE`. This is your pre/post split.

Demo accounts are excluded from every export by default. Add `&includeDemo=true` only if
you deliberately want them, and never for analysis.

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| **Specialist dashboard shows no learners** | Demo accounts are quarantined by default | Add `?demo=1`, or enrol real learners |
| **"Not enough data" on calibration / divergence / phases** | Below the stated minimum — working as intended | The panel says how many more are needed |
| **Silly words is greyed out** | 7-day cooldown after a run | The screen shows the date it becomes available |
| **Mic does nothing** | Permission not granted, or the page is not on HTTPS/localhost | `/diagnostics`; grant permission in the browser |
| **A correct reading marked wrong** | ASR returned an alternative spelling | Word bank → **Accepted spellings** → add it. Compared exactly, so it cannot mask a real error |
| **"We couldn't hear that clearly"** | Neither engine could transcribe | The attempt is deliberately **not saved**. Try again |
| **Session shows 0/8 on Silly words** | Correct — probe sessions are scored by a specialist afterwards | Displays as "8 read" |
| **All ten audit suites fail at sign-in** | Specialist password rotated without setting `AUDIT_SPECIALIST_PASSWORD` | Set it in `.env` |
| **Child stays signed in after a password change** | Sessions are stateless JWTs, valid 7 days | Expected. Rotate `AUTH_SECRET` to force everyone out |
| **A tablet has no Filipino voice** | Normal | The app plays its own recordings |

---

## 9. Data safety

**Supabase's free tier takes no automatic backups**, and reading data collected from
children cannot be gathered again.

```bash
npm run backup                                   # before and after every session
npx tsx scripts/restore.ts <file> --verify       # rehearse the restore, rolled back
npx tsx scripts/restore.ts <file> --dry-run      # compare row counts only
```

Run `--verify` after each backup. It performs the entire restore inside a transaction,
checks every row count, then rolls back — proving the file is genuinely restorable
without touching live data. **An untested backup is not a backup.**

`.\scripts\schedule-backup.ps1` registers a daily Windows task that survives the laptop
being closed.

**Three things that will lose data. Read these once.**

1. **Never accept Prisma's "reset database" prompt.** Use `npx prisma migrate deploy`,
   never `migrate dev`.
2. **Never run `npx prisma db seed` against the study database.** Seeding **wipes every
   table first**. Use `npm run words:sync` to apply word-bank changes to a database that
   already holds study data.
3. **Local and live share one database.** Anything you do on `localhost:3000` is real.

**Erasing a participant** (a family withdrawing) is on the learner page and cascades —
every reading, recording and verdict goes. It requires typing the learner's name to
confirm. It cannot be undone except from a backup.

**Recordings delete themselves** after 180 days (`RECORDING_RETENTION_DAYS`). Only the
audio goes; transcripts, scores, error types and reviews survive, so **no reported figure
changes**. `/privacy` states whatever window is configured.

---

## 10. Command reference

```bash
# Running
npm run dev                    # development, hot reload
npm run build && npm start     # production build — demo from this

# Study operations
npm run backup                 # before and after every session
npm run password:set -- <email> --generate
npm run secrets:check          # published credentials are refused
npm run words:sync             # word-bank changes onto a live database
npm run words:check            # validate both banks
npm run words:rotation         # confirm exercises are not repeating words

# Audio
npm run audio:generate         # fill in missing word clips
npm run audio:instructions     # warm the spoken instruction lines

# Verification
npm run audit                  # all 10 suites, 417 checks
npm run audit -- <url>         # against the deployment
npm run audit:a11y             # WCAG 2.1 AA
npm run calibration:check      # κ / MCC against hand-computed values

# Database
npx prisma migrate deploy      # apply migrations — NEVER migrate dev
```

### Related documents

| Document | Covers |
|---|---|
| [`README.md`](../README.md) | Setup, deployment, technical reference |
| [`docs/development-record.md`](development-record.md) | Why every design decision was made — for the Methodology and Validation chapters |
| [`docs/deferred-ideas.md`](deferred-ideas.md) | What was deliberately not built — for Future Work |
