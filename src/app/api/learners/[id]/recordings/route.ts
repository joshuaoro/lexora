import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

/**
 * Data-retention control: erase a learner's stored voice recordings while
 * keeping their scores.
 *
 * Recordings only exist so a specialist can replay a reading during the
 * scoring-reliability check. Once that check is done they serve no further
 * purpose, so they should not sit in the database for the rest of the study.
 * Clearing `Attempt.audio` leaves transcripts, accuracy, error types and the
 * specialist–system agreement metric fully intact.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "SPECIALIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const profile = await prisma.learnerProfile.findUnique({ where: { id }, select: { id: true } });
  if (!profile) return NextResponse.json({ error: "Learner not found" }, { status: 404 });

  const { count } = await prisma.attempt.updateMany({
    where: { learnerId: id, audio: { not: null } },
    data: { audio: null },
  });

  return NextResponse.json({ ok: true, cleared: count });
}
