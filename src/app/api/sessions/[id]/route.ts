import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

/**
 * Progress is saved as the learner works, not only when they finish, so time
 * spent on an activity they walked away from is still theirs. `completed` marks
 * the ones they actually reached the end of — the dashboard counts those, while
 * minutes practiced counts every session.
 */
const schema = z.object({
  total: z.number().int().min(0),
  correct: z.number().int().min(0),
  durationMs: z.number().int().min(0),
  completed: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.learnerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { completed, ...totals } = parsed.data;

  // Progress is flushed as the learner works and again when they finish, and
  // those requests use keepalive, so they can arrive out of order. Once an
  // activity is complete its numbers are final — a straggling partial flush
  // must not walk them backwards, or un-complete it.
  //
  // One conditional write rather than a read and then a write. Checked in two
  // steps, a partial flush could read "not completed", the completing flush
  // land, and the partial one then overwrite the final totals — the very thing
  // the check exists to stop. And a learner erased between the two steps made
  // the write throw, answering 500 for a session that was simply gone.
  const { count } = await prisma.activitySession.updateMany({
    where: { id, learnerId: session.learnerId, completedAt: null },
    data: {
      ...totals,
      ...(completed ? { completedAt: new Date() } : {}),
    },
  });
  if (count === 1) return NextResponse.json({ ok: true, id });

  // Nothing written: either it is finished already, or it is not this
  // learner's — or not anyone's any more.
  const existing = await prisma.activitySession.findFirst({
    where: { id, learnerId: session.learnerId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, id, ignored: "already completed" });
}
