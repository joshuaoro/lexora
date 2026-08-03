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

  const existing = await prisma.activitySession.findUnique({ where: { id } });
  if (!existing || existing.learnerId !== session.learnerId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { completed, ...totals } = parsed.data;

  // Progress is flushed as the learner works and again when they finish, and
  // those requests use keepalive, so they can arrive out of order. Once an
  // activity is complete its numbers are final — a straggling partial flush
  // must not walk them backwards, or un-complete it.
  if (existing.completedAt) {
    return NextResponse.json({ ok: true, id: existing.id, ignored: "already completed" });
  }

  const updated = await prisma.activitySession.update({
    where: { id },
    data: {
      ...totals,
      ...(completed ? { completedAt: new Date() } : {}),
    },
  });
  return NextResponse.json({ ok: true, id: updated.id });
}
