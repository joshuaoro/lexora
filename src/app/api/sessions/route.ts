import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getLearnerContext, sessionExpired } from "@/lib/guards";
import { purgeExpiredRecordings } from "@/lib/retention";

const schema = z.object({
  type: z.enum([
    "READ_ALOUD",
    "LISTEN_CHOOSE",
    "SYLLABLES",
    "RHYME",
    "FIRST_SOUND",
    "PRACTICE",
    "READER",
    "PSEUDO_PROBE",
  ]),
});

export async function POST(req: Request) {
  const ctx = await getLearnerContext();
  if (!ctx) return sessionExpired();

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid type" }, { status: 400 });

  // A learner who opens an exercise and leaves before finishing never closes
  // the session, so an empty row is left behind. Sweep the learner's own stale
  // ones as they start the next activity — otherwise they accumulate across a
  // multi-week study and clutter the exported data. Individual attempts are
  // recorded separately, so nothing the child actually did is lost.
  const staleBefore = new Date(Date.now() - 60 * 60 * 1000);
  await prisma.activitySession.deleteMany({
    where: { learnerId: ctx.learnerId, total: 0, createdAt: { lt: staleBefore } },
  });

  // Recordings past the retention window go at the same time. Scores and
  // transcripts are untouched, so no reported figure moves.
  await purgeExpiredRecordings(ctx.learnerId);

  const activity = await prisma.activitySession.create({
    data: {
      learnerId: ctx.learnerId,
      type: parsed.data.type,
      levelAtTime: ctx.profile.level,
    },
  });

  return NextResponse.json({ id: activity.id }, { status: 201 });
}
