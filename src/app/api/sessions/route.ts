import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const schema = z.object({
  type: z.enum(["READ_ALOUD", "LISTEN_CHOOSE", "SYLLABLES", "RHYME", "FIRST_SOUND", "PRACTICE", "READER"]),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.learnerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid type" }, { status: 400 });

  // A learner who opens an exercise and leaves before finishing never closes
  // the session, so an empty row is left behind. Sweep the learner's own stale
  // ones as they start the next activity — otherwise they accumulate across a
  // multi-week study and clutter the exported data. Individual attempts are
  // recorded separately, so nothing the child actually did is lost.
  const staleBefore = new Date(Date.now() - 60 * 60 * 1000);
  await prisma.activitySession.deleteMany({
    where: { learnerId: session.learnerId, total: 0, createdAt: { lt: staleBefore } },
  });

  const profile = await prisma.learnerProfile.findUniqueOrThrow({
    where: { id: session.learnerId },
  });

  const activity = await prisma.activitySession.create({
    data: {
      learnerId: session.learnerId,
      type: parsed.data.type,
      levelAtTime: profile.level,
    },
  });

  return NextResponse.json({ id: activity.id }, { status: 201 });
}
