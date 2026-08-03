import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Logo from "@/components/Logo";

export const metadata = {
  title: "Privacy Notice — LEXORA",
  description:
    "What LEXORA collects, why, how long it is kept, and how to have it deleted.",
};

const SECTIONS: { heading: string; body: React.ReactNode }[] = [
  {
    heading: "Who is responsible",
    body: (
      <>
        LEXORA is a student research project developed for an undergraduate capstone study
        conducted with <strong>The Reading Owl</strong>, a reading intervention centre in
        Davao City. The researchers are the data controllers. Questions or requests may be
        directed to the researchers through the partner institution.
      </>
    ),
  },
  {
    heading: "What is collected",
    body: (
      <ul className="ml-5 list-disc space-y-1">
        <li>
          <strong>Account details</strong> — name or nickname, email address, and a hashed
          password. Passwords are never stored in readable form.
        </li>
        <li>
          <strong>Reading activity</strong> — the words presented, what the speech
          recognizer transcribed, whether each reading was correct, the type of error,
          response time, and the difficulty level at the time.
        </li>
        <li>
          <strong>Voice recordings</strong> — a short audio clip of each word read aloud,
          so a reading specialist can replay it when checking the system&apos;s scoring.
        </li>
        <li>
          <strong>Display preferences</strong> — font, text size, spacing, colour overlay
          and reading speed.
        </li>
      </ul>
    ),
  },
  {
    heading: "Why it is collected",
    body: (
      <>
        Reading activity is used to give immediate feedback, build each learner&apos;s
        personal practice list, adjust exercise difficulty, and produce the progress
        reports reading specialists use to plan intervention. Voice recordings exist for
        one purpose only: allowing a specialist to verify whether the system scored a
        reading correctly. This data is collected as part of the study&apos;s evaluation and
        is not used for any commercial purpose.
      </>
    ),
  },
  {
    heading: "Speech recognition and third parties",
    body: (
      <>
        To score a reading, the recorded clip is sent to <strong>Groq</strong>, which runs a
        pre-trained Whisper speech-recognition model, and the transcript is returned to
        LEXORA. No custom model is trained and the recordings are not used to train or
        fine-tune any model. Aside from this transcription step, learner data is not shared
        with anyone outside the research team and the partner institution&apos;s reading
        specialists.
      </>
    ),
  },
  {
    heading: "Who can see it",
    body: (
      <>
        A learner sees only their own reading records. Reading specialists at the partner
        institution can see the records of learners enrolled in the intervention programme,
        which is necessary for them to plan and evaluate instruction. Access requires an
        account, and specialist accounts additionally require an access code issued by the
        institution.
      </>
    ),
  },
  {
    heading: "How long it is kept",
    body: (
      <>
        Voice recordings are deleted as soon as the scoring-reliability check for that
        learner is complete; a specialist can clear them at any time from the learner&apos;s
        page. Reading records are retained for the duration of the study and are deleted
        once the research has been completed and defended.
      </>
    ),
  },
  {
    heading: "Your rights",
    body: (
      <>
        Under the Philippine Data Privacy Act of 2012 (Republic Act No. 10173), a
        participant — or the parent or guardian of a child participant — may ask to see the
        data held about them, correct it, or have it erased. Participation is voluntary and
        consent may be withdrawn at any time without penalty. On request, a reading
        specialist can permanently erase a learner&apos;s account together with every
        reading record and recording; this cannot be undone.
      </>
    ),
  },
  {
    heading: "What LEXORA is not",
    body: (
      <>
        LEXORA is a reading <strong>support</strong> tool for word-level practice. It does
        not diagnose dyslexia, does not provide clinical assessment, and is not a substitute
        for the professional services of licensed educators, reading specialists,
        speech-language pathologists, or health-care professionals.
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-cream">
      <header className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <Link href="/" aria-label="LEXORA home">
          <Logo />
        </Link>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
        >
          <ArrowLeft size={16} /> Back
        </Link>
      </header>

      <article className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">Privacy Notice</h1>
        <p className="mt-2 text-sm font-semibold text-ink-muted">
          How LEXORA handles participants&apos; information, in line with the Philippine Data
          Privacy Act of 2012 (RA 10173).
        </p>

        <div className="mt-8 space-y-7">
          {SECTIONS.map(({ heading, body }) => (
            <section key={heading}>
              <h2 className="text-lg font-extrabold text-ink">{heading}</h2>
              <div className="mt-1.5 text-[15px] font-medium leading-relaxed text-ink-soft">
                {body}
              </div>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
