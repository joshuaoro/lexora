# Participant Intake Sheet and Session Field Log

Two small forms that nothing in the application can produce, and that Chapter 4
needs.

> Requires the same adviser review as the rest. See [`README.md`](README.md).
> **Completed copies contain identifying information — keep them with the
> partner institution's records, never in this repository.**

---

# 1. Participant intake sheet

One per child, completed at enrolment, after consent and assent.

**This becomes Table 1 of Chapter 4.** Without it you can describe five
participants only as "five children", which tells a reader nothing about who the
findings apply to.

**Participant code:** `L___`  ← *use this code everywhere afterwards*

**Date of enrolment:** `____________`

### Identity — kept on this sheet only

| | |
|---|---|
| Child's name | `_________________________` |
| LEXORA account email | `_________________________` |

> **Keep the code-to-name mapping on paper, or in one file held separately from
> the study data — never in the repository, the database, or a synced folder.**
> Everything else in the study refers to `L1`…`L5` and nothing else. That
> separation is what makes the pseudonymisation real rather than nominal.

### Characteristics — these go into Table 1

| Field | Value |
|---|---|
| Age (years) | `______` |
| Sex | ☐ M ☐ F |
| Grade level | `______` |
| Language(s) spoken at home | ☐ Cebuano ☐ Filipino ☐ English ☐ other: `______` |
| Time already attending The Reading Owl | `______ months` |
| Prior dyslexia assessment? | ☐ Yes ☐ No ☐ Unknown |
| — if yes, by whom and when | `_________________________` |
| Other diagnoses relevant to reading | `_________________________` |
| Corrected vision / hearing? | ☐ Yes ☐ No — if yes: `______________` |
| Has used a tablet before | ☐ Yes ☐ No |

**Why home language is asked.** The children in Davao speak Cebuano as well as
Filipino, and the reading material is Filipino. A child who speaks little
Filipino at home is doing a harder task than one who speaks it daily, and that
belongs in the interpretation rather than in a footnote.

**Why prior assessment is asked.** "Children with dyslexia" is the participant
description. If some have a formal diagnosis and others are identified by the
centre's own judgement, say so — a panel will ask, and the honest answer is
better given first.

### Starting placement

Set by the reading specialist before the first session, from their own knowledge
of the child, so nobody begins at level 1 by default:

| | |
|---|---|
| Starting difficulty level (1–5) | `______` |
| Starting Marungko stage (1–7) | `______` |
| Basis for this placement | `_________________________` |

### Devices used

| | |
|---|---|
| Device(s) this child will use | `_________________________` |
| `/diagnostics` run and passed? | ☐ Yes — date: `__________` |

Completed by: `______________________` Date: `__________`

---
---

# 2. Session field log

**One row per session, per child.** Two minutes at the end of each session.

This is the cheapest data in the whole study and the only one that cannot be
reconstructed. When a child's accuracy drops thirty points in one afternoon, this
is the only thing that will ever tell you the aircon was being repaired, or that
they had come straight from a school test.

| Date | Child | Activities done | Mins | Anything unusual | Recorder |
|---|---|---|---|---|---|
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |

### What counts as "anything unusual"

Note it if you would want to know about it in three months:

- **The child** — tired, unwell, upset, distracted, unusually eager; arrived late;
  asked to stop; refused an activity.
- **The room** — noise, interruptions, other children present, poor lighting.
- **The equipment** — microphone trouble, slow connection, app error, tablet
  battery, a session that had to be restarted.
- **The session** — anything you did differently, any help you gave beyond the
  usual, anything the child said about the app.

**A blank cell should mean "nothing unusual", not "did not fill it in".** If those
two become indistinguishable the log stops being usable, so draw a dash rather
than leaving it empty.

### Log these separately and clearly

| Event | Why it matters |
|---|---|
| **A child declines to participate that day** | Assent is ongoing. A refusal is data and belongs in the record, not just in memory |
| **A withdrawal** | Chapter 3 must account for every child who started |
| **A session ended early** | Explains a short session in the export rather than leaving it looking like a data error |
| **Technical failure that lost data** | The one case where a gap in the database has an explanation |
| **Someone other than the usual specialist ran the session** | Affects how the child behaves, and matters for the acceptance instrument |

### Using it in the analysis

Do **not** silently drop a session because the log says the child was tired. Two
defensible options, and the choice must be stated in Chapter 3 rather than made
quietly per-session:

1. **Keep everything**, and use the log to explain anomalies in the discussion.
   Usually the better choice — real intervention data contains bad days, and
   removing them makes the result look cleaner than the reality it describes.
2. **Pre-specify an exclusion rule** before looking at the results — for example,
   sessions ended early for technical failure — and apply it uniformly.

What must not happen is deciding after seeing the numbers which sessions to drop.
That is the point at which a field log stops protecting the analysis and starts
endangering it.
