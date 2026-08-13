# Study instruments

The five documents this study needs that the application cannot produce.

| File | Who fills it in | When |
|---|---|---|
| [`01-consent-parent.md`](01-consent-parent.md) | Parent or guardian of each child | Before enrolment |
| [`02-assent-child.md`](02-assent-child.md) | Each child, read aloud to them | Before their first session |
| [`03-iso-25010-questionnaire.md`](03-iso-25010-questionnaire.md) | The 3 reading specialists | At close-out |
| [`04-pictorial-scale.md`](04-pictorial-scale.md) | The 5 children | At close-out |
| [`05-intake-and-field-log.md`](05-intake-and-field-log.md) | Researcher — intake at enrolment, log every session | Throughout |

Analysis for the two evaluation instruments is in [`../data-guide.md`](../data-guide.md) §4–5.

---

## Read this before using any of them

### These are drafts, not approved instruments

They are written to be accurate about *this* study — every claim in the consent
form matches what the application actually does, checked against
`src/app/privacy/page.tsx` and the schema. That makes them a sound starting
point. It does not make them approved.

**Before any of these reaches a parent, they must be reviewed and signed off by
your research adviser, and by your institution's ethics review committee or its
equivalent.** A consent form is the document a family relies on to understand
what is happening to their child's voice recordings. It is not a formality and it
is not something a student and an AI should finalise between them.

Two things in particular need a human decision that this document cannot make:

- **Whether the risk description is complete and honest for your setting.**
- **Whether your institution requires specific wording, letterhead, reference
  numbers, or a data-protection officer's contact.** Most do.

### The language question — decide this before printing

The partner site is in **Davao City**, where the everyday language is
**Cebuano/Bisaya**. This matters more than it might look:

- The children speak Cebuano as well as Filipino — the codebase already accounts
  for this (`prisma/pseudoword-bank.ts` screens probe non-words against *both*
  languages, because a "non-word" that is ordinary Bisaya is a real word to these
  readers).
- **The parents are likely Cebuano-dominant.** Consent obtained in a language
  someone reads with effort is weaker consent, and this is the document where
  that matters most.

These drafts are supplied in **English and Filipino**. A Cebuano translation of
the consent and assent forms is very likely needed, and should be made by a
fluent speaker — not machine-translated. Ask your adviser and the centre what
families there actually use.

The two evaluation instruments are less affected: the specialists are
professionals who work in English and Filipino, and the children's pictorial
scale is read aloud, so the administrator can speak whichever language the child
is comfortable in.

### Consent is a process, not a signature

Read the form aloud to the parent, in their language, and let them ask questions.
A signed form obtained by handing someone a page and a pen is a signature, not
consent.

For the child: assent is separate from parental consent and can be refused even
when the parent has agreed. A child who does not want to participate does not
participate. Re-check at each session — a child who assented in week one may not
want to continue in week five, and stopping is their right.

### Keep them out of this repository

Completed forms carry names, signatures and contact details of children and their
families. **Do not scan them into the repo, `backups/`, or any cloud folder
synced from this machine.** Keep the paper originals where the partner institution
keeps its own records, and hold only the participant ID mapping — separately, and
not in git.
